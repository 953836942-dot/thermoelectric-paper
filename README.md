# Thermoelectric Literature Monitor

推荐使用 **PaperEcho Thermoelectric Weekly**。它每周自动抓取最近 7 天热电文献，再用 PaperEcho-TE 做 A/B/C/D 分级，并生成一个可以直接双击打开的网页周报。

旧的 **Thermoelectric Paper Digest Weekly** 和 stock smoke test 仍保留作备用，不需要删除。

## 最简单：怎么跑

正常情况下不用手动操作：系统会在每周一约 **08:07 Australia/Brisbane** 自动运行。

想现在跑一次：

1. 打开仓库顶部 **Actions**。
2. 左侧点击 **PaperEcho Thermoelectric Weekly**。
3. 点击右上角 **Run workflow**。
4. `Use workflow from` 保持 **main**。
5. 点击绿色 **Run workflow**。
6. 等最新运行变成绿色 ✅。
7. 点击这条运行的**黑色粗体标题**进入，不需要点绿色勾。
8. 滚到页面最下面 **Artifacts**。
9. 下载 `paperecho-te-weekly-...`。
10. 解压后直接双击 **`index.html`**。

没有 production / fresh_scan 选择。每次都扫描最近 7 天，因此手动运行也只有一个按钮。

## 下载后看什么

Artifact 根目录直接包含：

- **`index.html`** — 推荐先看；网页版周报，最上面直接是 `Top papers this week`。
- **`周报.xlsx`** — PaperEcho 生成的 Excel 周报；有论文时生成。
- `comparison.md` — A/B/C/D 标题清单。
- `report.json` — 网页周报的结构化数据。
- `papers.json` — PaperEcho 每篇论文的完整分级结果。
- `source-digest.md` — 候选抓取层的原始 Markdown，主要用于核对漏检。

## A / B / C / D 是什么

- **A — Read first / 必看**：你的重点材料体系或核心优化问题，并且有明确机制/性能内容。
- **B — Strong relevance / 很相关**：高相关热电材料、输运和性能工作，但不是当前最优先方向。
- **C — Broad relevance / 背景参考**：仍属于热电，但更偏器件、柔性传感或与你当前问题距离较远。
- **D — Out of scope / 排除**：battery、photovoltaic、photodetector、spin/anomalous Nernst 等已知误报方向。

A 档目前重点考虑：

- thermoelectric ML / materials informatics
- composition → property prediction
- co-doping / doping optimization
- weighted mobility / B factor / quality factor
- band convergence / resonant level
- GeTe / Bi2Te3 / PbTe / SnSe / Ag2Se / Mg3Sb2 / half-Heusler / skutterudite

PaperEcho 原版里对材料学不合适的 biomedical hard-exclude 已通过一个最小仓库侧 patch 关闭；其他 PaperEcho Local 流程保持固定上游版本运行。

## 在哪里改研究方向

从仓库首页：

**Code → configs → `research-directions.toml` → 右上角铅笔 Edit this file**

这个文件顶部写着 `USER EDIT AREA: RESEARCH DIRECTIONS`。目前已经分成：

- Doping Optimization and Transport
- Thermoelectric ML and Composition
- Material Systems
- Performance Engineering
- Fresh Thermoelectric Preprints
- Flexible and Thermoelectric Devices
- Broad Thermoelectric Safety Net

想增加新方向，只需要在对应 `queries = [...]` 或 `keywords = [...]` 中增加一项并 Commit。

## 在哪里加关注研究者

从仓库首页：

**Code → configs → `researchers.toml` → 右上角铅笔 Edit this file**

文件顶部有 `USER EDIT AREA: RESEARCHER WATCHLIST` 模板。复制模板、去掉 `#`、把 `Full Name` 改成研究者姓名即可。

目前研究者发现使用 OpenAlex 的“姓名 + thermoelectric / Seebeck”文本查询。因为 stock paper-digest 0.4.1 没有严格 author-ID 字段，所以它适合发现研究者相关新论文，但不能承诺 100% 身份消歧。

## 在哪里改 A/B/C/D 规则

**Code → paperecho-config → `review-workflow-rules.json`**

这里控制重点材料、核心机制、A/B/C/D 定义和 D 级排除词。当前规则是确定性的，不会在后台自己修改。

## 当前技术路线

当前稳定版本采用：

**stock paper-digest（最近 7 天候选抓取） → PaperEcho-TE（去重/规则分级/周报） → `index.html` + `周报.xlsx`**

这么做是因为 PaperEcho Local 本身接受 JSON/JSONL 输入但不负责在线检索；PaperEcho 完整 Web/Zotero 检索路径需要额外的 Zotero API 配置。现在这条路线不需要 API key、不需要付费 LLM，也不需要你的电脑一直开着。

固定版本：

- paper-digest: `8906f9a12309956913eab29dade75c01cb7d0771`
- PaperEcho: `87a49927306e347553e74b5fbc7b48de8ca09055`

## 备用 workflow

- **PaperEcho Thermoelectric Weekly** — **日常推荐使用**。
- **Thermoelectric Paper Digest Weekly** — 旧 baseline / 备用抓取周报。
- **Paper Digest Thermoelectric Stock Smoke** — 最小 smoke test，平时不用点。

## Experimental: TE Literature Radar

`feature/te-literature-radar` 还包含一套新的轻量 **TE Literature Radar Codex Skill**。它独立于当前 PaperEcho production workflow，使用 Crossref + OpenAlex + arXiv + RSS，支持 `auto`、最近 N 天以及任意起止日期搜索，并由 Codex 在受限证据上判断创新性，再由确定性代码完成 A/B/C 分级。

详细配置、手动补搜和 Codex Automation 用法见 `docs/te-literature-radar.md`。在新雷达完成真实运行对比前，当前 PaperEcho 周报仍保持原样，不做自动迁移。
