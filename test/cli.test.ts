import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const run=(...args:string[])=>spawnSync(process.execPath,['src/cli.ts',...args],{cwd,encoding:'utf8'});
test('CLI runs both offline examples and emits parseable JSON',()=>{
 for(const args of [['payoff','fixtures/call-spread.json'],['quote-payoff','fixtures/quotes.synthetic.csv','fixtures/quote-request.json']]) {
  const r=run(...args);assert.equal(r.status,0,r.stderr);const data=JSON.parse(r.stdout);
  assert.equal(data.rows[0].netPnl,'-202.60');assert.equal(data.rows[4].netPnl,'297.40');
  if(args[0]==='quote-payoff') assert.match(data.provenance.snapshotSha256,/^[a-f0-9]{64}$/);
 }
});
test('CLI errors return nonzero and JSON on stderr without partial result',()=>{
 for(const args of [[],['payoff','missing.json'],['payoff','fixtures/quotes.synthetic.csv'],['payoff','fixtures/call-spread.json','extra']]) {
  const r=run(...args);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(typeof JSON.parse(r.stderr).error,'string');
 }
});
test('CLI help succeeds',()=>{ const r=run('--help');assert.equal(r.status,0);assert.match(r.stdout,/Usage:/); });
