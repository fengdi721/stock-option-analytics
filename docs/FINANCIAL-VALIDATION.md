# 年度财务比较：本地验收

核验日期：2026-10-28。本页是 V1 的离线导入/确定性计算增量验收，不是 V1 全部完成，也不是远程 CI 结果。

## 输入与来源

- Company Facts 官方端点：[Apple Company Facts](https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json)。本轮单次下载，原始内容仅保留本地 outputs/financial。
- downloadedAt：2026-10-28T22:23:42.865Z；byteLength：3789099。
- SHA-256：`73a86c6aedc31f77cac2ea4df5f80f0b3bd7e6eb58bb4e01444fbedf3afb9c43`。
- 明确请求：examples/financial-apple-annual.json。使用 2023/2024 原始 10-K accession，不自动取最新值。
- 原始 HTML 来源：[2023 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/aapl-20230930.htm)、[2024 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm)。对应本地字节 hash 见 [SEC 验收](SEC-VALIDATION.md)。

API 会随新披露更新；重新下载可能得到不同 hash/数组索引。这里只确认本次保存快照。下载动作是开发验收，不是已实现的 Company Facts 下载/缓存产品接口；未保存联系邮箱。

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
