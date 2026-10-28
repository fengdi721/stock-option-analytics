# 年度财务比较：本地验收

核验日期：2026-10-28。本页是 V1 的离线导入/确定性计算增量验收，不是 V1 全部完成，也不是远程 CI 结果。

## 输入与来源

- Company Facts 官方端点：[Apple Company Facts](https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json)。本轮单次下载，原始内容仅保留本地 outputs/financial。
- downloadedAt：2026-10-28T22:23:42.865Z；byteLength：3789099。
- SHA-256：`73a86c6aedc31f77cac2ea4df5f80f0b3bd7e6eb58bb4e01444fbedf3afb9c43`。
- 明确请求：examples/financial-apple-annual.json。使用 2023/2024 原始 10-K accession，不自动取最新值。
- 原始 HTML 来源：[2023 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/aapl-20230930.htm)、[2024 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm)。对应本地字节 hash 见 [SEC 验收](SEC-VALIDATION.md)。

API 会随新披露更新；重新下载可能得到不同 hash/数组索引。这里只确认本次保存快照。本段下载动作是早期开发验收；后续正式下载/缓存产品接口验收记录在文末，两个下载时间不混用。未保存联系邮箱。

## 实际结果

金额单位为完整 USD；百分比为百分数，不是比例小数。

| 项目     | 2023（2022-09-25 至 2023-09-30） | 2024（2023-10-01 至 2024-09-28） | 差额 / 变化率          |
| -------- | -------------------------------- | -------------------------------- | ---------------------- |
| 营收     | 383285000000                     | 391035000000                     | +7750000000 / +2.02%   |
| 净利润   | 96995000000                      | 93736000000                      | -3259000000 / -3.36%   |
| 净利率   | 25.31%                           | 23.97%                           | 未输出净利率差额       |
| 期间天数 | 371                              | 364                              | unequal_period_lengths |

两个期间长度不同，增幅未作日数归一化。数值属于分别申报口径，不宣称会计政策完全可比或已完成重述对账。

在上述快照内，营收 JSON Pointer 的 USD 数组索引为 86/99；净利润为 307/320。完整路径分别为 `/facts/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax/units/USD/<index>` 与 `/facts/us-gaap/NetIncomeLoss/units/USD/<index>`。每个索引均核对 accession、start/end、值和 filed 日期。

## 已执行检查

1. CLI 对真实快照运行成功，输出保存于 outputs/financial/apple-comparison.json；源下载 metadata 在 download.json。
2. 独立读取已有两个 10-K 缓存，核对 HTML hash，然后按 Inline XBRL 中相同概念、非分部 context 的 start/end、USD unit、scale/sign 交叉核对上述四个值，全部一致。这是针对四个观测值的开发核验，不是产品内通用 Inline XBRL 解析器。
3. 用独立 Python Decimal 计算四个金额的差额、增幅与两期净利率，按两位 ROUND_HALF_UP 复算，结果一致。临时交叉核验脚本为 /tmp/stock-financial-crosscheck.py。
4. 将 fetch 替换为计数后抛错的函数，再通过 runCommand 执行同一离线比较：结果完全一致，networkCalls=0；证据为 outputs/financial/acceptance.json。
5. 完整 npm run check 通过，106 项离线测试；新增 CLI 测试包括确定性输出、文件 hash、错误 JSON/退出码、错误公司和文件大小限制。

## 本地复现

保留本次原始快照后执行：

```sh
node src/cli.ts financial-compare outputs/financial/73a86c6aedc31f77cac2ea4df5f80f0b3bd7e6eb58bb4e01444fbedf3afb9c43.json examples/financial-apple-annual.json
npm run check
```

新克隆不包含真实原文，可直接使用 README 中的合成示例运行。公开仓库只保留请求、来源和派生数值，不提交整份 Company Facts 快照。缺概念/币种不回退到其他标签；自定义 taxonomy、分部、季度、短过渡期、重述协调、历史时点数据和模型问答仍未实现。

## 正式下载与缓存增量验收

在空根目录 outputs/companyfacts-acceptance-8WhnBU 使用 retrieveCompanyFacts 获取同一 Apple 公司快照。结果：首次 cacheHit=false、1 次 HTTP 请求，downloadedAt=2026-10-28T22:37:48.769Z；byteLength 与 SHA-256 均与上文初次快照一致，但独立 manifest 保留此次真实获取时间。

随后把 fetch 替换为计数后抛错函数，在不提供 User-Agent 的情况下通过 runCommand 执行 companyfacts-validate、financial-compare-cached、companyfacts-fetch：验证成功，期间与计算结果与上文完全一致，再次获取 cacheHit=true，offlineRequests=0。记录保存在该根目录 acceptance.json，包含两次获取结果、离线验证结果和派生报告。原文与联系信息不进入 Git。

```sh
node src/cli.ts companyfacts-validate outputs/companyfacts-acceptance-8WhnBU/companyfacts/0000320193
node src/cli.ts financial-compare-cached outputs/companyfacts-acceptance-8WhnBU/companyfacts/0000320193 examples/financial-apple-annual.json
node src/cli.ts companyfacts-fetch 0000320193 outputs/companyfacts-acceptance-8WhnBU
```

本轮完整 check 为 119 项离线测试；13 项新测试覆盖公司快照获取、缓存与 CLI 集成。仍未运行本轮远程 CI，未实现自动刷新、重述对账、更多指标或模型报告。

## 2026-10-29：同期间对账增量验收

在隔离 worktree 的 feat/financial-reconciliation 分支，使用既有已验证 Company Facts 缓存（SHA-256 仍为上文 73a86c…b9c43），本轮未重新下载。请求 examples/financial-apple-reconciliation.json 固定 period=2022-09-25 至 2023-09-30，并指定 2023/2024 两份 10-K accession。

| 指标   | 原披露值 USD | 后披露值 USD | 差额 USD | 结果      | 原/后 USD 数组索引 |
| ------ | ------------ | ------------ | -------- | --------- | ------------------ |
| 营收   | 383285000000 | 383285000000 | 0        | unchanged | 86 / 87            |
| 净利润 | 96995000000  | 96995000000  | 0        | unchanged | 307 / 308          |

对应申报日分别为 2023-11-03 和 2024-11-01，chronology=ordered-by-filing-date。逐条解析输出 JSON Pointer，复核原始快照中的 val、accn、start/end、filed 和 form，均一致。注入计数并抛错的 fetch 后执行缓存对账，networkCalls=0。结果保留在本 worktree 忽略目录 outputs/reconciliation-apple.json；原始快照仍留在原 checkout，未复制或提交数据。

复现时从当前 worktree 运行，将 CACHE_DIR 指向之前下载的 companyfacts/0000320193 目录：

```sh
node src/cli.ts financial-reconcile-cached "$CACHE_DIR" examples/financial-apple-reconciliation.json
node src/cli.ts financial-reconcile fixtures/reconciliation.synthetic.json fixtures/reconciliation-request.json
npm run check
```

本轮完整检查 133 项通过，新增 14 项离线测试。真实验收只证明这两个指定指标没有数值差异；变化、修订件和失败路径使用合成测试验证，尚无真实正式重述案例验收。未运行远程 CI，未将数值对账写作全部重述分析或 V1 完成。

## 2026-10-29：显式经营活动净现金流验收

使用 examples/financial-apple-cash-flow.json，仅选择 operatingCashFlow，读取既有 Company Facts 缓存（完整 SHA-256 仍为 73a86c6aedc31f77cac2ea4df5f80f0b3bd7e6eb58bb4e01444fbedf3afb9c43），未重新下载。两期保持原 Apple 2023/2024 accession 与 start/end。

| 指标             | 2023 USD     | 2024 USD     | 差额 USD   | 变化率 |
| ---------------- | ------------ | ------------ | ---------- | ------ |
| 经营活动净现金流 | 110543000000 | 118254000000 | 7711000000 | 6.98%  |

JSON Pointer 为 `/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/113` 与 `/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/122`。逐条核对值、accn、start/end 与 10-K 表单；再对原始两份 HTML 验证 hash，按非分部 context、USD unit、scale/sign 与相同概念提取，数值一致。使用独立 Python Decimal 复算差额与两位增长率，结果一致。

注入失败 fetch 后通过缓存命令执行，networkCalls=0。报告保留于当前隔离 worktree 的 outputs/operating-cash-flow-apple.json。371/364 天差异仍输出 unequal_period_lengths；6.98% 是原始期间变化，未归一化。没有将经营活动现金流标为自由现金流。

```sh
node src/cli.ts financial-metrics-cached "$CACHE_DIR" examples/financial-apple-cash-flow.json
node src/cli.ts financial-metrics fixtures/metrics.synthetic.json fixtures/metrics-request.json
```

本增量完整 check 为 144 项离线测试，通过旧默认输出兼容、选择与数值/缺失/来源测试。PR #1 的远程检查与 main 集成检查此前均成功，但不覆盖这个后续本地现金流增量；新功能尚未推送。
