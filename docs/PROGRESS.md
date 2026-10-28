# 实际状态与后续任务

核验：2026-10-29。V0a 与 V0b 的限定范围已完成本地验收；工程质量门禁已通过本地验证。开发记录与 git log 为变更证据。此前工作已通过 PR #1 合并至 main，PR 与主分支 CI 均成功；当前 feat/operating-cash-flow 增量仅本地验证，不能继承此前远程结果。

## 已完成并验证

- [x] 精确整数美分损益、同标的/同到期日普通 call/put 组合与严格输入校验。
- [x] 合成 CSV、显式时点与 bid/ask 选价、来源 hash；原有两个 CLI 行为保留。
- [x] 领域/通用校验分隔；SEC 的纯契约、HTTP、缓存与编排分隔；CLI 入口与命令执行分隔。
- [x] SEC metadata 契约、固定 accession、受限下载、hash/长度/metadata 离线校验。
- [x] sec-fetch/sec-validate；Apple 2023/2024 两份 10-K 实际下载、离线校验及零网络重跑，见 [验收记录](SEC-VALIDATION.md)。
- [x] 格式检查、ESLint（0 warnings）、依赖边界/循环检查、类型检查与 144 项离线测试通过。真实 SEC 文件保留在忽略的本地缓存；合成测试与真实 metadata 分开。
- [x] CI 已推送；首次远程 Quality gate 通过，见开发记录。仓库已按授权公开，保护策略见 ADR 0010。

- [x] 本轮独立 SEC metadata 校验、输入对象隔离、完整纯模块/异步门禁；详见 [工程复核](ENGINEERING-REVIEW.md)。
- [x] 本轮再次验收真实空缓存首轮获取与零网络重跑，原始来源快照保留。

- [x] Husky + lint-staged 提交前检查：真实提交验证错误阻断、零 warning、格式与部分暂存恢复；CI 完整门禁保留，见 ADR 0013。

- [x] V1 年度财务核心：Company Facts 精确选值、差额/净利率、缺失与重述边界；CLI 已接通，完整 check 为 144 项离线测试。Apple 四个事实与原始 HTML/JSON Pointer 一致，差额与百分比经独立复算，零网络重跑通过；见 [财务验收](FINANCIAL-VALIDATION.md)。

- [x] Company Facts 正式获取、独立来源 manifest、完整性缓存与已验证字节比较；真实首次 1 请求，禁网验收与再次获取 0 请求。

- [x] 同期间营收/净利润数值对账：明确 accession/form、双方来源、差额与缺失，允许显式后续 10-K/A；Apple 同期间两次披露零差异、零网络验收。正式重述原因认定仍未实现。

- [x] 显式年度指标选择（营收、净利润、经营活动净现金流）；Apple 两期现金流与原始 HTML、API 指针和独立计算一致，零网络验收。旧默认输出不变。

## 后续计划（尚未实现）

1. V1：将显式指标选择接入同期间披露对账（含经营活动净现金流），保留旧默认输出；之后增加正式重述原因证据。
2. V1：财报检索与 Bedrock、固定问答评测、来源引用验证与缺失拒答。
3. 如需求出现，再扩展历史 submissions、修订件与缓存刷新策略，先记录 ADR。
4. UI、AWS 部署与预算/IaC/清理规则，待专门设计与授权。

当前没有实盘接口、实时行情订阅、回测引擎或云资源。完成 V0b 不代表完成后续财报分析产品。

## 当前循环检查点

- 状态：READY_FOR_NEXT_ITERATION；本轮已完成既有工作推送/合并，以及新一轮显式年度现金流比较。
- PR #1 已合并，main=ef01c16；PR Quality gate（40788749643）与 main push CI（40788934733）均成功。
- 当前分支：feat/operating-cash-flow；继续使用 managed worktree financial-reconciliation，从已合并 main 开发。
- 原 checkout 的未提交风格修改（含 ADR 0015）保留，未混入本分支。
- 下一轮唯一优先任务：将显式指标选择接入同期间披露对账（含 operatingCashFlow），保持旧两指标默认命令兼容，补来源与缺失/冲突验证。
- 无当前本地阻塞；付费模型调用、云部署仍需具体预算/账号授权。新现金流增量默认仅本地提交，不自动沿用本次对既有工作的 push/merge 授权。
