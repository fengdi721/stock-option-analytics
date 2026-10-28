# ADR 0018：显式指标选择与年度经营活动净现金流

日期：2026-10-29。状态：Accepted。补充 ADR 0014/0017；保留已有命令默认契约。

## 背景

原年度比较默认输出 revenue、netIncome 与净利率。直接增加现金流字段会悄悄扩大默认输出，也容易把不同 cash flow 概念混在一起。需要可复用的精确计算和明确的指标选择，不引入任意 taxonomy 查询语言。

## 决定

新增 financial-metrics / financial-metrics-cached，请求在既有 cik/periods 之外必须提供 metrics，选择一至三个不重复指标，保留请求顺序。固定支持 revenue、netIncome、operatingCashFlow，分别映射到 us-gaap 的 RevenueFromContractWithCustomerExcludingAssessedTax、NetIncomeLoss、NetCashProvidedByUsedInOperatingActivities。拒绝未知/继承属性名、重复、空值和稀疏选择；不隐式补齐指标，不根据名称猜测替代概念。

每项结果包含 metric、concept、按 periods 顺序排列的 observations（事实与引用）、change（差额及百分比）。新命令有独立 schemaVersion=1、basis=as-filed-selected-metrics；旧 financial-compare / financial-reconcile 的请求与默认输出不变。新选择契约暂用于年度比较；同期间对账的显式指标选择留待下一增量。

metrics-contracts 负责固定映射与选择校验，companyfacts 复用现有事实选择器，selected-metrics 编排纯比较；calculations 模块实现既有缺失、差额和舍入规则。没有新运行时依赖，也不增加通用注册器、DI 或重复模型。模块仍受纯核心与依赖方向检查。

沿用精确 accession、年度 start/end、10-K、USD 整数与 JSON Pointer。经营活动净现金流可为负，不取绝对值，也不冒充自由现金流。差额用 BigInt；百分比两位、恰半远离零，前期为零/负时返回 unavailable。缺失、币种不符与冲突保持原有拒绝/缺失语义；不同期间长度提示仍保留，不做日数归一化。

## 替代与代价

增加新命令使 CLI 入口增多，但避免现有消费者收到额外默认字段。允许任意 concept/unit 会把指标定义责任推给每个调用者，并扩大未经验证的范围，因此首版只提供固定目录。当前不计算指标间比率，净利率仍由旧年度比较提供；扩展指标必须补来源口径、独立数值及兼容性证据。

## 验证

离线测试覆盖独立手算现金流差额与增长率、负值、缺失与单位、显式选择顺序/隔离、精确数值、其他期间/申报隔离、冲突、坏选择及旧输出兼容。缓存/裸文件 CLI 沿用来源 hash 与完整性语义。真实 Apple 两期现金流已和保存的原始 10-K 及 API 索引交叉核验，Decimal 独立复算，禁网运行；详见 FINANCIAL-VALIDATION。
