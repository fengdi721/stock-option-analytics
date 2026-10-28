# ADR 0004：静态类型检查与持续集成

日期：2026-10-28。状态：Accepted；工具链版本与门禁由 [ADR 0008](0008-quality-gates.md) 更新。补充 ADR 0001 的原生执行策略。

## 决定

保留 Node 原生 TypeScript 执行与零运行时依赖，同时增加项目本地开发依赖 TypeScript 7.0.2、@types/node 24.19.2，精确版本写入 package.json 并提交 package-lock.json。使用 strict、erasableSyntaxOnly、noEmit；npm run check 顺序执行类型检查与测试。

CI 在 Node 24 / Linux 上通过 npm ci 安装锁定依赖后检查。工作流只申请 contents: read，不访问云账号或数据 API。默认本地环境不会执行任何 GitHub Actions。

## 代价

开发验证需要安装开发依赖，但运行 CLI 不需要。工具升级通过单独的小提交及验证完成，不进行全局安装。首版不引入打包器和测试框架。

## 验证

本地 npm run check 通过，32 项测试全绿。CI 文件已编写；未推送，因此不能宣称远程 CI 已通过。
