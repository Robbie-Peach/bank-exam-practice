# 银行从业 · 双科练习室

非商业、纯静态、手机优先的初级《银行业法律法规与综合能力》与《个人理财》练习页面。

## 使用
- 发布目录：`docs/`，GitHub Pages 从 `codex/bank-quiz-pages` 分支的 `/docs` 发布。
- 在线页面提供来源筛选、章节/题型筛选、随机与薄弱优先、错题本、收藏、逐题解析、统计、进度备份、JSON 题库本机导入。
- localStorage 仅本机保存；不自动跨设备同步。可用导出/导入在手机和电脑之间迁移。
- 首次在线加载完成后可离线。看到更新按钮时点击即可切换新缓存并保留进度；从旧版首次升级若仍显示 151 题，关闭所有本站旧标签页再打开。
- 回忆版直达：`https://robbie-peach.github.io/bank-exam-practice/?source=recalled`；也可点「回忆版专项」。旧题库升级会刷新本轮队列，保留历史作答与收藏。
- 也可以完整下载 `docs` 目录，直接打开 `index.html`。不要仅复制 HTML 而漏掉脚本和样式。

## 数据来源
初始 36 道 GPT 原创 + 新增 100 道 GPT 原创 + 15 道逐题审校的 FinEval 开放评测练习 + 5 道外部回忆版短题 = 156 道。

真题 > 回忆版 > 出版物 > 开放练习 > 原创。回忆版已直接收录 5 道（法律法规 2、个人理财 3）；官方原卷/出版物站内直接收录为 0，外部整套题数不计入本站。回忆版保留机构题源和考次，不冒充官方原卷，详见 `research/recalled-review.md`。FinEval 不是已认证真题或出版物题目；说明见 `data/ATTRIBUTION.md` 与在线 `ATTRIBUTION.html`。

保留来源链接、核验日期、答案依据。未来收录须核验真实性、时效和公开使用条件。个人 JSON 导入只存本机，不会上传服务器。

## 开发与验证
Node.js 无第三方依赖：
```sh
node scripts/build.cjs
node --test tests/core.test.cjs tests/app-static.test.cjs tests/recalled.test.cjs
python -m http.server 4173 --bind 127.0.0.1 --directory docs
```
原 HTML 仅保存在本地 `baseline/`，没有上传 GitHub；代码与发布文件无需原 HTML 即可构建。`scripts/import-v1.cjs` 是一次性源题导入脚本。

## 新题审校提示词
```text
仅依据所附资料整理银行从业初级练习题。每题保留真实题源类型、具体来源链接、考次或书名版次页码、正确答案与独立解析。缺少答案或来源时标记待核验，不入发布库；回忆版不标成官方真题；自行编写的题必须标GPT原创。核验法规版本、计算过程、选项唯一性及公开发布许可。按本项目题目schema输出JSON并通过validateQuestions，逐项报告变更与未核实项。
```

## 许可
FinEval 来源数据及新增解释/标注遵循 CC BY-NC-SA 4.0，参见 `data/ATTRIBUTION.md`；评测代码的 Apache 许可不应用到题目数据。本项目无广告或收费。第三方外链不代表获得其题库转载许可；5 道回忆题为各自公开文章的一题短引，其版权仍属相应权利人，解析为本站独立新增。
