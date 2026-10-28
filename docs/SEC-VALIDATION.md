# V0b 真实 SEC 验收记录

执行日期：2026-10-28，Europe/Paris。下载 UTC 时间见 [来源 manifest](../examples/sec-apple-annual.manifest.json)。此记录是实际执行结果；未来下载的 submissions 快照可能变化，原始 10-K 字节也应重新核对，不能预先假定 hash 永远相同。

## 已验证

使用 [固定请求](../examples/sec-apple-annual.json)，从 data.sec.gov 获取 Apple CIK 0000320193 的 submissions JSON，精确选择 accession 后从 www.sec.gov 下载两份 primary HTML。识别信息由用户提供，仅在进程环境中使用。

| 期间结束   | Form | filedAt（日精度） | Accession            | 原始响应字节 |
| ---------- | ---- | ----------------- | -------------------- | ------------ |
| 2023-09-30 | 10-K | 2023-11-03        | 0000320193-23-000106 | 1559035      |
| 2024-09-28 | 10-K | 2024-11-01        | 0000320193-24-000123 | 1503891      |

两份 HTML 的 SHA-256：

```text
2023: 044dedf826458ad6b6fae7bb2d923c3b761f341b793bdf3b8087e3361bb8084e
2024: 7f2f83532b95c22fc81b7c2fcecfc5d5c6cc73dd8179d63e6a477c7e8140ee65
```

首次 sec-fetch 返回 cacheHit=false。接着执行 sec-validate，返回 valid=true；同时核验 submissions JSON 和两份 HTML 的 hash、长度、metadata 关联。再调用 retrieveFilings，注入计数后立即抛错的 fetch，实测 cacheHit=true、networkCalls=0，整个过程未提供 User-Agent。

本地缓存目录：outputs/sec/0000320193/0000320193-23-000106_0000320193-24-000123。原始文件被 Git 忽略，只提交可追溯 metadata，未将公司全文或用户邮箱纳入仓库。

## 重现

首次下载按 USAGE 设置自己的 SEC_USER_AGENT，执行：

```sh
node src/cli.ts sec-fetch examples/sec-apple-annual.json outputs/sec
node src/cli.ts sec-validate outputs/sec/0000320193/0000320193-23-000106_0000320193-24-000123
node src/cli.ts sec-fetch examples/sec-apple-annual.json outputs/sec
```

首次或缓存已有时的 cacheHit 取决于本地状态。严格零网络验收可在已有缓存上执行：

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retrieveFilings } from './src/sec/retrieval.ts';
const request = JSON.parse(readFileSync('examples/sec-apple-annual.json', 'utf8'));
let networkCalls = 0;
const result = await retrieveFilings(request, 'outputs/sec', {
  fetch: async () => {
    networkCalls++;
    throw new Error('network disabled for acceptance');
  },
});
assert.equal(result.cacheHit, true);
assert.equal(networkCalls, 0);
console.log({ cacheHit: result.cacheHit, networkCalls });
JS
```

## 范围限制

只支持 SEC recent submissions 中的原始 10-K/10-Q，尚未实现历史分片。限流是单次调用范围。HTML 结构检查、HTTPS 来源约束与 SHA-256 不构成第三方独立真实性认证；filedAt 不足以做日内可用性回测。尚未提取财务指标、解释财报、调用 Bedrock 或部署 AWS。远程历史 CI 见 DEVELOPMENT，本轮未推送代码不能视为已远程验证。

## 本轮重构后的再次验收

2026-10-28 实际执行，保留初次下载的 manifest 和原始缓存。先对 outputs/sec 离线复核，与已提交 manifest 完全一致，注入失败 fetch 后命中缓存且调用数为 0。

为验证 metadata 独立校验后的首次下载路径，新建空的 outputs/sec-revalidation-XYDWQs。结果如下：

- 首次 cacheHit=false，fetch 调用 3 次（submissions + 两份 primary HTML）。
- UTC 下载时点为 21:57:42.094Z、21:57:42.587Z、21:57:43.066Z，Paris 为 22:57；两份财报的期间、来源 URL、长度与上述 SHA-256 均保持一致。
- validateCache 完整离线校验成功。再次调用时未提供 User-Agent，注入的 fetch 一旦被调用就会计数并失败；结果 cacheHit=true、调用数 0。
- 新 manifest 与验收计数保存在上述根目录的 acceptance.json，原始证据被 Git 忽略，没有写入联系邮箱。本轮不覆盖已提交的初次来源快照。

这证明本轮代码在实际 SEC 数据上的下载、来源和离线缓存行为；不将先前成功记录当作本轮未执行的结果。普通 npm run check 仍不连接 SEC。
