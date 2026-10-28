# 合成测试数据

所有 DEMO 标的、报价与持仓均为自制 synthetic 数据，不对应可交易证券或真实报价。

call-spread.json：买入 100 call 支付 5，卖出 105 call 收入 3，乘数 100，各腿总费用 1.30。净支出 200，费用 2.60。

独立手算预期：标的 90/100 → -202.60；102 → -2.60；105/110 → 297.40。此处为到期损益，不包含提前行权或税费。

companyfacts.synthetic.json 与 financial-request.json 是虚构 CIK/申报数据，仅用于离线财务 CLI 演示。营收 2000/2500 USD、净利润 100/250 USD；字段形状参考 Company Facts，不能冒充真实 SEC 数据。真实 Apple 请求另置 examples/financial-apple-annual.json。

reconciliation.synthetic.json 与 reconciliation-request.json 是同期间对账的合成例子：同一年度营收 2000 → 2100、净利润 100 → 90 USD，后披露 accession 与申报日期不同。它不是一宗真实公司的重述证据。

metrics.synthetic.json / metrics-request.json 为显式指标演示，包含独立合成的经营活动净现金流 300/450 USD，选择顺序为 operatingCashFlow、revenue；不代表真实公司数据。
