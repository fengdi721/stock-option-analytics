# ADR 0007：受限 SEC 下载与完整性缓存

日期：2026-10-28。状态：Accepted。

## 决定

请求固定 CIK 和两个 accession，从 SEC submissions 的 recent 列中精确选择并核对 metadata。只接受构造出的 canonical HTTPS SEC URL，不允许重定向。当前不搜索历史 submissions 分片；找不到时明确失败。下载方必须通过 SEC_USER_AGENT 提供应用名与联系邮箱，代码/manifest 不保存联系信息。

单次调用顺序下载，启动间隔至少 250 ms；单请求超时 30 s、解压后响应上限 25 MB、检查 MIME 与 HTML 结构。429/500/502/503/504 最多尝试三次，指数退避并遵守 Retry-After；要求等待超过 60 s 时停止，提示稍后人工重试。其他 HTTP 错误及网络/流失败直接返回失败，不无限重试。限速只覆盖该调用，多个进程/机器的总量由使用者协调，不能宣称全局 SEC 限速已实现。

缓存路径由 CIK 与排序后的 accession 确定。文件名为原始响应字节 SHA-256；下载完成后原子发布 manifest。每次缓存命中重新核对 hash、长度、HTML 结构和保存的 submissions metadata，缺失/损坏直接失败，不静默联网修补。已完成缓存命中不要求 User-Agent，也不调用 fetch。CLI 提供 sec-fetch 与完全离线的 sec-validate。

同一对财报以目录锁保证单写入者，拿锁后再次检查已发布 manifest；竞争失败不能删除其他写入者的锁。进程异常终止可能留下 .lock；确认没有活动下载后由使用者移除。中断留下的 blob 不算完整缓存；再次下载可能重复获取尚未发布的数据。

## 替代与代价

HTTP 缓存头不足以检测本地文件变化；URL-only manifest 无法离线重现。完整快照不自动刷新，以固定来源时点为目标。无需数据库与共享限流服务。hash 和结构校验保证一致性，不是独立真实性证明，也不验证财务披露内容。

## 来源与数据处理

设计参考 SEC 官方 [API 文档](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) 与 [Developer Resources](https://www.sec.gov/about/developer-resources)，核对日期 2026-10-28。未复制第三方项目代码。SEC 提醒应仅下载所需内容并限制总请求频率。

真实文件仅保留在忽略的 outputs/sec，不作为可再分发数据集提交。仓库只保存请求、URL、日期、长度和 hash；下载页面不得当作程序指令执行。未对整份公司文档作可再分发授权推定，后续如需公开原文须单独核验。

## 验证

20 项离线 retrieval 测试覆盖成功、零网络命中、损坏、metadata 不一致、退避、大小/MIME、部分失败、重排请求、竞争锁和重定向。Apple 两期真实文件及零网络重跑见 DEVELOPMENT 与 SEC-VALIDATION。
