# ADR 0013：提交前的暂存文件检查

日期：2026-10-28。状态：Accepted。补充 ADR 0008/0009。

## 背景

现有完整检查与 CI 无法在本地提交动作发生前自动提示 lint/格式错误。用户要求提交前执行检查；需要支持部分暂存，避免未完成的工作混入提交。

## 决定

增加项目本地固定版本 Husky 9.1.7 与 lint-staged 17.6.0，提交 lockfile；npm registry engines 分别要求 Node >=18 与 >=22.22.1，兼容项目 Node 24。Husky 通过 prepare 安装仓库 hooksPath，pre-commit 调用 lint:staged。TypeScript/MJS 使用既有 ESLint 规则和 --max-warnings 0，所有暂存文件交给 Prettier --check --ignore-unknown，并尊重现有 ignore 配置。

lint-staged 使用 --hide-unstaged，保留默认 stash/回滚行为；不添加自动修复和自动 git add 命令。检查失败阻止提交。工具对任务文件的暂存管理与状态恢复仍由 lint-staged 完成。未跟踪文件不隐藏，因此这不是隔离构建。完整 check 保留原格式、lint、架构、类型与单元测试门禁；CI 设置 HUSKY=0，避免安装无用途的本地 hook。

## 替代与代价

只用 Husky 每次执行完整 check 更简单，但会让无关未暂存修改影响提交；手写文件列表与备份脚本容易遗漏文件名空格、部分暂存与失败恢复。增加 lint-staged 是为复用这些实际能力，不增加运行时依赖。暂存文件检查不能发现全部跨文件影响，完整 check 与 PR 必需检查继续保留。暂不增加重复的 pre-push 测试或提交信息规则。

Hook 可以绕过；这是开发反馈工具，不是强制授权机制。GUI 需正确 Node/npm PATH；新克隆需安装开发依赖；生成的 .husky/_ 不提交。安装会设置当前仓库 hooksPath；本次核实此前无自定义 hooksPath。

## 验证

在临时 Git 仓库安装相同配置，通过真实 git commit 验证正常提交、lint 错误、零 warning 要求、格式错误与包含空格的文件名。验证暂存错误不会被未暂存修复掩盖，失败后 index/工作区恢复；正常部分暂存提交保留未完成修改且无遗留 stash。临时仓库使用独立测试身份并关闭签名，不改变项目签名配置。完整检查及安装验证见 DEVELOPMENT 本次记录；未运行本轮远程 CI。
