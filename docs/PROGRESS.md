# 实际状态与后续任务

核验：2026-10-28。V0a 与 V0b 的限定范围已完成本地验收；工程质量门禁已通过本地验证。开发记录与 git log 为变更证据。本轮本地分支未推送，先前 main 的远程 CI 不能视为本轮验证。

## 已完成并验证

- [x] 精确整数美分损益、同标的/同到期日普通 call/put 组合与严格输入校验。
- [x] 合成 CSV、显式时点与 bid/ask 选价、来源 hash；原有两个 CLI 行为保留。
- [x] 领域/通用校验分隔；SEC 的纯契约、HTTP、缓存与编排分隔；CLI 入口与命令执行分隔。
- [x] SEC metadata 契约、固定 accession、受限下载、hash/长度/metadata 离线校验。
- [x] sec-fetch/sec-validate；Apple 2023/2024 两份 10-K 实际下载、离线校验及零网络重跑，见 [验收记录](SEC-VALIDATION.md)。
- [x] 格式检查、ESLint（0 warnings）、依赖边界/循环检查、类型检查与 119 项离线测试通过。真实 SEC 文件保留在忽略的本地缓存；合成测试与真实 metadata 分开。
- [x] CI 已推送；首次远程 Quality gate 通过，见开发记录。仓库已按授权公开，保护策略见 ADR 0010。

- [x] 本轮独立 SEC metadata 校验、输入对象隔离、完整纯模块/异步门禁；详见 [工程复核](ENGINEERING-REVIEW.md)。
- [x] 本轮再次验收真实空缓存首轮获取与零网络重跑，原始来源快照保留。

- [x] Husky + lint-staged 提交前检查：真实提交验证错误阻断、零 warning、格式与部分暂存恢复；CI 完整门禁保留，见 ADR 0013。

- [x] V1 年度财务核心：Company Facts 精确选值、差额/净利率、缺失与重述边界；CLI 已接通，完整 check 为 119 项离线测试。Apple 四个事实与原始 HTML/JSON Pointer 一致，差额与百分比经独立复算，零网络重跑通过；见 [财务验收](FINANCIAL-VALIDATION.md)。

- [x] Company Facts 正式获取、独立来源 manifest、完整性缓存与已验证字节比较；真实首次 1 请求，禁网验收与再次获取 0 请求。

## 后续计划（尚未实现）

1. V1：扩展指标覆盖与重述对账，保留按 accession/期间精确选择。
2. V1：财报检索与 Bedrock、固定问答评测、来源引用验证与缺失拒答。
3. 如需求出现，再扩展历史 submissions、修订件与缓存刷新策略，先记录 ADR。
4. UI、AWS 部署与预算/IaC/清理规则，待专门设计与授权。

当前没有实盘接口、实时行情订阅、回测引擎或云资源。完成 V0b 不代表完成后续财报分析产品。
