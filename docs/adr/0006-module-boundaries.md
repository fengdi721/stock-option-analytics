# ADR 0006：按业务能力分隔职责与依赖

日期：2026-10-28。状态：Accepted。

## 背景

V0a 的通用校验与金额函数集中在 payoff.ts，CSV 适配器依赖计算模块的内部工具。V0b 草稿把 HTTP、SEC metadata、文件校验、缓存与下载流程放在同一模块；CLI 导入即执行，难以独立使用命令逻辑。

## 决定

保持单仓库模块化单体。domain 内分隔金额、合约、场景校验与损益计算；shared 仅放无外部副作用的通用运行时校验。CSV 适配器通过明确的领域接口调用，不从 payoff 借用工具函数。

SEC 能力集中在 sec 内，分隔 contracts、submissions、content、integrity、http、cache 与 retrieval。retrieval 编排外部副作用，纯契约不依赖 Node、磁盘或网络。CLI 入口只处理参数、输出与退出码，commands 模块执行命令。只有确实需要替换的 fetch、sleep、clock 通过参数传入，不增加 DI 框架或无用途的接口。

依赖方向：CLI → 适配器/流程 → 纯契约/领域 → shared。payoff 与 SEC 不互相依赖；shared 不依赖业务模块。不允许循环依赖。自动化依赖检查在后续工具链提交落实。

## 替代与代价

完整多层 DDD、monorepo 和框架会增加当前小型 CLI 的结构成本。保留功能内的显式模块，而不为每个类复制 domain/application/infrastructure 目录。模块数量增加，但每个模块的变更原因和外部副作用更清晰。

## 验证

领域与 CSV 的 30 项定向测试通过，包含手算与新增稀疏数组/继承字段回归。SEC、CLI 和自动化门禁的实际结果记录于开发日志，本文不代替验收证据。
