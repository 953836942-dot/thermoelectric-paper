# Thermoelectric Paper Digest

This repository runs the **stock upstream `X-PG13/paper-digest`** for thermoelectric literature monitoring.

The paper-digest source code is **not modified** here. GitHub Actions checks out a pinned upstream commit and combines repository-side configuration files at runtime.

## 最简单的使用方法

正常情况下你什么都不用做：它会在每周一大约 **08:07 Australia/Brisbane** 自动运行。

如果你想现在手动跑一次：

1. 打开仓库顶部的 **Actions**。
2. 左侧点击 **Thermoelectric Paper Digest Weekly**。
3. 点击右上角 **Run workflow**。
4. `Use workflow from` 保持 **main**。历史记录旁边那些 `main` 只是分支标签，不需要点。
5. 在 `Run mode` 里选择：
   - **production**：正式运行。读取并保存历史状态，自动去掉以前已经看过的论文。平时手动运行选这个。
   - **fresh_scan**：测试运行。忽略历史，重新扫描最近 7 天；不会写入正式历史。改关键词后想看看效果时选这个。
6. 点击绿色 **Run workflow**。
7. 等待运行变成绿色 ✅，点开这次 run 的**黑色粗体标题**，不是点绿色勾。
8. 页面底部找到 **Artifacts**，下载 `thermoelectric-paper-digest-...`。

Artifact 解压后，GitHub 会直接把 `output/` 里面的内容放到根目录，所以通常直接看到：

- `index.html` — **最方便，双击直接看网页版**。
- `latest.md` — 本次 Markdown 周报。
- `latest.json` — 原始结构化数据。
- `weekly-review.html` / `reading-list.html` / `trends.html` — 历史与反馈相关页面。

## 在哪里改研究方向

从仓库首页开始：

**Code → configs → research-directions.toml → 右上角铅笔图标 Edit this file**

这个文件顶部已经写着 `USER EDIT AREA: RESEARCH DIRECTIONS`，就是专门给你改的。当前分组为：

- `PRIORITY - Doping Optimization and Transport`
- `PRIORITY - Thermoelectric ML and Composition`
- `PRIORITY - Material Systems`
- `PRIORITY - Performance Engineering`
- `Fresh Thermoelectric Preprints`
- `Flexible and Thermoelectric Devices`
- `Broad Thermoelectric Safety Net`

目前重点覆盖：

- thermoelectric ML / materials informatics
- composition → property prediction
- doping optimization
- carrier concentration optimization
- weighted mobility / quality factor / B factor
- band convergence / resonant level / bipolar conduction
- Bi2Te3 / GeTe / PbTe / SnSe / Ag2Se / Mg3Sb2 / half-Heusler / skutterudite
- alloying / co-doping / interface engineering / strain engineering / band engineering / carrier transport / phonon engineering / nanostructuring

想加新方向时，在对应 `queries = [...]` 或 `keywords = [...]` 里增加一行即可。提交后 GitHub 自动跑一次 **fresh_scan** 检查效果，不污染正式历史。

## 在哪里加关注研究者

从仓库首页开始：

**Code → configs → researchers.toml → 右上角铅笔图标 Edit this file**

这个文件顶部写着 `USER EDIT AREA: RESEARCHER WATCHLIST`，里面有一个完整的注释模板：

1. 复制模板 block。
2. 删除复制内容每行前面的 `#`。
3. 把 `Full Name` 替换成研究者真实姓名。
4. 点 **Commit changes**。
5. GitHub 会自动 fresh-scan 验证。

注意：stock paper-digest 0.4.1 **没有严格 author-ID 过滤字段**。目前研究者监控使用 OpenAlex 的“研究者姓名 + thermoelectric / Seebeck”文本查询，是研究发现功能，不保证 100% 作者身份匹配。

## 关于“高质量期刊优先”

我们实际测试过 Crossref、OpenAlex 和 Semantic Scholar 的“期刊名 + thermoelectric”stock 配置方案：

- Crossref 会把部分旧论文因为重新索引时间带进本周结果，容易造成假新文献。
- OpenAlex / Semantic Scholar 的普通文本查询不能可靠把期刊名称当作严格 venue filter。

因此当前**没有伪装成严格期刊过滤**。在不修改 paper-digest 源码的前提下，正式方案优先按研究价值筛：掺杂优化、材料体系、高性能改善和关键输运机制，再把 broad safety-net 放最后。

当前 fresh validation 已经能把本周较强的工作拉到 priority streams，例如 Science Advances、Small、Advanced Functional Materials、Advanced Energy Materials 的热电工作，同时过滤了已观察到的 optoelectronics / battery 等明显非热电误报。

如果以后明确允许增加一个仓库侧预处理层或修改上游逻辑，才适合做真正的 venue whitelist / journal quality score。

## 自动运行与两种模式

Workflow: `.github/workflows/thermoelectric-weekly.yml`

Schedule: every Monday at about **08:07 Australia/Brisbane** (GitHub cron `22:07 UTC` on Sunday).

行为规则：

- **Scheduled Monday run** → production，使用历史去重并保存新的历史。
- **Manual + production** → 与正式周报相同，使用并更新历史。
- **Manual + fresh_scan** → 无状态扫描，不读取或污染 production cache。
- **修改 `base.toml` / `research-directions.toml` / `researchers.toml` / workflow 后** → 自动 fresh validation，不污染正式历史。

Runtime 会自动拼接：

1. `configs/base.toml`
2. `configs/research-directions.toml`
3. `configs/researchers.toml`

生成 paper-digest 实际读取的 `config.toml`。

## 为什么周度回顾 / 阅读清单现在可能是 0

这些页面依赖 production 历史和 feedback 状态。刚部署时，如果还没有长期 production run，或者还没有给论文标记 `star / follow_up / reading / done / ignore`，这些页面显示 0 是正常的。

## Stock smoke test

早期的 **Paper Digest Thermoelectric Stock Smoke** workflow 保留作为最小基准测试。日常使用不需要点它，平时只用 **Thermoelectric Paper Digest Weekly**。

## Upstream pin

Production workflow pins the upstream paper-digest revision already validated by the stock smoke test:

`8906f9a12309956913eab29dade75c01cb7d0771`

Changing this pin is an explicit upstream upgrade and should be revalidated first.
