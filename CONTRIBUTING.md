# 开发约定

每个提交只包含一个可解释的变化：文档基线、领域能力、接口或修复。提交前运行 npm run check 和 git diff --check，在 docs/DEVELOPMENT.md 记录实际结果、限制及下一步；不要记录未执行的成功结果。

影响技术栈、数据模型、财务计算、外部依赖、授权和运行成本的决定需要 ADR。新决定用新编号；已被替代的 ADR 保留并指向后继，不重写历史。

保持领域计算与数据获取、CLI、模型服务分离。数值测试使用独立手算预期值；不得仅比较函数与自身实现。禁止提交凭证、私有账户数据与未经允许再分发的数据集。

默认小步本地 commit。推送、购买数据、创建云资源按用户授权执行；本次建立项目没有自动创建付费资源。代码来源需要在文档中注明；项目尚未选择开源许可证，不能推定具有第三方项目的许可。

## 工具与日常流程

使用项目本地 Node 24 工具链：npm ci 后执行 npm run check。它依次运行 format:check、lint、architecture:check、typecheck、test；全部检查只读，lint 要求零 warning。CI 使用同一入口，普通验证不访问 SEC。明确需要自动修复时使用 npm run format 或 npm run lint:fix。

当前编译器 TypeScript 6.0.3 是为匹配 typescript-eslint 的支持范围选定，见 ADR 0008。升级任何一方先核对 peerDependencies、运行完整检查并提交 lockfile。禁止用 --force、--legacy-peer-deps 或全局安装掩盖不兼容。

## 可执行编码约定

- Prettier 管格式：两空格、单引号、目标行宽 100、LF；不手工维护与其冲突的风格规则。
- ESLint 使用 flat config 与类型感知 recommendedTypeChecked。避免 any、不安全 JSON.parse 结果和不必要类型断言；边界数据先视为 unknown，校验后构造领域值。类型导入使用 import type。
- 变量/函数 camelCase，类型 PascalCase，模块文件使用 kebab-case。名称表达业务含义，公共函数与重要约束写明用途；注释解释原因、限制和单位。
- 异步副作用必须 await 或明确处理失败。node:test 注册使用 void test，由运行器汇总失败；不可用 void 忽略业务 Promise 错误。
- 预期的边界失败抛出带上下文的 Error，交给 CLI 统一转换为 stderr JSON 和退出码 1。不可吞掉错误、输出半份成功结果或将凭证带进异常消息。
- 纯领域与契约不依赖磁盘/HTTP/环境变量。模块之间使用明确导入；禁止循环、shared 反向依赖业务和业务反向依赖 CLI。dependency-cruiser 自动检查这些方向。
- 不通过大范围 eslint-disable、@ts-ignore 或类型断言规避检查。例外须最小化并写明理由；测试中的故意坏输入用 unknown 类型表达。

当前采用适合本项目的官方推荐规则集，不声称完整遵守 Airbnb 或 Google Style。架构边界见 ARCHITECTURE，工具选择和代价见 ADR 0008。

纯模块包含 domain、shared，以及 SEC contracts/content/submissions。除了依赖图约束，ESLint 还拒绝其中常见的全局网络/环境访问。生产源码不允许用 void 绕过未处理 Promise 规则；需要主动启动后台任务时必须明确失败处理与生命周期。上述静态检查不能代替对反射或间接别名访问的代码审查。
