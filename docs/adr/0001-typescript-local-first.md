# ADR 0001：TypeScript 与本地确定性核心

日期：2026-10-28。状态：Accepted。

## 背景

用户以 AWS/FDE 能力为目标，选择美股和期权领域。先建立能复核的数值工具，再接财报及模型。

## 决定

使用当前已安装的 Node.js 24 与可擦除类型的 TypeScript。V0 以 Node 原生 TypeScript 执行、node:test 测试，不引入运行时第三方依赖。首次检查环境为 Node v24.20.0、npm 11.19.0。

原生执行不会做 TypeScript 静态类型检查；必须使用运行时输入校验和测试，后续引入 tsc 时单独记录工具链变化。第一版 CLI，稍后按需求增加 HTTP/UI。所有实际交易和外部凭证均不属于 V0a。

## 替代与代价

Python 更适合量化生态，但此阶段优先已有 TypeScript 能力；需要回测库时再增加隔离 Python 模块。完整 Web 模板启动成本高，先通过 CLI 验证领域边界。Node 原生 TS 限制使用 enum、参数属性等需要转换的语法，因此限定可擦除类型。

## 验证

记录实际运行版本；后续通过 node:test 验证模块加载与 CLI。此 ADR 创建时尚未实现计算。
