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

Artifact 解压后，GitHub 会直接把 `output/` 里面的内容放到根目录，所以你通常会直接看到：

- `index.html` — **最方便，双击直接看网页版**。
- `latest.md` — 本次 Markdown 周报。
- `latest.json` — 原始结构化数据。
- `weekly-review.html` / `reading-list.html` / `trends.html` — 历史与反馈相关页面。

## 你以后主要改哪两个文件

### 1. 改研究方向 / 材料体系 / 关键词

**直接编辑：`configs/research-directions.toml`**

这个文件就是专门给你改研究兴趣的，里面已经拆成：

- `HIGH PRIORITY - High-impact Thermoelectrics`
- `PRIORITY - Doping Optimization and Transport`
- `PRIORITY - Thermoelectric ML and Composition`
- `PRIORITY - Material Systems`
- `Fresh Thermoelectric Preprints`
- `Flexible and Thermoelectric Devices`
- `Broad Thermoelectric Journals`

目前已经重点覆盖：

- thermoelectric ML / materials informatics
- composition → property prediction
- doping optimization
- carrier concentration optimization
- weighted mobility / quality factor / B factor
- band convergence / resonant level / bipolar conduction
- Bi2Te3 / GeTe / PbTe / SnSe / Ag2Se / Mg3Sb2 / half-Heusler / skutterudite

想加新方向时，最简单就是在对应 `queries = [...]` 或 `keywords = [...]` 里增加一行。

### 2. 关注研究者

**直接编辑：`configs/researchers.toml`**

文件里已经放了一个完整模板。做法：

1. 复制模板 block。
2. 把每行前面的 `#` 去掉。
3. 把 `Full Name` 换成研究者真实姓名。
4. 提交。

例如会变成 `queries = ["Researcher Name thermoelectric", ...]`。

注意：stock paper-digest 0.4.1 **没有严格 author-ID 过滤字段**，所以这里是 OpenAlex 的“姓名 + thermoelectric”查询式监控，不是 100% 严格作者身份过滤。

## 为什么现在更强调高质量文章

`configs/research-directions.toml` 的第一组是 **HIGH PRIORITY**。它用 Crossref bibliographic query 把 thermoelectric 与这些期刊名称组合检索：

- Advanced Materials
- Advanced Functional Materials
- Advanced Energy Materials
- Energy & Environmental Science
- Joule
- Matter
- ACS Energy Letters
- Nature Communications
- Science Advances
- Nano Energy
- Chemistry of Materials
- Acta Materialia
- Scripta Materialia
- Small
- Journal of Materials Chemistry A

原版 paper-digest 没有 `journal = ...` 这种严格 venue filter，所以这个是**高优先级 discovery stream**，不是保证每篇一定来自该期刊。我们用 fresh scan 实际检查结果质量。

同时 Broad Journal feed 已经收窄，避免普通文章把首页占满。

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
