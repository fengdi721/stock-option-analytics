# 架构与目录

采用模块化单体，Node 24 原生运行可擦除类型的 TypeScript。运行时无第三方依赖，开发工具负责类型、lint、格式、循环和层次检查。当前只提供 CLI，未引入 HTTP 服务、UI、数据库或云资源。

```text
src/shared/          无副作用的通用输入校验
src/domain/          金额、合约、场景校验与纯到期损益
src/adapters/        严格 CSV 报价输入，按显式时点与 bid/ask 生成场景
src/financial/      年度请求契约、Company Facts 提取与纯比较计算
src/sec/contracts   纯 SEC metadata/request/manifest 校验与来源 URL
src/sec/submissions 从下载快照中精确选择 accession
src/sec/content     纯 HTML 结构检查，不执行页面
src/sec/integrity   Node crypto 的 hash/字节完整性适配
src/sec/http        SEC-only 受限下载、超时与退避
src/sec/artifact-store 有界读写、目录锁、blob 与原子发布
src/sec/cache       申报 HTML manifest 与离线复核
src/sec/companyfacts-* 公司事实纯契约、独立缓存与获取编排
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

SEC metadata 在 contracts 中独立验证，submissions 只返回有效日期、canonical URL 与两期关系均成立的值。retrieval 不再借用 submissions 的下载字段构造临时 manifest；只有真实下载结果进入完整 manifest。解析器构造独立边界值，避免调用方后续修改输入改变已验证的异步请求。

pure-core 自动约束覆盖 domain、shared 和 SEC contracts/content/submissions；ESLint 补充检查常见全局 I/O 与被 void 丢弃的业务 Promise。规则是可执行的开发约束，不是运行时沙箱。响应字节上限由 contracts 的单个常量供 HTTP 和缓存复用。

V1 财务数据流：Company Facts 快照 + 明确期间请求 → 精确选择 accession/期间/单位 → 带 JSON Pointer 的事实 → 整数差额/百分比计算。financial 仅依赖自身、shared 与 SEC 公共 contracts，纯模块 I/O 约束同时适用；不读取 SEC 缓存内部实现。数据提取与计算不依赖 CLI。Company Facts 快照与 V0b HTML 缓存独立，API hash 不冒充原始申报 hash。

Company Facts 获取流：CIK → 完整缓存复核 → 精确 SEC API URL → JSON/公司身份检查 → blob → 原子发布独立 manifest。缓存读取返回同一份已验证 bytes，CLI 交给 financial 计算，SEC 模块不反向依赖 financial。纯模块约束包含 companyfacts-contracts；I/O 模块复用 artifact-store 与 http。缓存无自动刷新，新的根目录代表新的来源快照。

同期间对账的数据流：明确 period + 两份 accession/form → companyfacts 共用事实选择器 → reconciliation 纯差额与申报日一致性校验 → CLI 来源信息。旧年度比较仍默认选择 10-K，新请求才允许明确 10-K/A。对账保留双方原值与引用，不把 changed 转换成正式重述判断；没有新增网络入口或跨层依赖。

显式指标比较：metrics-contracts 固定指标名/标准概念与请求校验，companyfacts 共用精确选择器，selected-metrics 产生按选择顺序排列的事实与变化。calculations 提供共同的精确百分比/差额规则，原 comparison 继续复用；模块均无 I/O。没有默认扩大旧输出，也没有新增依赖或运行时注册层。
