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

## 2026-10-28 · 09 SEC 请求边界回归

- 复核发现 Array.forEach 会跳过稀疏数组空位，程序调用 parseRequest 时可能把缺失 accession 当作有效请求；JSON 输入无法表达该空位，但导出函数仍须拒绝。
- 改为逐项校验两个 tuple 位置，新增有明确错误预期的回归，并统一所触及两个文件的格式。
- 验证：本地完整 npm run check（含准备中的格式/lint/依赖门禁）通过，70 项测试全绿；git diff --check 通过。工具链配置将在后续独立提交。

## 2026-10-28 · 10 统一代码格式

- 独立应用 Prettier 到源码、测试、JSON 示例和 tsconfig；统一大括号、换行与排版，避免和业务变更混在一起。
- 验证：本地完整 npm run check 通过（格式、零 warning lint、依赖边界、类型、70 项测试）；git diff --check 通过。工具配置与 lockfile 下一提交交付。

## 2026-10-28 · 11 工程质量门禁

- 接入 ESLint flat config + 类型感知推荐规则、独立 Prettier、eslint-config-prettier 与 dependency-cruiser；配置 EditorConfig 和忽略原始缓存。新增 ADR 0008，标明 ADR 0004 的工具链版本已被后继更新。
- 根据实际 peerDependencies 将本地 TypeScript 从 7.0.2 调整为受支持的 6.0.3，精确锁定开发依赖；未强制安装或屏蔽版本警告。运行时仍无第三方依赖。
- npm run check 统一格式、lint（零 warning）、依赖边界/循环、类型检查与测试；CI 原有 npm ci + check 自动采用同一门禁。贡献指南补充实际可执行的编码规则，架构图与当前进度同步。
- 验证：npm ci --offline --no-audit 根据 lockfile 从本地缓存重装成功；随后完整 npm run check 通过，70 项测试全绿，19 个模块/32 条依赖无违规；git diff --check 通过。npm ls --depth=0 无 peer 错误。此前安装时 npm audit 报告 0 vulnerabilities，不等于全面安全审计。
- 规则反例实测：临时构造纯领域导入 node:fs、依赖循环、不安全 JSON.parse 赋值、未处理 Promise，门禁分别拒绝；反例文件已清除。确认 curly=all 最终生效，避免被 prettier 冲突配置覆盖。
- 实际完成 V0b 与工程基线的本地验收。仍未推送或获得远程 CI 结果；财务指标、检索、Bedrock 与云部署继续列为未实现计划。

## 2026-10-28 · 12 远程 CI

- 配置 PR 到 main、push main 和手动触发，取消同 PR 旧运行；只读权限、安装锁定依赖、完整离线质量门禁与超时。
- 远程原为空私有仓库。分支保护 API 返回套餐限制 403，无法宣称已强制 required checks；保留私有设置。
- 新增 ADR 0009；实际远程执行结果以 GitHub Actions 为准。

## 2026-10-28 · 13 首次远程验收

- 已初始化并推送私有 origin/main；首次远程 CI https://github.com/fengdi721/stock-option-analytics/actions/runs/40771479943 全部通过（Quality gate 23 s）。本地完整门禁也已通过，70 项测试。
- 处理首次运行的 Action Node20 弃用提示：checkout/setup-node 更新 v6 并锁定 GitHub 实际解析的完整 SHA，runner 固定 ubuntu-24.04，避免 ubuntu-latest 系统迁移。
- 保留 main push 验证及 PR opened/synchronize/reopened 验证；PR 后续提交仍触发检查，功能分支无 PR 的 push 不触发。
- 分支保护仍因私有仓库套餐返回 403 而未启用；未修改可见性、未订购套餐。PR 事件配置已部署，尚未创建测试 PR。

## 2026-10-28 · 14 公开前检查与可见性

- 按用户明确授权扫描全部 13 个历史提交、129 个 blob；所检查秘密模式零命中，核验缓存与联系邮箱未提交，Git 作者身份保留。扫描有识别范围限制。
- GitHub API 实测 visibility=public、private=false。新增 ADR 0010，保留未选择开源许可证的状态。
- 最新已验证远程 CI 为 4130a3c 的 Quality gate 成功。计划在本记录推送后启用 main 的 PR、指定 Actions 检查、最新分支、管理员约束与禁止强推/删除，并回读验证。

## 2026-10-28 · 15 恢复基线与 SEC 校验边界

- 重新读取要求中的全部文档、ADR、代码和 CI；未发现适用 AGENTS.md。恢复时 main/caf7246 干净，Node 24.20.0 / npm 11.19.0；npm run check 基线 70 项通过，npm ls 无 peer 错误。原有本地工具与运行方式满足要求，未重复安装或升级依赖。
- 在本地 refactor/sec-validation-boundaries 分支增量修正：独立 metadata 校验替代临时 manifest，解析返回独立构造的类型值；共享 artifact 大小契约。新增 ADR 0011，保留原有输入输出 schema 与缓存。
- 验证：完整 npm run check 通过，76 项测试全绿；git diff --check 通过。新增回归针对 metadata 拒绝时机和调用方修改输入，不为排版增加测试。
- 本轮按用户要求只做本地提交；未推送，不宣称远程 CI 验证本轮代码。下一步补全纯模块自动约束并复核真实 SEC 缓存。

## 2026-10-28 · 16 完整纯模块门禁

- 扩展依赖检查覆盖 SEC content/submissions；纯模块的全局/常见 globalThis 网络与环境访问由 ESLint 约束。生产源码禁止用 void 绕过未处理 Promise 规则，测试注册仍由 node:test 处理。
- 新增 ADR 0012；贡献规则与架构文档说明静态约束的范围，未引入框架、目录层或依赖升级。
- 验证：完整 npm run check 通过，76 项测试；五组模块的裸全局/限定全局反例、两种 SEC 纯模块 Node 导入、生产 void Promise 均被拒绝；临时反例已清除，git diff --check 通过。
- 本轮仍仅本地提交，远程 CI 不代表已验证这些新规则。

## 2026-10-28 · 17 本轮工程复核与 V0b 复验

- 新增 ENGINEERING-REVIEW，列出实际位置、P2 优先级、影响、修复与证据；修复 ADR 索引的表格结构，同步进度/架构和验收状态，保留旧记录。
- 原缓存离线复核与已提交 manifest 完全一致。本轮另外使用空 outputs/sec-revalidation-XYDWQs，真实首轮 cacheHit=false、3 次请求；两期 10-K hash/长度与原来源记录相同；离线校验成功，再跑 cacheHit=true、0 次请求。证据保存在忽略目录 acceptance.json，未记录联系邮箱。
- 验证：完整 npm run check 为 76 项通过，lint 零 warning，依赖检查无循环/边界违规；git diff --check 通过。check 运行前后源码/文档及 Git 状态未变化。
- 这些是本地验证。当前分支未推送、未创建 PR、未运行本轮远程 CI；后续财务指标、历史分片、模型与云能力继续列为计划。

## 2026-10-28 · 18 提交前 lint 与格式检查

- 恢复时工作区干净，无自定义 hooksPath；现有完整 check 基线为 76 项测试通过。按用户要求添加固定开发依赖 Husky 9.1.7 / lint-staged 17.6.0，核对 engines 与 Node 24.20.0 兼容，未修改现有 ESLint 规则。
- prepare 自动安装 .husky/_，pre-commit 检查暂存 TypeScript/MJS 的 ESLint（零 warning）和受支持文件的 Prettier；不自动修复，隐藏并恢复未暂存的已跟踪修改。CI 跳过 hook 安装，继续完整 check。贡献指南与 ADR 0013 说明使用方式与绕过/范围限制。
- 实际验证：npm ci 成功触发 prepare，hooksPath=.husky/_；npm ls 无 peer 错误。临时仓库真实提交验证正常通过、lint 错误拒绝、warning 拒绝、格式错误拒绝、带空格文件名、部分暂存与失败状态恢复，无遗留 stash。临时验收脚本 /tmp/stock-hook-acceptance.py 不进入产品源码。
- 本地完整 npm run check 通过：格式、零 warning lint、架构、类型与 76 项离线测试。未添加业务测试或改变 SEC 行为；本轮只本地提交，未推送，未运行本轮远程 CI。
