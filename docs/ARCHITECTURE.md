# 架构与目录

采用模块化单体，Node 24 原生运行可擦除类型的 TypeScript。运行时无第三方依赖，开发工具负责类型、lint、格式、循环和层次检查。当前只提供 CLI，未引入 HTTP 服务、UI、数据库或云资源。

```text
src/shared/          无副作用的通用输入校验
src/domain/          金额、合约、场景校验与纯到期损益
src/adapters/        严格 CSV 报价输入，按显式时点与 bid/ask 生成场景
src/sec/contracts   纯 SEC metadata/request/manifest 校验与来源 URL
src/sec/submissions 从下载快照中精确选择 accession
src/sec/content     纯 HTML 结构检查，不执行页面
src/sec/integrity   Node crypto 的 hash/字节完整性适配
src/sec/http        SEC-only 受限下载、超时与退避
src/sec/cache       文件系统缓存、锁、原子发布与离线复核
src/sec/retrieval   下载与缓存的应用流程编排
src/cli/commands    命令分派与文件/环境边界
src/cli.ts          可执行入口：输出、错误与退出码
fixtures/           合成报价与可手算输入；不会冒充历史数据
test/               行为/边界测试与内联合成 SEC metadata
examples/           固定真实 accession 请求与可分享来源 manifest
outputs/sec/        忽略的本地原始下载内容
```

期权数据流：JSON/CSV → 运行时校验 → 纯计算 → 带来源 JSON。SEC 数据流：固定 CIK/accession → 完整缓存复核（命中即离线返回）→ SEC submissions → metadata 核对 → 两份 HTML → 完整性校验与原子 manifest。缓存不完整不算命中；损坏不静默联网修复。

依赖方向是 CLI → 适配器/应用流程 → 纯契约/领域 → shared。纯核心不引用 Node、网络、磁盘或 CLI；payoff 与 SEC 功能不互相引用。dependency-cruiser 同时检查循环与跨边界依赖，ESLint 检查类型感知代码质量。模块名不强制复制成多层目录，不为单一实现制造接口或 DI 容器。

fetch、sleep、clock 支持注入，以测试网络边界且不连接 SEC。磁盘适配在临时目录中验证完整性、竞争与失败恢复，CLI 用子进程验证外部协议。数值结果使用独立手算预期，普通测试不依赖下载缓存。

后续财务指标、检索、模型与 AWS 接入须保持数值计算、外部数据和模型解释分离；技术栈、数据授权与云运行成本变更用 ADR 记录。V0b 的原始网页只作为不可信数据，不执行其中的指令与脚本。
