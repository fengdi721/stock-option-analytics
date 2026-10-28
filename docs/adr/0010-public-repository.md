# ADR 0010：公开仓库与主分支保护

日期：2026-10-28。状态：Accepted。

用户明确授权检查后公开。检查当前全部 13 个提交及 129 个历史 blob，按私钥、AWS/GitHub/OpenAI token、JWT、密码赋值、含凭证 URL、敏感文件名及 SEC 联系邮箱规则扫描，未发现命中。正文仅含测试/占位邮箱；Git 作者身份依然可见。规则扫描不等于穷尽秘密检测。原始 SEC 缓存与 .env 被忽略，未进入历史。

远程 visibility 已从 private 改为 public，GitHub API 回读 private=false。未重写提交历史，也未推定公开等于授予开源许可证；许可证仍待另行选择。

主分支保护目标：要求 PR，GitHub Actions app 15368 的 Quality gate 成功、分支与 main 最新；管理员同样受限，禁止强推与删除。不要求额外批准人数，以支持单人维护；CI 通过不等于人工审查。设置将在本文推送后应用并通过 API 回读核验，不以本 ADR 代替执行证据。
