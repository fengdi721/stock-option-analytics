# 开发记录

日期均按 Europe/Paris。记录每次实际交付；提交 hash 以 Git log 为准，避免在提交中引用自身 hash。

## 2026-10-28 · 01 文档基线

- 检查目标目录：已有空 Git 仓库、main 分支、配置个人 origin，尚无提交。
- 建立需求、阶段边界、架构与 ADR 0001。
- 验证：读取 Node v24.20.0 / npm 11.19.0；此时尚无应用测试。
- 下一步：固定金额表示及纯计算接口，实现手算测试。

## 2026-10-28 · 02 计算核心

- 增加 USD 字符串/BigInt 核心、严格运行时校验、同标的同到期日约束、合成 call spread 和 ADR 0002。
- 初轮 17 项测试通过；复核发现把大额结果送回输入解析器会触发输入上限，改为直接累计内部 BigInt，并添加大额回归测试。
- 最终验证：npm test，18 项通过；无外部依赖，无网络调用。尚未执行静态类型检查。
- 下一步：CLI、严格 CSV 适配与错误路径。

## 2026-10-28 · 03 快照与 CLI

- 增加严格 CSV 契约、快照时点与年龄校验、bid/ask 选价、来源与 SHA-256，以及两个离线 CLI 命令。
- 补 ADR 0003 和输入文档。原始合成报价可复现直接持仓的手算结果。
- 验证：npm test，32 项通过，包含真实子进程 CLI 成功、缺文件、非法 JSON、错误参数与 help。
- 限制：快照不是历史数据集；无真实行情、SEC 下载或 Bedrock 调用。下一步完善静态检查和 CI。

## 2026-10-28 · 04 工具链和交付检查

- 安装项目本地开发依赖并锁定版本：TypeScript 7.0.2、@types/node 24.19.2。运行时仍无第三方依赖。
- 添加 strict/noEmit 配置、npm run check 和只读权限 GitHub Actions，新增 ADR 0004。
- 验证：npm run check 通过（类型检查与 32 项测试）；npm 安装报告当时 0 vulnerabilities；这不是全面安全审计。git diff --check 通过。
- 文档明确区分 V0a 完成与财报/模型/云部署待办；当前只做本地提交，没有推送和远程 CI 结果。

## 2026-10-28 · 05 SEC metadata 契约

- 重新读取项目约定与全部 ADR，确认工作树干净、最近提交为 f64bcb7；基线 npm run check 为 32 项通过。
- 新增固定 CIK/accession 请求、两期同表单 manifest、严格日期/URL/字节长度/hash 校验及 ADR 0005。
- 验证：npm run check 通过（类型检查与 48 项测试）；git diff --check 通过。测试全部离线，新增数据为合成 metadata。
- 尚未实现网络下载与磁盘缓存，真实财报验收仍待完成。

## 2026-10-28 · 06 领域模块边界

- 恢复时工作区有 SEC 下载与缓存草稿；重新执行基线检查，65 项测试通过。
- 将通用运行时校验、精确金额、合约与场景解析从 payoff 中分隔；CSV 直接依赖这些明确接口。新增 ADR 0006。
- 边界解析构造已验证的领域值；测试不再使用 any。补充继承字段与稀疏数组被拒绝的回归。
- 验证：领域/CSV 定向测试 30 项通过；本地 typecheck 与定向 ESLint 通过，git diff --check 通过。ESLint 工具链尚在本轮工作区中准备，单独后续提交；本提交不宣称完整门禁已接入。

## 2026-10-28 · 07 SEC 获取与离线缓存

- 将先前下载草稿拆为明确模块，添加 canonical URL/MIME 检查、受限下载/重试、原子 manifest、锁与命中复核。CLI 入口分离命令执行，并新增 sec-fetch/sec-validate。
- 新增 ADR 0007；hash 实现从纯 contracts 移到 integrity。测试继续使用合成 metadata/HTML，普通检查不访问 SEC。
- 验证：npm run check 通过（类型检查与 69 项测试）；git diff --check 通过。retrieval 定向 20 项通过，涵盖缓存损坏、重试、竞争锁及请求顺序变化。
- 真实验收：以用户提供的 User-Agent 从 SEC 获取 Apple 2023/2024 原始 10-K，离线 sec-validate 成功；注入会失败的 fetch 重跑 cacheHit=true、网络调用计数 0。原始文件保留在忽略的 outputs/sec。
- 限制：只支持 recent submissions；限速是单调用范围；不解析财务指标。可分享的 metadata 与重现记录在后续独立提交保存。

## 2026-10-28 · 08 真实 Apple 来源记录

- 单独保存两期固定 accession 请求与实际来源 manifest；新增 SEC-VALIDATION 记录下载、离线核验和零网络重跑的可复现命令。
- 2023/2024 HTML 分别 1559035 / 1503891 字节，SHA-256 见 manifest；submissions 快照为 163917 字节。真实下载 UTC 时点为 21:09:29–21:09:30（Paris 22:09）。
- 原始文件未提交，联系信息未写入仓库；合成 fixture 保持独立。进度与路线明确 V0b 限定验收已完成，财务指标/模型/云能力仍是计划。
- 验证：前一步 npm run check 为 69 项通过；本步只新增 metadata/文档并核对与已验证本地缓存一致，git diff --check 通过。
