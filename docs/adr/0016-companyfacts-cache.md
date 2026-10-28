# ADR 0016：Company Facts 独立来源缓存

日期：2026-10-28。状态：Accepted。补充 ADR 0007/0014；不改变既有申报 HTML manifest schema。

## 背景

V1 离线比较已经可以追溯输入字节与具体事实，但下载仍是开发验收脚本。需要把官方获取、来源时点和离线复用做成可验证功能。Company Facts 是持续更新的公司级聚合快照，不应与固定 accession 的两份 HTML 混用 manifest。

## 决定

提供 companyfacts-fetch、companyfacts-validate、financial-compare-cached。抓取固定十位 CIK 的 canonical Company Facts URL，复用 SEC HTTP 模块现有 User-Agent、重定向禁止、25 MB 限制、超时与有限退避。扩展的 URL 白名单只接受精确端点，不接受 query、fragment、凭证、其他域名或非规范 CIK。

缓存位于 `<root>/companyfacts/<cik>`，独立 manifest 为 `{schemaVersion: 1, kind: 'sec-companyfacts', cik, artifact}`。artifact 保存 canonical URL、下载 UTC 时间、原始字节 SHA-256 和长度；不保存联系邮箱。先检查 JSON、公司 CIK 与 facts 对象结构，再写入 hash 命名 blob，最后原子发布 manifest。不宣称已验证整个 taxonomy 中所有概念；具体期间、单位、数值与冲突仍由 financial 提取器判断。

每次命中都重新验证 manifest、字节长度/hash、JSON 与 CIK；损坏或身份错配直接失败，不静默重抓。命中与显式离线验证均不要求身份信息且不联网。成功缓存没有 TTL，也不自动更新；要取得新时间点，明确使用新的 cache-root，保留旧快照。目录锁保证单写入者，竞争者不能移除已有锁；异常终止的遗留锁仍需人工确认后处理。

新增 artifact-store 只负责有界读取、原子写入、内容 hash 校验、manifest 存在性与目录锁。原 filing cache 与 Company Facts cache 复用这些原有实现，避免复制磁盘边界逻辑；既有 cache 的导出保留，旧调用者不变。companyfacts-contracts 保持纯校验，companyfacts-cache 负责磁盘与离线复核，companyfacts-retrieval 编排获取。下载策略继续集中在 http，不新增框架或接口层。

financial-compare-cached 使用缓存加载函数返回的同一份已验证 bytes 做计算，避免验证后再读取未经验证的文件。其 provenance 带完整 artifact 与 verification=cache-integrity-and-identity；原 financial-compare 的 local-content-hash-only 契约保留。两者均不把 hash 当作不可伪造的来源认证：能修改 manifest 和 blob 的本地写入者仍能制造一致文件。

## 替代与代价

覆盖旧缓存/默认取最新会破坏复现；只提供裸下载命令会丢失下载时间与命中验证。复用 HTML 的 manifest 则把公司聚合数据错误建模为一对 filing。当前不引入数据库、自动缓存迁移、后台更新或全局限流服务，单进程下载限速不等于跨机器限速。当前 API 不提供某历史时点的固定 Company Facts 快照；downloadedAt 不是申报公开时点，不能据此做历史回测。

## 验证

普通测试用合成 JSON/临时目录/mock fetch，覆盖首次发布、无身份零网络命中、坏内容与 CIK、腐败/缺失文件、manifest schema/hash/URL/大小、403、锁竞争、URL 白名单和 CLI 缓存比较。已有 HTTP 与 V0b 测试验证公共磁盘实现抽取后的行为兼容。

真实 Apple 首次获取与禁网重跑、实际快照 hash 和完整检查见 FINANCIAL-VALIDATION 与 DEVELOPMENT。本地结果不等于远程 CI 已执行。
