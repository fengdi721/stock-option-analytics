# 输入与运行说明

## payoff

参考 fixtures/call-spread.json。顶层字段必须为 currency、legs、prices。USD 金额一律使用非负十进制字符串，最多两位小数；没有隐式浮点/字符串转换。计算支持 1–20 腿、1–10000 个价格情景。

| leg 字段              | 说明                                                       |
| --------------------- | ---------------------------------------------------------- |
| symbol                | 大写标的符号，同一请求一致                                 |
| expiration            | 有效 YYYY-MM-DD，同一请求一致                              |
| type / side           | call 或 put；long 或 short                                 |
| strike / premium      | 每股行权价 / 已指定每股权利金                              |
| quantity / multiplier | 1–100000 的整数，数量 / 每份合约乘数                       |
| feesPerContract       | 每份合约分摊的总费用，非负 USD 字符串；不再乘以 multiplier |

输入价格上限 999999999.99，累计结果不受此输入上限限制。场景允许历史日期，因为是可重复计算，并不是可交易性检查。输入不支持 NaN、Infinity、负数或 sub-cent 金额。

## quote-payoff

参考 fixtures/quotes.synthetic.csv 与 fixtures/quote-request.json。请求的 legs 不包含 premium，由 CSV 按 long=ask、short=bid 填充。currency、prices 与 payoff 一致，另含 asOf 和 maxQuoteAgeSeconds（0–86400）。asOf 是分析时点，不是机器当前时间。输出来源标签 synthetic / user-provided 是数据声明，不代表已验证数据授权或真实性。

CSV 固定列：symbol,expiration,type,strike,bid,ask,quote_at,multiplier,source。无引号、无空字段、无额外列；UTC 时间必须为 YYYY-MM-DDTHH:mm:ssZ。支持 LF/CRLF。拒绝重复合约、交叉报价、未来/陈旧数据及缺失合约。整个快照都经过校验，而不只是选中的合约。

输出 rows 包含每个标的价格下的逐腿内在价值、毛损益、费用、净损益及组合净损益。quote-payoff 另含 provenance：时间基准、选价假设、来源及快照 SHA-256。不要把价格网格最大值/最小值当作全局最大收益/亏损。

## 重现和排错

首次执行 npm ci 安装开发依赖，再执行 npm run check，再运行示例。文件不存在、JSON 无效或模式错误会返回非零状态和 error 消息。payoff 与 quote-payoff 不读环境变量、不访问网络；SEC 下载需要识别信息，但不需要券商或模型 API key。

如需保存输出，先创建 outputs 目录，再把直接 node 命令的 stdout 重定向至其中；outputs 被 Git 忽略。不要将用户真实持仓替换到公开合成 fixtures 中。

## SEC 两期财报

固定请求示例：examples/sec-apple-annual.json（Apple 2023/2024 10-K，非合成标的）。首次联网需要由你在本地设置识别信息，以下 email 是占位符：

```sh
export SEC_USER_AGENT='YourApplication your-contact@example.com'
node src/cli.ts sec-fetch examples/sec-apple-annual.json outputs/sec
node src/cli.ts sec-validate outputs/sec/0000320193/0000320193-23-000106_0000320193-24-000123
```

sec-fetch 输出 cacheHit、directory、manifest。第二次执行会完全离线校验后返回 cacheHit=true，不需要 User-Agent；sec-validate 始终不联网。输入只含十位 cik 和恰好两个不同的 accessions。两期必须同公司、同 form（原始 10-K 或 10-Q）、不同 periodEnd；当前只在 submissions recent 中查找。

缓存包含 manifest.json 与三个原始响应 blob（submissions JSON、两份 HTML，内容相同时按 hash 共用文件）。manifest 保存来源 URL、期间、filingDate、UTC 下载时间、字节长度和 SHA-256；不保存联系邮箱。filedAt 是日精度的申报日期，不是精确公开时间。

每次命中复核所有文件；损坏时返回错误，不自动下载。要重新下载，保留或移动原缓存后使用新的 cache-root。遗留 .lock 仅在确认没有活动下载时移除。不要通过并行运行大量进程绕过 SEC 总请求限制；内置 250 ms 间隔只覆盖单次调用。429 与部分 5xx 做有限退避，长 Retry-After 要求稍后重试；403 不重试。

原始文件在被 Git 忽略的 outputs 中，测试使用合成内容，不连接 SEC。下载内容只作为数据处理，不执行其中脚本，也不从该步骤推定全文再分发权。

## 离线年度财务比较

```sh
node src/cli.ts financial-compare fixtures/companyfacts.synthetic.json fixtures/financial-request.json
```

命令接受本地 SEC Company Facts JSON（最多 25 MB）与明确期间请求（最多 2 MB），不联网、不需要 SEC_USER_AGENT。请求字段只有 cik 和 periods，periods 是由旧到新的两个 `{accession, start, end}`；日期必须合法，两个年度期间连续、各为 350–380 天。示例真实请求是 examples/financial-apple-annual.json。财务快照与 V0b 的 HTML 缓存不同，不可将 manifest 或 HTML 当作此命令的输入。

只提取 us-gaap 的 RevenueFromContractWithCustomerExcludingAssessedTax 与 NetIncomeLoss，限定 USD、10-K、精确 accession/start/end；不凭 fy/fp/frame 猜测，不自动选择后续重述。未支持的概念、单位或期间返回 missing 与原因；冲突事实及不安全/非整数金额拒绝。输入值是完整美元，不是页面显示的“百万美元”。输出金额使用整数字符串，与期权命令的两位小数金额格式不同。

输出分为事实（periods 中的 revenue/netIncome）、计算（净利率、差额、百分比变化）与 provenance。每项事实含 Company Facts JSON Pointer、accession 与申报日。percentageDecimals=2，百分比四舍五入到两位（恰半时远离零）；缺失值不补零，旧值非正时不输出百分比变化，营收非正时不输出净利率。不同天数会返回 unequal_period_lengths；不会按天数调整数据。

provenance 保存输入文件的 SHA-256、原始字节长度和 expectedSourceUrl。这个 URL 是根据 CIK 推导的预期 API 地址，**不是来源认证**；文件 hash 也不能证明输入真实。basis=as-filed 只表示指定 accession 的申报口径，不代表已核对最新重述或历史时点可用性。源 JSON 解析后的金额必须为安全整数；尚不支持小数金额及超安全整数的 JSON 数值。

普通测试只用合成事实；真实快照的下载与验收记录见 [FINANCIAL-VALIDATION](FINANCIAL-VALIDATION.md)。Company Facts 自动下载、独立来源 manifest 与缓存流程尚待实现，模型报告与问答也未接入。
