# Stock Option Analytics

美股研究与期权情景分析工作台。当前开发阶段：V0，确定性的期权到期损益工具。以 TypeScript 为主，金融计算由代码执行，未来 LLM 负责调用工具与解释有来源的结果。

## 项目导航

- [产品范围与里程碑](docs/ROADMAP.md)
- [架构与目录](docs/ARCHITECTURE.md)
- [完成状态与下一批任务](docs/PROGRESS.md)
- [开发记录](docs/DEVELOPMENT.md)
- [架构决策 ADR](docs/adr/README.md)
- [贡献与验证规则](CONTRIBUTING.md)

本项目是学习与工程演示。目前没有实盘交易、实时行情、真实回测收益或已部署的 AWS 服务。合成数据不能当作历史行情。

## 本地运行

需要 Node.js 24；计算与测试没有运行时第三方依赖。

```sh
npm ci
npm run check
npm run demo
node src/cli.ts payoff fixtures/call-spread.json
node src/cli.ts quote-payoff fixtures/quotes.synthetic.csv fixtures/quote-request.json
```

两份示例均使用合成 DEMO 标的。标的到期价格 90、100、102、105、110 对应组合净损益 -202.60、-202.60、-2.60、297.40、297.40 USD。

需输出纯 JSON 时直接运行 node 命令；npm run 会额外打印脚本标题。正常结果在 stdout，错误 JSON 在 stderr 且退出码为 1。详细字段见 [输入与运行说明](docs/USAGE.md)。
