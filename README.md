# Stock Option Analytics

美股研究与期权情景分析工作台。当前开发阶段：V0a/V0b 已完成本地验收，V1 已交付离线年度营收/净利润比较。提供确定性的期权到期损益、SEC 两期来源缓存与带来源定位的财务计算。以 TypeScript 为主，金融计算由代码执行，未来 LLM 负责调用工具与解释有来源的结果。

## 项目导航

- [产品范围与里程碑](docs/ROADMAP.md)
- [架构与目录](docs/ARCHITECTURE.md)
- [完成状态与下一批任务](docs/PROGRESS.md)
- [开发记录](docs/DEVELOPMENT.md)
- [架构决策 ADR](docs/adr/README.md)
- [贡献与验证规则](CONTRIBUTING.md)
- [SEC 真实来源验收](docs/SEC-VALIDATION.md)
- [年度财务比较验收与限制](docs/FINANCIAL-VALIDATION.md)

本项目是学习与工程演示。目前没有实盘交易、实时行情、真实回测收益或已部署的 AWS 服务。合成数据不能当作历史行情。

## 本地运行

需要 Node.js 24；运行时没有第三方依赖。开发依赖锁定在项目内，npm run check 包含格式、lint、依赖边界、类型与离线测试。

```sh
npm ci
npm run check
npm run demo
node src/cli.ts payoff fixtures/call-spread.json
node src/cli.ts quote-payoff fixtures/quotes.synthetic.csv fixtures/quote-request.json
node src/cli.ts financial-compare fixtures/companyfacts.synthetic.json fixtures/financial-request.json
```

两份期权示例均使用合成 DEMO 标的。标的到期价格 90、100、102、105、110 对应组合净损益 -202.60、-202.60、-2.60、297.40、297.40 USD。

需输出纯 JSON 时直接运行 node 命令；npm run 会额外打印脚本标题。正常结果在 stdout，错误 JSON 在 stderr 且退出码为 1。详细字段见 [输入与运行说明](docs/USAGE.md)。

SEC 首次下载、User-Agent 和离线复用见 [输入与运行说明](docs/USAGE.md#sec-两期财报)。真实下载文件位于忽略的 outputs/sec；仓库只保存来源 metadata。

财务示例同样为合成数据：营收 2000 → 2500 USD（+25.00%），净利润 100 → 250 USD（+150.00%），净利率 5.00% → 10.00%。真实 Apple 两期结果和独立交叉核验见财务验收记录；当前财务命令仅导入本地 Company Facts 快照，不自动下载。
