(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuizCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SOURCES = ['official_past', 'recalled', 'publication', 'open', 'original'];
  var SUBJECTS = ['law', 'finance'];
  var TYPES = ['single', 'multiple', 'boolean'];
  var MAX_QUESTIONS = 10000;
  var MAX_COUNT = 1000000000;
  var BAD_KEYS = ['__proto__', 'prototype', 'constructor'];
  var own = Function.call.bind(Object.prototype.hasOwnProperty);

  function fail(message) { throw new Error(message); }
  function plain(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function object(value, label) {
    if (!plain(value)) fail(label + '必须是普通对象');
    Object.keys(value).forEach(function (key) {
      if (BAD_KEYS.indexOf(key) !== -1) fail(label + '包含非法字段');
    });
    return value;
  }
  function string(value, label, max, allowEmpty) {
    if (typeof value !== 'string') fail(label + '必须是字符串');
    var normalized = value.trim();
    if ((!allowEmpty && !normalized) || normalized.length > max) fail(label + '长度不合法');
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) fail(label + '包含控制字符');
    return normalized;
  }
  function id(value, label) {
    var normalized = string(value, label, 128, false);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(normalized) || (BAD_KEYS.indexOf(normalized) !== -1 || own(Object.prototype, normalized))) fail(label + '格式不合法');
    return normalized;
  }
  function member(value, allowed, label) {
    if (allowed.indexOf(value) === -1) fail(label + '取值不合法');
    return value;
  }
  function integer(value, min, max, label) {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(label + '必须是范围内的整数');
    return value;
  }
  function fingerprint(value) {
    return value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  }
  function safeSourceUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) return '';
    try {
      var parsed = new URL(value.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      if (!parsed.hostname || parsed.username || parsed.password) return '';
      return parsed.href;
    } catch (_) { return ''; }
  }
  function verifyDate(value, label, allowEmpty) {
    var date = string(value, label, 40, allowEmpty);
    if (!date && allowEmpty) return '';
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(date)) fail(label + '必须是有效的日期或 UTC 时间');
    var parsed = new Date(date);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date.slice(0, 10)) fail(label + '日期不合法');
    return date;
  }

  /** Validate every row, remove unexpected fields, and return independent data. */
  function validateQuestions(raw) {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_QUESTIONS) fail('题库必须包含 1 至 ' + MAX_QUESTIONS + ' 道题');
    var ids = new Set();
    var stems = new Set();
    return Array.from(raw).map(function (value, index) {
      var label = '第 ' + (index + 1) + ' 题：';
      var row = object(value, label + '题目');
      var questionId = id(row.id, label + '编号');
      if (ids.has(questionId)) fail(label + '编号重复');
      ids.add(questionId);
      var subject = member(row.subject, SUBJECTS, label + '科目');
      var chapter = string(row.chapter, label + '章节', 100, false);
      var type = member(row.type, TYPES, label + '题型');
      var question = string(row.question, label + '题干', 3000, false);
      var stem = fingerprint(question);
      if (stems.has(stem)) fail(label + '题干重复');
      stems.add(stem);
      if (!Array.isArray(row.options) || row.options.length < 2 || row.options.length > 10) fail(label + '选项数量必须为 2 至 10 个');
      if (type === 'boolean' && row.options.length !== 2) fail(label + '判断题必须恰有两个选项');
      var optionKeys = new Set();
      var options = Array.from(row.options).map(function (option) {
        var text = string(option, label + '选项', 1500, false);
        var key = fingerprint(text);
        if (optionKeys.has(key)) fail(label + '选项重复');
        optionKeys.add(key);
        return text;
      });
      if (!Array.isArray(row.answer) || row.answer.length === 0 || row.answer.length > options.length) fail(label + '答案数量不合法');
      if (type !== 'multiple' && row.answer.length !== 1) fail(label + '单选和判断题必须只有一个答案');
      if (type === 'multiple' && row.answer.length < 2) fail(label + '多选题必须至少有两个答案');
      var answer = Array.from(row.answer).map(function (value) { return integer(value, 0, options.length - 1, label + '答案索引'); });
      if (new Set(answer).size !== answer.length) fail(label + '答案索引重复');
      answer.sort(function (a, b) { return a - b; });
      var explanation = string(row.explanation, label + '解析', 6000, false);
      var source = object(row.source, label + '来源');
      var kind = member(source.kind, SOURCES, label + '来源类型');
      var sourceUrl = string(source.url, label + '来源链接', 2048, true);
      if (sourceUrl && !safeSourceUrl(sourceUrl)) fail(label + '来源链接仅接受有效的 HTTP 或 HTTPS 地址');
      if (!Array.isArray(row.tags) || row.tags.length > 20) fail(label + '标签必须是最多包含 20 项的数组');
      var tags = Array.from(row.tags).map(function (tag) { return string(tag, label + '标签', 60, false); });
      var normalizedSource = {
        kind: kind,
        title: string(source.title, label + '来源标题', 300, false),
        url: safeSourceUrl(sourceUrl),
        note: string(source.note, label + '来源说明', 1500, true),
        verifiedAt: verifyDate(source.verifiedAt, label + '核验日期', true)
      };
      if (own(source, 'evidenceUrl')) {
        var evidenceUrl = string(source.evidenceUrl, label + '来源依据链接', 2048, true);
        if (evidenceUrl && !safeSourceUrl(evidenceUrl)) fail(label + '来源依据链接仅接受有效的 HTTP 或 HTTPS 地址');
        normalizedSource.evidenceUrl = safeSourceUrl(evidenceUrl);
      }
      ['adaptation', 'year', 'location', 'license', 'isbn', 'publisher', 'edition'].forEach(function (field) {
        if (own(source, field)) normalizedSource[field] = string(source[field], label + '来源字段 ' + field, 1500, true);
      });
      return {
        id: questionId,
        subject: subject,
        chapter: chapter,
        type: type,
        question: question,
        options: options,
        answer: answer,
        explanation: explanation,
        source: normalizedSource,
        tags: Array.from(new Set(tags)),
        difficulty: integer(row.difficulty, 1, 3, label + '难度')
      };
    });
  }

  function checkAnswer(question, selected) {
    if (!question || !Array.isArray(question.answer) || !Array.isArray(question.options) || !Array.isArray(selected)) return false;
    selected = Array.from(selected);
    if (selected.length !== question.answer.length || new Set(selected).size !== selected.length) return false;
    if (!selected.every(function (n) { return Number.isInteger(n) && n >= 0 && n < question.options.length; })) return false;
    return selected.every(function (n) { return question.answer.indexOf(n) !== -1; });
  }

  function blankRecord() {
    return { attempts: 0, correct: 0, wrong: 0, lastCorrect: null, favorite: false };
  }
  function normalizeRecord(value, label) {
    var record = object(value, label);
    var attempts = integer(record.attempts, 0, MAX_COUNT, label + '作答次数');
    var correct = integer(record.correct, 0, attempts, label + '正确次数');
    var wrong = integer(record.wrong, 0, attempts, label + '错误次数');
    if (correct + wrong !== attempts) fail(label + '正确次数与错误次数之和必须等于作答次数');
    if (typeof record.favorite !== 'boolean') fail(label + '收藏状态必须为布尔值');
    if (attempts === 0 && record.lastCorrect !== null) fail(label + '未作答记录的最近结果必须为 null');
    if (attempts > 0 && typeof record.lastCorrect !== 'boolean') fail(label + '最近结果必须为布尔值');
    if (record.lastCorrect === true && correct === 0) fail(label + '最近正确结果与正确次数不一致');
    if (record.lastCorrect === false && wrong === 0) fail(label + '最近错误结果与错误次数不一致');
    return { attempts: attempts, correct: correct, wrong: wrong, lastCorrect: record.lastCorrect, favorite: record.favorite };
  }
  function normalizeRecords(raw) {
    object(raw, '答题记录');
    var keys = Object.keys(raw);
    if (keys.length > MAX_QUESTIONS) fail('答题记录数量超过上限');
    var result = Object.create(null);
    keys.forEach(function (key) {
      var normalizedId = id(key, '记录编号');
      if (normalizedId !== key) fail('记录编号不得包含前后空白');
      result[key] = normalizeRecord(raw[key], '记录 ' + key + '：');
    });
    return result;
  }
  function getRecord(records, questionId) {
    return own(records, questionId) ? records[questionId] : blankRecord();
  }
  function recordAnswer(records, questionId, correct) {
    questionId = id(questionId, '题目编号');
    if (typeof correct !== 'boolean') fail('作答结果必须为布尔值');
    var next = normalizeRecords(records || {});
    var previous = getRecord(next, questionId);
    if (previous.attempts >= MAX_COUNT) fail('该题作答次数已达到上限');
    next[questionId] = {
      attempts: previous.attempts + 1,
      correct: previous.correct + (correct ? 1 : 0),
      wrong: previous.wrong + (correct ? 0 : 1),
      lastCorrect: correct,
      favorite: previous.favorite
    };
    return next;
  }

  /** Input accepts parsed JSON or a JSON string, never evaluates content. */
  function validateBackup(raw, knownIds) {
    if (typeof raw === 'string') {
      if (raw.length > 10000000) fail('备份文件超过大小上限');
      try { raw = JSON.parse(raw); } catch (_) { fail('备份文件不是有效的 JSON'); }
    }
    object(raw, '备份文件');
    if (raw.version !== 1) fail('备份版本不受支持');
    var records = normalizeRecords(raw.records);
    if (knownIds !== undefined) {
      var values = knownIds instanceof Set ? Array.from(knownIds) : knownIds;
      if (!Array.isArray(values)) fail('题库编号集合必须是数组或 Set');
      var allowed = new Set(values.map(function (value) { return id(typeof value === 'string' ? value : value && value.id, '题库编号'); }));
      Object.keys(records).forEach(function (key) { if (!allowed.has(key)) delete records[key]; });
    }
    var result = { version: 1, records: records };
    if (own(raw, 'exportedAt')) result.exportedAt = verifyDate(raw.exportedAt, '备份导出时间', false);
    return result;
  }

  function priority(a, b) {
    return SOURCES.indexOf(a.source.kind) - SOURCES.indexOf(b.source.kind);
  }
  function chapterKey(question) { return question.subject + '\u0000' + question.chapter; }
  function buildQueue(questions, config, rawRecords) {
    var options = Object.assign({ subject: 'all', chapter: 'all', type: 'all', source: 'all', mode: 'all', order: 'priority', limit: 0 }, config || {});
    member(options.subject, ['all'].concat(SUBJECTS), '筛选科目');
    member(options.type, ['all'].concat(TYPES), '筛选题型');
    member(options.source, ['all', 'notes_original'].concat(SOURCES), '筛选来源');
    member(options.mode, ['all', 'wrong', 'favorite', 'unseen'], '练习模式');
    member(options.order, ['priority', 'random', 'weak'], '出题顺序');
    string(options.chapter, '筛选章节', 100, false);
    integer(options.limit, 0, MAX_QUESTIONS, '出题数量');
    var records = normalizeRecords(rawRecords || {});
    var queue = questions.filter(function (question) {
      var r = getRecord(records, question.id);
      return (options.subject === 'all' || question.subject === options.subject) &&
        (options.chapter === 'all' || question.chapter === options.chapter) &&
        (options.type === 'all' || question.type === options.type) &&
        (options.source === 'all' || (options.source === 'notes_original'
          ? question.source.kind === 'original' && question.tags.includes('笔记原创')
          : question.source.kind === options.source)) &&
        (options.mode !== 'wrong' || r.lastCorrect === false) &&
        (options.mode !== 'favorite' || r.favorite) &&
        (options.mode !== 'unseen' || r.attempts === 0);
    });
    if (options.order === 'random') {
      for (var i = queue.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = queue[i]; queue[i] = queue[j]; queue[j] = temp;
      }
    } else if (options.order === 'weak') {
      var chapters = Object.create(null);
      questions.forEach(function (question) {
        var key = chapterKey(question);
        var r = getRecord(records, question.id);
        if (!chapters[key]) chapters[key] = { attempts: 0, wrong: 0 };
        chapters[key].attempts += r.attempts;
        chapters[key].wrong += r.wrong;
      });
      function weakness(question) {
        var chapter = chapters[chapterKey(question)];
        return chapter.attempts ? chapter.wrong / chapter.attempts : 0.5;
      }
      function state(question) {
        var r = getRecord(records, question.id);
        return r.lastCorrect === false ? 2 : r.attempts === 0 ? 1 : 0;
      }
      queue.sort(function (a, b) { return weakness(b) - weakness(a) || state(b) - state(a) || priority(a, b); });
    } else queue.sort(priority);
    return options.limit ? queue.slice(0, options.limit) : queue;
  }

  /** Accuracy is a percentage in [0,100], not a ratio; counts include retries. */
  function summarize(questions, rawRecords) {
    var records = normalizeRecords(rawRecords || {});
    var summary = { total: questions.length, seen: 0, attempts: 0, correct: 0, accuracy: 0, wrong: 0, favorites: 0, chapters: [] };
    var byChapter = Object.create(null);
    questions.forEach(function (question) {
      var record = getRecord(records, question.id);
      var key = chapterKey(question);
      if (!byChapter[key]) {
        byChapter[key] = { subject: question.subject, chapter: question.chapter, total: 0, seen: 0, correct: 0, accuracy: 0, attempts: 0 };
        summary.chapters.push(byChapter[key]);
      }
      var chapter = byChapter[key];
      chapter.total++;
      chapter.seen += record.attempts > 0 ? 1 : 0;
      chapter.correct += record.correct;
      chapter.attempts += record.attempts;
      summary.seen += record.attempts > 0 ? 1 : 0;
      summary.attempts += record.attempts;
      summary.correct += record.correct;
      summary.wrong += record.lastCorrect === false ? 1 : 0;
      summary.favorites += record.favorite ? 1 : 0;
    });
    summary.accuracy = summary.attempts ? summary.correct / summary.attempts * 100 : 0;
    summary.chapters.forEach(function (chapter) {
      chapter.accuracy = chapter.attempts ? chapter.correct / chapter.attempts * 100 : 0;
      delete chapter.attempts;
    });
    return summary;
  }

  return Object.freeze({
    validateQuestions: validateQuestions,
    checkAnswer: checkAnswer,
    buildQueue: buildQueue,
    recordAnswer: recordAnswer,
    summarize: summarize,
    validateBackup: validateBackup,
    safeSourceUrl: safeSourceUrl
  });
});
