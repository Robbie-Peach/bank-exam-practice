# 银行从业两科题源核查

核查日期：2026-09-20。范围：《银行业法律法规与综合能力（初级）》与《个人理财（初级）》。来源权威性、真实性、公开再分发条件、答案正确性是四个独立维度。

## 结论

1. 本轮检索协会大纲、教材、考试新闻及“真题/公开试题”等关键词，未找到协会公开发布的两科完整历年试卷或可再分发题库。这里的结论是“本轮未找到”，不是证明官方绝不公开。
2. 233 网校最新题库直接标注“考生回忆版”。作为优先外链使用，不称为“官方真题”，不把公开浏览、免费领取、付费购买等同于公开转载授权。
3. 两科官方教材有明确协会发布页；其页面提醒协会未授权其他单位或个人出版配套辅导教材、习题集等。因此第三方教辅可标真实出版物，但不标“官方配套习题”。
4. 找到开放学术评测集 FinEval。该集是第四种独立来源，不应为满足优先级而塞入“真题”“出版物”或“GPT原创”。本轮在有答案的121题中审选15题，输出至 `data/open-questions.json`；具体筛选与许可见 `data/ATTRIBUTION.md`。
5. 用户的“真题 > 发行物练习题 > GPT原创”优先级应保留。缺失的类别显示 0；禁止用数量填充掩盖来源差异。

## A. 官方依据与教材

|用途|名称/版本|原始页面|核查结果|
|---|---|---|---|
|官方大纲|法律法规，2021-04-15|https://www.china-cba.net/Index/show/catid/70/id/39302.html|仍列在官方大纲目录；存在后续法规优先条款。|
|官方大纲|个人理财，2024-08-22|https://www.china-cba.net/Index/show/catid/70/id/43162.html|9 个部分；官方说明范围不局限于教材、法规冲突以新规为准。|
|大纲目录|职业资格考试大纲|https://www.china-cba.net/Index/lists/catid/70.html|用于后续查新，不是题库来源。|
|官方教材|法律法规，2024年版|https://www.china-cba.net/Index/show/catid/309/id/43900.html|办公室组织编写，中国金融出版社出版；没有公开习题再分发许可。|
|官方教材|个人理财初级，2023年版|https://www.china-cba.net/Index/show/catid/309/id/42384.html|官方出版信息可核验；没有公开习题再分发许可。|
|官方简章|2026上半年报名简章|https://www.china-cba.net/Uploads/ueditor/file/20260403/69cf6b7a0e083.pdf|再次列出上述两科教材版本，并说明初级单选、多选、判断等题型与120分钟时长。|
|考试日期|2026年度考试时间公告|https://www.china-cba.net/Index/show/catid/15/id/46136.html|官方确认下半年10月24日、25日；本页不确认报名截止日。|

## B. 优先级 1：机构回忆版真题外链

|科目|入口|当前可验证标注|发布策略|
|---|---|---|---|
|法律法规|https://ks.233.com/384/2|2026年6月考生回忆版99题；2025年10月卷二考生回忆版113题|仅外链，条数是上游页面标注，不计入本站内置题数。|
|个人理财|https://ks.233.com/385/2|2026年6月考生回忆版115题|仅外链，不抓取整库。|
|法律法规单篇|https://www.233.com/ccbp/zhenti/ggjc/202606/04090728337898.html|2026年6月13日考后题目与答案文章|仅外链；非协会官方试卷。|
|个人理财单篇|https://m.233.com/ccbp/zhenti/grlc/202606/04095618301019.html|2026年6月13日考后题目与答案文章|仅外链；非协会官方试卷。|

## C. 优先级 2：真实发行物入口

出版社自有书目是发行真实性证据，不是内容再发布许可。以下历史版本仅作题源调查，不推荐作为2026年法规题主资料。

- 清华大学出版社《个人理财讲义·真题·预测全攻略》，2017-03-01，ISBN 9787302464532。出版社目录表明有配套练习。https://www.tup.tsinghua.edu.cn/booksCenter/book_07064901.html
- 同书出版社自有试读PDF：https://www.tup.tsinghua.edu.cn/upload/books/yz/070649-01.pdf 。公开试读不等于授权镜像或批量转成公开题库。
- 清华大学出版社《银行业法律法规与综合能力（初级）过关必备（名师讲义+历年真题+考前预测）》，2016-08-01，ISBN 9787302441694。https://www.tup.com.cn/booksCenter/book_06482501.html 。年代较早，未发现开放再分发授权，仅外链备查。

## D. 独立候选：FinEval 开放学术评测题

### 授权与来源链

- 发布者：SUFE-AIFLM-Lab；数据主页 https://huggingface.co/datasets/SUFE-AIFLM-Lab/FinEval 。数据卡明确标为 **CC-BY-NC-SA-4.0**，不同于 GitHub 代码的 Apache-2.0。
- 数据 ZIP：https://huggingface.co/datasets/SUFE-AIFLM-Lab/FinEval/resolve/main/FinEval.zip 。本地 SHA256：`44467786CFCEAB0783959FFB674598669207D28122ED6104F837F26A4F926764`。
- 正式论文：https://aclanthology.org/2025.naacl-long.318.pdf ，第4页（印刷页6261）§3.2.1–3.2.2 描述来源为公开模拟考试与考试/教材题改编，并声明专业人员的收集改编确保没有版权问题。
- 这一声明与数据许可构成发布者提供的来源依据；数据未给逐题原书、页码、考次和上游授权文件。因此只能如实标“开放学术评测练习”，不宣称逐题真题身份或出版物来源已核验。
- 若采用：保留作者/数据集/论文/许可链接、标记改编，遵守非商业与相同方式共享条件；不要把整站代码或全部原创题误标成 Apache 数据许可。

### 实际解包检查

|文件|实际行数|字段|适用性|
|---|---:|---|---|
|dev/banking_practitioner_qualification_certificate_dev.csv|5|id,question,A,B,C,D,answer,explanation|有答案与解析，但混合多专业。|
|val/banking_practitioner_qualification_certificate_val.csv|116|id,question,A,B,C,D,answer|有答案，无解析。|
|test/banking_practitioner_qualification_certificate_test.csv|299|id,question,A,B,C,D|没有答案，不能直接自动判题。|

总计420题，不等于420道可刷题；有上游答案仅121题。验证集116题答案均为单个 A/B/C/D；验证集题干精确重复数为0。科目混合个人贷款、公司信贷、风险管理等，必须筛两科。此处未完成全部121题答案复核或模糊去重。

### 已定位的时效问题

- `val:34` 将信用卡透支利率上下限当作现行规则。人民银行官方答复确认2021-01-01已取消上下限管理： https://wzdt.pbc.gov.cn/eportal/ui?msgDataId=f2e8db7a58f341549ad38f99ef300203&pageId=77c3557bd521439ea5cd869f5393ba98 。该题不进入现行练习。
- `val:4` 的操作风险旧标准法业务系数、`val:8` 引用《商业银行资本管理办法（试行）》均须重新核对。司法部转载的现行办法确认2024-01-01施行并废止试行办法： https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202409/t20240909_505612.html 。先隔离，不静默替换答案。
- 其余监管比例、机构名称、贷款门槛、法律条文与科目归属尚需逐题复核。可以先审查金融数学等相对稳定知识，但不能以“学术数据集”替代内容验收。

## E. 实施数据契约

题目至少记录 `sourceKind`、`sourceTitle`、`sourceUrl`、`originalId`、`sourceDate`、`retrievedAt`、`license`、`answerSource`、`reviewStatus`、`reviewedAt`。推荐类型：`official_past`、`recalled_past`、`publication`、`open_benchmark`、`original`。

页面应分开展示“本站可刷题数”与“外部资源数”。所有外部链接增加 `rel="noopener noreferrer"`；导入的个人资料仅存本机，未经确认不上传到公开仓库。题源排序只决定同类练习的取题优先级，不推导答案可靠性。
