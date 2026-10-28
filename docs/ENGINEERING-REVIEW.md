# 架构与工程基线复核

复核日期：2026-10-28，Europe/Paris。起点 caf7246；本轮仅本地分支 refactor/sec-validation-boundaries，不推送。

## 基线与保留的设计

全部要求文档、ADR、源码及 CI 已重新读取；未发现适用 AGENTS.md。工作树最初干净，Node v24.20.0 / npm 11.19.0，完整 check 为 70 项通过。既有模块化单体、确定性金额计算、CLI/命令执行分隔、SEC HTTP/缓存/编排分隔和锁均已实现，本轮保留，不重复搭建架构。

依赖继续是 CLI → 适配器/应用流程 → 纯领域/契约 → shared。普通测试使用合成 SEC 数据和临时文件系统；真实数据验收单独执行。没有引入新目录层、接口框架或运行时依赖。

## 发现并解决的问题

| 优先级 | 位置                                             | 原有问题与影响                                                                                                   | 本轮处理与证据                                                                                                                         |
| ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| P2     | src/sec/retrieval.ts、src/sec/submissions.ts     | 下载前为验证 metadata 构造带 submissions 下载字段的临时 manifest；单独调用 selectFilings 也可能返回非法日期/期间 | contracts 中增加独立 metadata/pair 解析，submissions 返回前验证；四类无效 metadata 均只请求 submissions、不请求文档，且不发布 manifest |
| P2     | src/sec/contracts.ts：parseRequest/parseManifest | 整对象断言后返回调用者输入；调用方修改输入可改变已验证的请求/结果                                                | 构造明确的嵌套值与 tuple，复用纯校验；回归验证修改原输入后已解析请求及 manifest 保持不变                                               |
| P2     | .dependency-cruiser.mjs、eslint.config.mjs       | SEC content/submissions 未纳入 pure-core；单纯导入图不能发现全局 fetch/process                                   | 扩大纯核心覆盖并约束常见全局 I/O；用实际模块路径的裸全局、globalThis 与 Node 导入反例验证拒绝                                          |
| P2     | eslint.config.mjs                                | 默认 no-floating-promises 可被生产代码的 void 绕过，与贡献规则不一致                                             | 生产代码 ignoreVoid=false；测试注册保留原用法，生产 void Promise 反例验证拒绝                                                          |

P2 表示应在继续扩展功能前处理的维护/正确性缺口；未将它们描述为已发生的数据泄露或错误财务结果。CLI 参数、manifest schemaVersion 1、合法输入结果、精确金额及来源字段不变。直接调用 metadata 选择函数时，现在会更早拒绝无效结果，见 ADR 0011。

## 实际工具与取舍

沿用项目本地锁定版本：TypeScript 6.0.3、ESLint 10.13.0、@eslint/js 10.0.1、typescript-eslint 8.72.1、Prettier 3.9.10、eslint-config-prettier 10.1.8、dependency-cruiser 18.7.0。本轮核对 npm ls 与本地包 peerDependencies，TS 6.0.3 在 >=4.8.4 <6.1.0 范围，ESLint 10 受支持；未重复安装、强制解决 peer 冲突或全局修改。

规则仍以 recommendedTypeChecked 为基线，额外规则针对已发现的异步与依赖缺口。Prettier 独立执行，零 warning lint 与依赖检查组成只读门禁；CI 使用同一个 npm run check。未机械套用 Airbnb/Google 整套配置，也未以规则数量作为验收。

静态约束不构成沙箱，反射与间接别名仍须审查；本轮未扩展为全局信息流分析。已验证的解析值与输入隔离，但不被冻结。共享 artifact 大小常量避免 HTTP、磁盘与契约的限制漂移。

## 已验证结果与后续范围

- 完整 check：格式、零 warning lint、架构边界/循环、strict 类型检查、76 项离线测试通过。沿用原有手算、CLI、缓存损坏/失败与竞争回归。
- 新增 6 项有行为意义的回归；工具约束使用临时反例核验，没有为格式变化增加测试。临时反例已清除。
- 原 Apple 缓存和已提交来源 manifest 完全一致；本轮新空目录首次真实获取 3 个响应，离线复核成功，再跑 0 网络调用。原始财报 SHA-256 与原记录一致，详见 SEC-VALIDATION。
- DEVELOPMENT、PROGRESS、ARCHITECTURE 与 ADR 0011/0012 已维护。远程历史 CI 不能替代本轮未推送分支的验证。

V0b 限定范围继续完成；SEC historical submissions 分片、修订件、财务指标、检索、Bedrock、云部署仍未实现。HTTP 限速仍为单调用，异常终止留下的锁仍需确认无活动写入者后人工移除；hash/HTML 结构也不等于独立真实性认证。
