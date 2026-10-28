# ADR 0014：离线年度财务事实与确定性比较

日期：2026-10-28。状态：Accepted。V1 的首个增量，不改变 V0b manifest 或期权金额契约。后续正式下载与缓存由 ADR 0016 补充，本记录保留首个增量的边界。

## 背景

原始 SEC HTML 已缓存，但尚无数值提取与比较能力。不能用正则猜测报表结构、把最近披露值当历史时点数据，或在财务期间、单位、重述和缺失处理之前让模型生成结论。

## 决定

采用 SEC Company Facts JSON 作为首个结构化输入。它与已缓存的原始财报是不同的来源快照，不能把两者的 hash 或下载时点混用。按显式十位 CIK 与两个 accession、完整 start/end 选择 us-gaap 中的 RevenueFromContractWithCustomerExcludingAssessedTax（营收）和 NetIncomeLoss（净利润）。只选原始 10-K、USD、指定期间和 accession；不用 fy/fp/frame 推断期间，不混入其他 accession 或修订件，不猜测其他 revenue 标签。

输入必须是按时间排序且连续的两个 350–380 天年度期间，覆盖普通年和 52/53 周年；短过渡期与季度另行支持。basis=as-filed 表示分别使用指定 accession 内披露的值，不表示最新重述口径或历史可交易时点。相同值/申报日的重复事实保留全部 JSON Pointer；值或日期冲突报错，不随意挑一条。缺概念、USD 单位或匹配期间分别返回 missing 原因，计算缺失传播，不用零填补。

财报金额是 USD 整数，由安全整数 JSON number 转为 BigInt，再输出整数字符串；拒绝非整数、非有限和不安全整数，不与期权的美分范围混用。精确计算差额；百分比保留两位、五入远离零，用整数运算实现。百分比变化只在旧值为正时提供，净利率只在营收为正时提供；负净利润仍合法。不同期间长度产生 warning，差额/百分比不按天数归一化，也不作会计口径一致性证明。

financial/contracts 管请求与结果类型，companyfacts 负责来源结构/事实选择，comparison 负责计算；均无 I/O。依赖方向 financial → SEC 公共 contracts/shared，自身可互相依赖但不得循环；禁止访问 SEC 缓存、HTTP、期权内部实现与 CLI。现有功能不反向依赖 financial，ESLint 与 dependency-cruiser 执行约束。CLI 负责有界文件读取、快照 hash 和 JSON 输出；不引入框架或新运行时依赖。

## 替代与限制

直接解析 Inline XBRL 需要完善处理 namespace、context、dimension、unit、scale、sign、nil 与变换规则，不能用小型正则替代。Company Facts 仅覆盖标准 taxonomy 的实体整体事实，不覆盖自定义指标/分部；它是不断更新的聚合 API，需要保存实际字节才能复现。输入 hash 与 JSON Pointer 只能证明所给文件内的来源一致性，不能独立证明文件来自 SEC，不能证明原始申报 HTML 与 API 数值一致。

首个命令仅离线导入；Company Facts 的产品化下载、来源 manifest、缓存验收仍待后续增量。此次真实快照下载仅作本地开发验收，放入忽略目录，不能声明复用 V0b 缓存协议。Bedrock、检索、问答评测和重述对账未实现。

## 依据与验证

核对 [SEC API 官方文档](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)（2026-10-28）：Company Facts 端点、按 unit 分组、标准 taxonomy/实体整体限制、API 更新与财务期间差异。未复制第三方实现。

离线合成测试验证独立手算差额/百分比、负值/零、舍入、超安全整数差额、重复冲突、缺失与单位、不混入后续披露/季度/修订、52/53 周以及坏输入。真实验收与完整检查分别记录在 DEVELOPMENT 和 FINANCIAL-VALIDATION；合成测试不联网、不依赖本地下载。
