# ADR 0005：SEC 两期财报与可验证来源契约

日期：2026-10-28。状态：Accepted。

## 决定

V0b 请求固定一个十位 CIK 与两个不同 accession，不使用会随时间变化的“最新两期”。manifest schemaVersion 1 保存同公司、同 form、不同期间的两份原始 10-K 或 10-Q；暂不支持修订件、附件和跨表单比较。filedAt 是 SEC filingDate（日精度），不是 acceptanceDateTime 或精确公开时刻，不能用于日内回测可用性判断。

每份文件记录 periodEnd、filedAt、canonical SEC URL、UTC downloadedAt、原始字节 SHA-256 和长度。同时保留 submissions JSON 的 URL、下载时间、hash、长度，以供离线追溯元数据。hash 证明字节一致性，不证明外部输入真实。运行时严格拒绝未知字段、非法日期、非规范来源 URL 与不一致期间。

## 替代与代价

只保存链接无法重现下载内容；只保存 HTML 无法追溯元数据。两份文件使用同一种表单便于后续比较，但不意味着财务指标已可比。V0b 不解析财务数值，不执行或渲染下载页面的脚本与指令。未来范围变化新增版本/ADR。

## 验证

合成 metadata 与已知 SHA-256 向量做离线测试，不冒充真实 SEC 下载。实际结果写入开发记录。
