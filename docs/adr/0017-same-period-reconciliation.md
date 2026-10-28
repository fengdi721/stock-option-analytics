# ADR 0017：同期间披露数值对账

日期：2026-10-29。状态：Accepted。补充 ADR 0014，不改变原年度比较与缓存 schema。

## 背景

两期年度比较只能回答不同期间的差额，不能说明同一期间在后续申报中如何披露。直接取“最新”会掩盖原始值，单凭数值差异也不能判断是正式重述、重分类、标签变更还是源数据问题。

## 决定

新增 financial-reconcile 与 financial-reconcile-cached；请求明确一个 cik、一个年度 period(start/end) 和两个不同 filings(accession/form)。首份必须是 10-K，第二份允许显式 10-K 或 10-K/A；不搜索最新申报、不自动包含修订件。沿用年度 350–380 天、精确 USD 安全整数及固定 us-gaap 营收/净利润概念范围。

companyfacts 的已有事实选择器增加显式 form 参数，旧年度比较仍固定默认 10-K；解析/冲突拒绝逻辑共用，不复制第二套提取器。reconciliation 为纯计算模块，输出双方事实/JSON Pointer/申报日以及 changed、unchanged 或 unavailable。差额为后披露值减原披露值，以 BigInt 计算并输出完整 USD 整数字符串；任何一方缺失时不产生差额，不用零或 unchanged 填补。

选中事实提供每份申报的日精度 filedAt。一个 accession 内不同指标的申报日冲突即拒绝；后份申报日早于原份时拒绝；同日标记 same-day-order-unverified，不推断日内顺序。无可用事实就保留 filedAt=null、chronology=unavailable，不凭 accession 年份或请求位置编造日期。

结果固定 interpretation=numeric-disclosure-comparison-only：changed 仅表示指定两个披露值不同；unchanged 仅表示所选指标数值相同。两者都不构成全份财报是否正式重述的结论。正式原因认定、跨 taxonomy/单位转换及会计政策协调仍需后续来源证据。

CLI 复用现有裸快照有界读取/hash 与缓存加载后的同一份已验证字节，不改变既有命令的参数、结果或错误协议。纯模块的架构与全局 I/O 禁止规则自动覆盖 reconciliation，无新增运行时依赖。

## 替代与代价

把两期比较的旧请求直接扩成混合模式会模糊“同比”与“同期间修订”的含义；新命令保持用途与契约明确。自动挑选 latest、仅保留差额或自动给差异贴 restated 标签会丢失证据边界，因此不采用。首版只对账两个既有标准概念，后续扩展仍须保留原值、后披露值、单位和来源。

## 验证

离线测试覆盖正负精确差额、相同值、缺失、显式 10-K/A、无关期间/accession 隔离、冲突、申报日顺序与同日限制、严格请求、输入对象隔离、CLI 协议和缓存损坏拒绝。真实 Apple 2023 年度在 2023/2024 两份 10-K 中的营收/净利润均一致；该观测不代表真实重述案例。验收、限制及下一轮任务见开发日志和 FINANCIAL-VALIDATION。
