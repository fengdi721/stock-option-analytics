# ADR 0008：兼容工具链与自动质量门禁

日期：2026-10-28。状态：Accepted。工具链版本部分替代 ADR 0004。

## 背景

类型检查与单元测试不能自动保证一致格式、异步错误处理或模块依赖方向。用户要求在继续开发时建立可执行的工程标准。当前 TypeScript 7.0.2 超出 typescript-eslint 的受支持范围，不能靠忽略 peer 冲突安装。

## 决定

使用精确锁定的本地开发依赖：ESLint 10.13.0、@eslint/js 10.0.1、typescript-eslint 8.72.1、Prettier 3.9.10、eslint-config-prettier 10.1.8、dependency-cruiser 18.7.0。将 TypeScript 调整为受支持的 6.0.3，保留 Node 24 原生 TS、strict/noEmit/erasableSyntaxOnly 和零运行时第三方依赖。

兼容性核对：npm peerDependencies 与 typescript-eslint 官方 [支持范围](https://typescript-eslint.io/users/dependency-versions/) 均要求 TypeScript >=4.8.4 <6.1.0，支持 ESLint 10。dependency-cruiser 支持 Node 24。未使用 --force、--legacy-peer-deps 或关闭不支持版本警告。

ESLint 使用 flat config、JS recommended 与 recommendedTypeChecked/projectService。增加 consistent-type-imports、穷尽分支、严格等号和大括号；默认不允许 any、不安全类型使用或未处理 Promise。node:test 的注册 Promise 以 void 明确表示交给测试运行器管理；业务异步调用正常 await。不批量禁用规则。

Prettier 独立格式化；使用 eslint-config-prettier 消除冲突，不把格式化作为 ESLint rule。项目选用两空格、单引号、100 字符目标行宽，其余遵从 Prettier。使用官方推荐规则并记录本项目约定，不机械套用与 TS/Node 项目不兼容的 Airbnb/Google 整套配置。

dependency-cruiser 自动拒绝循环、无法解析的导入、纯核心依赖外部副作用、shared 依赖业务、业务反向依赖 CLI，以及 payoff 与 SEC 的交叉依赖。

check 顺序：format:check → lint（0 warnings）→ architecture:check → typecheck → test。所有步骤只读；format 与 lint:fix 是显式修改命令。CI 沿用 npm ci + npm run check，因此本地和 CI 同一门禁；check 不联网，不读取真实缓存。原始下载数据与 outputs 不参与格式化或 lint。

## 替代与代价

单靠风格指南不能发现依赖倒置或 Promise 错误。完整 strictTypeChecked 规则留待实际收益与维护成本明确后逐项采用，不以规则数量代表质量。增加开发依赖与类型感知 lint 的耗时，换来可重复的自动约束。TS 7 升级需等完整工具链支持后单独验证。

## 验证

实际完整检查、规则反例验证和版本依赖树记录于 DEVELOPMENT。新增配置不等于远程 CI 已执行。
