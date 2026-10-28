# ADR 0011：独立 SEC metadata 校验与边界值

日期：2026-10-28。状态：Accepted。补充 ADR 0005/0006，不改变 manifest schemaVersion 1。

## 背景

检视已有 V0b 实现发现：下载前校验通过复制 submissions 的 hash/下载时间构造临时 manifest，元数据规则与下载结果耦合。selectFilings 的返回类型声明了有效日期，但自身没有完整验证期间和两期关系。parseRequest/parseManifest 也直接断言返回输入对象，调用方后续修改输入会改变已验证值。

## 决定

在既有 contracts 模块定义 FilingMetadata、parseFilingMetadata 和 parseMetadataPair，单独验证已申报的来源、日期、表单及同公司/同表单/不同期间约束。submissions 只在通过该校验后返回 metadata；retrieval 无需构造临时下载证据。完整 manifest 校验复用 metadata 校验，再验证真实 artifact、下载时点和 submissions 来源。

运行时解析器由 unknown 构造明确的结构与二元 tuple，不通过整对象断言赋予业务类型；返回值不共享输入的嵌套可变对象。这不等于冻结返回值，调用方仍可有意修改自己的结果。通用对象/字段/整数校验复用 shared，响应长度上限由契约中的一个常量供 HTTP 和缓存使用，避免边界规则漂移。

## 替代与代价

维持临时 manifest 可以少写解析函数，但把尚未下载的财报混入无关 artifact metadata。引入 schema 库需要新的运行时依赖；当前规模使用小型纯函数即可。保持现有 URL、字段、schema 与 CLI 协议，额外收紧的是直接调用 selectFilings 时对无效 metadata 的拒绝。

## 验证

离线测试覆盖无下载字段的合法 metadata、非法日期/期间/混合表单/重复期间在文档下载前失败，以及修改输入后已验证值保持不变。结果记入 DEVELOPMENT。真实缓存仍使用原始证据文件验证，不制造新的下载时点。
