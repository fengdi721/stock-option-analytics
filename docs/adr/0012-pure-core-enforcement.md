# ADR 0012：纯模块与异步副作用的自动约束

日期：2026-10-28。状态：Accepted。补充 ADR 0006/0008。

## 背景

现有依赖规则只覆盖 domain、shared、SEC contracts，漏掉文档中同样称为纯模块的 content 与 submissions。导入图也看不到全局 fetch/process；默认 no-floating-promises 允许通过 void 忽略业务 Promise，与贡献约定有差距。

## 决定

dependency-cruiser 将 SEC content/submissions 同样纳入 pure-core，只能依赖允许的纯模块；继续限制 SEC 与期权领域的交叉依赖。ESLint 在纯模块中拒绝 fetch、process、require、WebSocket、XMLHttpRequest 的直接全局使用，并拒绝常见 globalThis.fetch/process/WebSocket/XMLHttpRequest 形式。

生产源码将 no-floating-promises.ignoreVoid 设置为 false，必须 await 或显式处理失败。测试保留 node:test 注册的 void 用法，失败仍由测试运行器报告。保留独立 Prettier 与零 warning lint，不增加依赖或运行时框架。

## 替代与代价

静态约束不能充当 JS 沙箱，反射/间接别名等规避方式仍需代码审查。这里只约束当前架构承诺中的常见 I/O 入口，不声明可证明的数学纯函数或全面信息流隔离。只写文字规则或仅依赖 import graph 都不足以覆盖上述缺口。

## 验证

用 lintText 对五组实际纯模块路径分别构造裸全局和 globalThis I/O 反例，确认对应规则报错；在 content/submissions 临时添加 node:fs/promises 导出，确认 pure-core 拒绝，随后恢复文件。生产代码 void Promise.resolve(1) 被类型感知 lint 拒绝。完整 check 与 76 项离线测试通过，反例不留在源码中。
