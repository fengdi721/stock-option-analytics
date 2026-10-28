# 输入与运行说明

## payoff

参考 fixtures/call-spread.json。顶层字段必须为 currency、legs、prices。USD 金额一律使用非负十进制字符串，最多两位小数；没有隐式浮点/字符串转换。计算支持 1–20 腿、1–10000 个价格情景。

| leg 字段 | 说明 |
|---|---|
| symbol | 大写标的符号，同一请求一致 |
| expiration | 有效 YYYY-MM-DD，同一请求一致 |
| type / side | call 或 put；long 或 short |
| strike / premium | 每股行权价 / 已指定每股权利金 |
| quantity / multiplier | 1–100000 的整数，数量 / 每份合约乘数 |
| feesPerContract | 每份合约分摊的总费用，非负 USD 字符串；不再乘以 multiplier |

输入价格上限 999999999.99，累计结果不受此输入上限限制。场景允许历史日期，因为是可重复计算，并不是可交易性检查。输入不支持 NaN、Infinity、负数或 sub-cent 金额。

## quote-payoff

参考 fixtures/quotes.synthetic.csv 与 fixtures/quote-request.json。请求的 legs 不包含 premium，由 CSV 按 long=ask、short=bid 填充。currency、prices 与 payoff 一致，另含 asOf 和 maxQuoteAgeSeconds（0–86400）。asOf 是分析时点，不是机器当前时间。输出来源标签 synthetic / user-provided 是数据声明，不代表已验证数据授权或真实性。

CSV 固定列：symbol,expiration,type,strike,bid,ask,quote_at,multiplier,source。无引号、无空字段、无额外列；UTC 时间必须为 YYYY-MM-DDTHH:mm:ssZ。支持 LF/CRLF。拒绝重复合约、交叉报价、未来/陈旧数据及缺失合约。整个快照都经过校验，而不只是选中的合约。

输出 rows 包含每个标的价格下的逐腿内在价值、毛损益、费用、净损益及组合净损益。quote-payoff 另含 provenance：时间基准、选价假设、来源及快照 SHA-256。不要把价格网格最大值/最小值当作全局最大收益/亏损。

## 重现和排错

先执行 npm test，再运行示例。文件不存在、JSON 无效或模式错误会返回非零状态和 error 消息。首版不读环境变量、不访问网络，也不需要券商或模型 API key。

如需保存输出，先创建 outputs 目录，再把直接 node 命令的 stdout 重定向至其中；outputs 被 Git 忽略。不要将用户真实持仓替换到公开合成 fixtures 中。
