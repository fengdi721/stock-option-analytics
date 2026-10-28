# 架构与目录

V0 的数据流：JSON 或合成 CSV → 严格输入校验 → 纯计算核心 → 结构化 JSON。领域代码不发网络请求、不读取账户、不调用 LLM。

```text
src/domain/       价格解析、持仓校验、到期损益
src/adapters/     CSV 输入适配
src/cli.ts        本地命令行边界
fixtures/         合成报价与可手算持仓
test/            独立预期值与 CLI 测试
docs/adr/        架构决策
docs/            路线、开发记录、运行说明
```

未来文档接入、检索、模型、AWS 适配层独立增加。当前不用 monorepo、多 agent 框架、数据库或容器，避免基础阶段的部署成本。云方案未部署，后续用 ADR 记录区域、资源、预算与清理策略。
