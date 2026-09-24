'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../core.js');

function question(id = 'law-001', overrides = {}) {
  return {
    id, subject: 'law', chapter: '银行基础', type: 'single', question: `独立题干 ${id}`,
    options: ['选项甲', '选项乙', '选项丙'], answer: [1], explanation: '对应知识点的解释。',
    source: { kind: 'original', title: '原创练习', url: '', note: '非真题', verifiedAt: '2026-09-20' },
    tags: ['基础'], difficulty: 1, ...overrides
  };
}
function sourceQuestion(id, kind, extra = {}) {
  return question(id, { source: { kind, title: kind, url: 'https://example.org/reference', note: '', verifiedAt: '' }, ...extra });
}
function record(attempts, correct, lastCorrect, favorite = false) {
  return { attempts, correct, wrong: attempts - correct, lastCorrect, favorite };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

test('UMD exposes exactly the same APIs in browser context', () => {
  const sandbox = { URL };
  vm.runInNewContext(fs.readFileSync(require.resolve('../core.js'), 'utf8'), sandbox);
  assert.deepEqual(Object.keys(sandbox.QuizCore).sort(), Object.keys(core).sort());
  assert.equal(sandbox.QuizCore.safeSourceUrl('https://example.org'), 'https://example.org/');
});

test('validation returns independent normalized data and strips unknown fields', () => {
  const q = question('multi', { type: 'multiple', answer: [2, 0], tags: ['基础', '基础'], question: '  合法题干  ', unexpected: '<script>' });
  const original = clone(q);
  const result = core.validateQuestions([q]);
  assert.deepEqual(q, original);
  assert.deepEqual(result[0].answer, [0, 2]);
  assert.equal(result[0].question, '合法题干');
  assert.deepEqual(result[0].tags, ['基础']);
  assert.equal(result[0].unexpected, undefined);
  result[0].options[0] = '改动';
  assert.equal(q.options[0], original.options[0]);
});

test('all three question types and both subjects validate', () => {
  assert.equal(core.validateQuestions([
    question('s'), question('m', { subject: 'finance', type: 'multiple', answer: [0, 2] }),
    question('b', { type: 'boolean', options: ['正确', '错误'], answer: [0] })
  ]).length, 3);
});

test('optional provenance fields survive without accepting unsafe evidence URLs', () => {
  const q = question();
  Object.assign(q.source, { evidenceUrl: 'https://example.org/license', adaptation: '自拟场景', year: '2026', location: '第2章', license: 'CC BY', isbn: '978-test', publisher: '机构', edition: '第1版' });
  assert.deepEqual(core.validateQuestions([q])[0].source, q.source);
  q.source.evidenceUrl = 'data:text/html,x';
  assert.throws(() => core.validateQuestions([q]), /来源依据链接/);
});

test('sparse arrays are rejected rather than silently bypassing field checks', () => {
  assert.throws(() => core.validateQuestions(new Array(1)), /题目/);
  for (const field of ['options', 'answer', 'tags']) {
    const q = question();
    q[field] = new Array(field === 'options' ? 3 : 1);
    assert.throws(() => core.validateQuestions([q]), Error);
  }
});

test('validation rejects empty/oversized data, duplicate IDs, and normalized duplicate stems', () => {
  assert.throws(() => core.validateQuestions([]), /题库/);
  assert.throws(() => core.validateQuestions({}), /题库/);
  assert.throws(() => core.validateQuestions(new Array(10001)), /题库/);
  assert.throws(() => core.validateQuestions([question('x'), question('x', { question: '不同题干' })]), /编号重复/);
  assert.throws(() => core.validateQuestions([question('x', { question: 'ＡBC  题干' }), question('y', { question: 'abc\n题干' })]), /题干重复/);
});

test('strict schema rejects missing fields, unsafe links, invalid counts, and bogus dates', () => {
  const mutations = [
    q => { delete q.id; }, q => { q.id = '__proto__'; }, q => { q.subject = 'other'; },
    q => { q.chapter = ''; }, q => { q.type = 'essay'; }, q => { q.question = 'x'.repeat(3001); },
    q => { q.options = ['一个']; }, q => { q.options = ['Ａ', 'a']; },
    q => { q.options = new Array(11).fill('x'); }, q => { q.answer = []; },
    q => { q.answer = [0, 1]; }, q => { q.answer = ['1']; }, q => { q.answer = [3]; },
    q => { q.type = 'multiple'; }, q => { q.type = 'multiple'; q.answer = [0, 0]; },
    q => { q.type = 'boolean'; }, q => { q.explanation = ''; },
    q => { q.source.kind = 'real'; }, q => { q.source.url = 'javascript:alert(1)'; },
    q => { q.source.verifiedAt = '2026-02-30'; }, q => { q.source.verifiedAt = 'yesterday'; },
    q => { q.tags = '基础'; }, q => { q.tags = ['']; }, q => { q.difficulty = 0; },
    q => { q.difficulty = 1.5; }, q => { q.question = '坏\u0000题干'; }
  ];
  for (const mutate of mutations) {
    const q = question(); mutate(q);
    assert.throws(() => core.validateQuestions([q]), Error);
  }
});

test('answer checking uses exact unordered sets, without coercion or duplicate inflation', () => {
  const q = question('m', { type: 'multiple', answer: [0, 2] });
  assert.equal(core.checkAnswer(q, [2, 0]), true);
  for (const input of [[], [0], [0, 1, 2], [0, 0], ['0', 2], [-1, 2], [0, 3], null, '0,2']) {
    assert.equal(core.checkAnswer(q, input), false);
  }
  assert.equal(core.checkAnswer(question(), [1]), true);
  assert.equal(core.checkAnswer(question(), [0]), false);
  assert.equal(core.checkAnswer(question(), new Array(1)), false);
});

test('source priority is official, recalled, publication, open, original; stable for ties', () => {
  const questions = ['original', 'publication', 'recalled', 'official_past', 'open', 'publication'].map((s, i) => sourceQuestion(`q${i}`, s));
  const before = questions.map(q => q.id);
  assert.deepEqual(core.buildQueue(questions, {}, {}).map(q => q.id), ['q3', 'q2', 'q1', 'q5', 'q4', 'q0']);
  assert.deepEqual(questions.map(q => q.id), before);
  assert.deepEqual(core.buildQueue(questions, { limit: 2 }, {}).map(q => q.id), ['q3', 'q2']);
});

test('filters intersect and wrong/favorite/unseen states are independent', () => {
  const questions = [question('a'), question('b', { subject: 'finance', chapter: '理财', type: 'boolean', options: ['是', '否'] }), question('c')];
  const records = { a: record(2, 1, true, true), b: record(1, 0, false), c: record(0, 0, null, true) };
  assert.deepEqual(core.buildQueue(questions, { mode: 'wrong' }, records).map(q => q.id), ['b']);
  assert.deepEqual(core.buildQueue(questions, { mode: 'favorite' }, records).map(q => q.id), ['a', 'c']);
  assert.deepEqual(core.buildQueue(questions, { mode: 'unseen' }, records).map(q => q.id), ['c']);
  assert.deepEqual(core.buildQueue(questions, { subject: 'finance', chapter: '理财', type: 'boolean', source: 'original', mode: 'wrong' }, records).map(q => q.id), ['b']);
  assert.deepEqual(core.buildQueue(questions, { chapter: '不存在' }, records), []);
  assert.throws(() => core.buildQueue(questions, { limit: -1 }, records), /出题数量/);
  assert.throws(() => core.buildQueue(questions, { mode: 'invalid' }, records), /练习模式/);
});

test('notes-only filter selects tagged original questions without relabeling source identity', () => {
  const questions = [
    question('note-law', { tags: ['笔记原创', '存款'] }),
    question('note-finance', { subject: 'finance', tags: ['笔记原创', '复利'] }),
    question('other-original'),
    sourceQuestion('fake-note-tag', 'open', { tags: ['笔记原创'] })
  ];
  assert.deepEqual(core.buildQueue(questions, { source: 'notes_original' }, {}).map(q => q.id), ['note-law', 'note-finance']);
  assert.deepEqual(core.buildQueue(questions, { subject: 'finance', source: 'notes_original' }, {}).map(q => q.id), ['note-finance']);
  assert.equal(core.buildQueue(questions, { source: 'original' }, {}).length, 3);
  assert.equal(questions[0].source.kind, 'original');
});

test('random queue never loses or duplicates a question or mutates the input', () => {
  const questions = Array.from({ length: 100 }, (_, i) => question(`q${i}`));
  const original = questions.map(q => q.id);
  for (let i = 0; i < 30; i++) {
    const result = core.buildQueue(questions, { order: 'random' }, {});
    assert.equal(result.length, questions.length);
    assert.deepEqual(result.map(q => q.id).sort(), [...original].sort());
  }
  assert.deepEqual(questions.map(q => q.id), original);
});

test('weak queue prefers weaker chapters, then current wrong/unseen items', () => {
  const questions = [question('strong', { chapter: '已掌握' }), question('unseen', { chapter: '新章节' }), question('weak1', { chapter: '薄弱' }), question('weak2', { chapter: '薄弱' })];
  const records = { strong: record(5, 5, true), weak1: record(1, 0, false) };
  assert.deepEqual(core.buildQueue(questions, { order: 'weak' }, records).map(q => q.id), ['weak1', 'weak2', 'unseen', 'strong']);
});

test('recordAnswer is immutable, preserves favorites/history, and removes solved wrong items', () => {
  const before = { a: record(1, 0, false, true), b: record(2, 2, true) };
  Object.freeze(before.a); Object.freeze(before.b); Object.freeze(before);
  const after = core.recordAnswer(before, 'a', true);
  assert.deepEqual(after.a, { attempts: 2, correct: 1, wrong: 1, lastCorrect: true, favorite: true });
  assert.notEqual(after.b, before.b);
  assert.equal(before.a.lastCorrect, false);
  assert.equal(core.buildQueue([question('a')], { mode: 'wrong' }, after).length, 0);
  const failedAgain = core.recordAnswer(after, 'a', false);
  assert.equal(failedAgain.a.wrong, 2);
  assert.equal(core.buildQueue([question('a')], { mode: 'wrong' }, failedAgain).length, 1);
  assert.deepEqual(core.recordAnswer({}, 'new', false).new, record(1, 0, false));
  assert.throws(() => core.recordAnswer({}, '__proto__', true), /编号/);
  assert.throws(() => core.recordAnswer({}, 'q', 1), /布尔值/);
});

test('summary counts retries but current wrong questions, and excludes unknown question IDs', () => {
  const questions = [question('a'), question('b'), question('c', { subject: 'finance', chapter: '银行基础' }), question('d')];
  const records = { a: record(3, 2, true, true), b: record(1, 0, false), c: record(2, 1, false, true), ghost: record(5, 5, true, true) };
  const result = core.summarize(questions, records);
  assert.deepEqual(result, {
    total: 4, seen: 3, attempts: 6, correct: 3, accuracy: 50, wrong: 2, favorites: 2,
    chapters: [
      { subject: 'law', chapter: '银行基础', total: 3, seen: 2, correct: 2, accuracy: 50 },
      { subject: 'finance', chapter: '银行基础', total: 1, seen: 1, correct: 1, accuracy: 50 }
    ]
  });
  assert.equal(core.summarize([], {}).accuracy, 0);
  assert.equal(core.summarize([question('a')], {}).chapters[0].accuracy, 0);
});

test('backup round trip validates, deep clones, and optionally filters unknown IDs', () => {
  const raw = { version: 1, exportedAt: '2026-09-20T11:22:33.444Z', records: { a: record(1, 1, true), b: record(0, 0, null, true) }, other: 'discard' };
  const value = core.validateBackup(JSON.stringify(raw));
  assert.deepEqual(clone(value), { version: 1, exportedAt: raw.exportedAt, records: raw.records });
  const filtered = core.validateBackup(raw, [question('a')]);
  assert.deepEqual(Object.keys(filtered.records), ['a']);
  assert.deepEqual(Object.keys(core.validateBackup(raw, new Set(['b'])).records), ['b']);
  assert.deepEqual(Object.keys(raw.records), ['a', 'b']);
  value.records.a.correct = 99;
  assert.equal(raw.records.a.correct, 1);
});

test('backup rejects data pollution, malformed counters, invalid versions, and non-plain objects', () => {
  const invalid = [
    '{}', '{bad json', { version: 2, records: {} }, { version: 1, records: [] },
    { version: 1, exportedAt: '2026-02-31', records: {} },
    { version: 1, records: { a: { ...record(1, 1, true), correct: 2 } } },
    { version: 1, records: { a: { ...record(1, 1, true), wrong: 1 } } },
    { version: 1, records: { a: { ...record(1, 1, true), favorite: 'true' } } },
    { version: 1, records: { a: record(0, 0, false) } },
    { version: 1, records: { a: record(1, 0, true) } },
    { version: 1, records: { a: record(1, 1, false) } },
    { version: 1, records: { a: record(-1, 0, false) } },
    { version: 1, records: { a: record(Infinity, 0, false) } },
    { version: 1, records: { a: record(0.5, 0, false) } },
    { version: 1, records: { a: record(1000000001, 0, false) } },
    { version: 1, records: Object.create({ inherited: record(1, 1, true) }) },
    '{"version":1,"records":{"__proto__":{"polluted":true}}}',
    '{"version":1,"records":{"constructor":{"polluted":true}}}',
    '{"version":1,"records":{"a":{"attempts":0,"correct":0,"wrong":0,"lastCorrect":null,"favorite":true,"__proto__":{}}}}'
  ];
  for (const input of invalid) assert.throws(() => core.validateBackup(input), Error);
  assert.equal({}.polluted, undefined);
});

test('only absolute http(s) source URLs without embedded credentials survive', () => {
  assert.equal(core.safeSourceUrl('https://example.org/a?q=1#b'), 'https://example.org/a?q=1#b');
  assert.equal(core.safeSourceUrl('http://example.org'), 'http://example.org/');
  for (const input of ['', null, '/local', '//example.org', 'javascript:alert(1)', 'data:text/html,test', 'file:///C:/foo', 'https://user:pass@example.org', 'https://']) {
    assert.equal(core.safeSourceUrl(input), '');
  }
});
