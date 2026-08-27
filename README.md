# Thermoelectric Paper Digest

This repository runs the **stock upstream `X-PG13/paper-digest`** for thermoelectric literature monitoring.

The paper-digest source code is **not modified** here. GitHub Actions checks out a pinned upstream commit and applies only repository-side configuration.

## 最简单的使用方法

正常情况下你什么都不用做：它会在每周一大约 **08:07 Australia/Brisbane** 自动运行。

如果你想现在手动跑一次：

1. 打开仓库顶部的 **Actions**。
2. 左侧点击 **Thermoelectric Paper Digest Weekly**。
3. 点击右上角 **Run workflow**。
4. `Use workflow from` 保持 **main**。页面里历史记录旁边那些 `main` 只是分支标签，不需要点。
5. 在 `Run mode` 里选择：
   - **production**：正式运行。会读取并保存历史状态，自动去掉以前已经看过的论文。平时手动运行选这个。
   - **fresh_scan**：测试运行。忽略历史，重新扫描最近 7 天；不会写入正式历史。改关键词后想看看效果时选这个。
6. 点击绿色 **Run workflow**。
7. 等待运行变成绿色 ✅，点开这次 run。
8. 页面底部找到 **Artifacts**，下载 `thermoelectric-paper-digest-...`。

## 跑完主要看什么

Artifact 解压后：

- `output/latest.md` — **最推荐先看这个**，直接阅读本次文献周报。
- `output/site/index.html` — 网页版浏览。
- `output/latest.json` — 原始结构化数据，方便后续程序处理。
- `output/YYYY-MM-DD/` — 按日期保存的历史 JSON / Markdown。

## 自动运行与两种模式

Workflow: `.github/workflows/thermoelectric-weekly.yml`

Schedule: every Monday at about **08:07 Australia/Brisbane** (GitHub cron `22:07 UTC` on Sunday).

行为规则：

- **Scheduled Monday run** → production，使用历史去重并保存新的历史。
- **Manual + production** → 与正式周报相同，使用并更新历史。
- **Manual + fresh_scan** → 无状态扫描，不读取或污染 production cache。
- **修改配置/workflow 后自动触发的 push test** → 自动按 fresh scan 验证，不污染 production cache。

## 当前检索范围

Production config: `configs/thermoelectric-weekly.toml`

Current coverage:

- Core thermoelectric materials
- Doping and transport physics
- Thermoelectric machine learning and materials discovery
- Flexible / wearable / printed thermoelectrics, generators and modules
- Journal-oriented discovery through Crossref
- Article discovery through OpenAlex

The stock LLM analysis and translation features are intentionally disabled. No delivery channel is configured yet.

## 怎么改研究方向

只需要编辑：

`configs/thermoelectric-weekly.toml`

每个 `[[feeds]]` 是一个检索分组。常用字段：

- `name` — 分组名字
- `keywords` — 要关注的关键词
- `exclude_keywords` — 明确不要的关键词
- `queries` — Crossref / OpenAlex 的查询词
- `max_items` — 每组最多保留多少篇

修改并提交后，GitHub 会自动跑一次 **fresh validation**。先看这次测试结果是否合理；测试不会污染每周正式历史。

## Researcher watchlist

Stock paper-digest currently has no first-class `author` field in its feed config. A commented query-based researcher-watch template is included at the bottom of `configs/thermoelectric-weekly.toml`.

When specific researcher names are added, use one feed per researcher and treat it as query-based discovery rather than strict author-ID matching.

## Stock smoke test

The earlier **Paper Digest Thermoelectric Stock Smoke** workflow is kept as a minimal baseline test. Normally you do **not** need to run it. Use **Thermoelectric Paper Digest Weekly** for everyday use.

## Upstream pin

The production workflow pins the same upstream paper-digest revision that passed the initial thermoelectric smoke test:

`8906f9a12309956913eab29dade75c01cb7d0771`

Changing that pin should be treated as an explicit upstream upgrade and revalidated with the stock smoke test first.
