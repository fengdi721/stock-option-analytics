# 架构决策记录

| 编号                                         | 决策                           | 状态                                 |
| -------------------------------------------- | ------------------------------ | ------------------------------------ |
| [0001](0001-typescript-local-first.md)       | TypeScript 与本地确定性核心    | Accepted；静态检查由 0004 补充       |
| [0002](0002-exact-money-and-expiry-scope.md) | 精确金额与到期损益范围         | Accepted                             |
| [0003](0003-snapshot-provenance-and-cli.md)  | 快照来源与 CLI                 | Accepted                             |
| [0004](0004-static-checks-and-ci.md)         | 静态检查与 CI                  | Accepted；工具链由 0008 更新         |
| [0005](0005-sec-provenance-contract.md)      | SEC 来源与离线契约             | Accepted                             |
| [0006](0006-module-boundaries.md)            | 模块职责与依赖边界             | Accepted                             |
| [0007](0007-sec-download-cache.md)           | SEC 受限下载与验证缓存         | Accepted                             |
| [0008](0008-quality-gates.md)                | lint、格式与依赖质量门禁       | Accepted                             |
| [0009](0009-pr-ci.md)                        | PR 与主分支 CI                 | Accepted；公开与保护策略由 0010 补充 |
| [0010](0010-public-repository.md)            | 公开前检查与主分支保护         | Accepted                             |
| [0011](0011-sec-metadata-validation.md)      | 独立 SEC metadata 校验与边界值 | Accepted                             |
| [0012](0012-pure-core-enforcement.md)        | 纯模块与异步副作用自动约束     | Accepted                             |
| [0013](0013-commit-hooks.md)                 | Husky 暂存文件提交前检查       | Accepted                             |
| [0014](0014-annual-financial-facts.md)       | 年度财务事实与离线比较         | Accepted                             |
| [0016](0016-companyfacts-cache.md)           | Company Facts 来源与离线缓存   | Accepted                             |
| [0017](0017-same-period-reconciliation.md)   | 同期间披露数值对账             | Accepted                             |

新增 ADR 使用四位连续编号，包含背景、决定、替代方案、代价和验证。Accepted 表示已采用技术决定，不代表对应产品能力已完成。
