import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {budgetDecision,codexQuotaRemaining,createBudgetMonitor} from '../budget.mjs';
test('20 percent is allowed; either low context or quota blocks; unknown/stale never means full',()=>{
 const at=1000000;
 assert.equal(budgetDecision([{label:'quota',remaining:20,at}],at).allowed,true);
 for(const row of [{remaining:19.9,at},{remaining:90,at:at-300001},{remaining:null,at},{remaining:100,at:at+2000}])assert.equal(budgetDecision([{label:'quota',remaining:90,at},{label:'context',...row}],at).allowed,false);
});
test('Codex uses the tighter relevant usage window and handles missing/zero values',()=>{
 assert.equal(codexQuotaRemaining({rateLimitsByLimitId:{codex:{primary:{usedPercent:0},secondary:{usedPercent:85}}}}),15);
 assert.equal(codexQuotaRemaining({rateLimits:{primary:{usedPercent:0}}}),100);
 assert.equal(codexQuotaRemaining({rateLimits:{primary:{usedPercent:null}}}),null);
 assert.equal(codexQuotaRemaining({ordinaryUsageAllowed:false}),0);
});
test('source context and destination quota are checked separately without mixing session IDs',async t=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'tn-budget-'));t.after(()=>rm(data,{recursive:true,force:true}));
 const monitor=await createBudgetMonitor({data,readCodexLimits:async()=>({rateLimits:{primary:{usedPercent:30}}})});
 await monitor.capture({provider:'claude',sessionId:'source-session',quotaRemaining:60,contextRemaining:19});
 assert.equal((await monitor.check({target:'codex',source:'claude',sourceSession:'source-session'})).allowed,false);
 await monitor.capture({provider:'claude',sessionId:'source-session',contextRemaining:20});
 assert.equal((await monitor.check({target:'codex',source:'claude',sourceSession:'source-session'})).allowed,true);
 assert.equal((await monitor.check({target:'codex',targetSession:'other-session'})).allowed,false);
 await assert.rejects(monitor.capture({provider:'claude',sessionId:'../../secret',contextRemaining:99}));
 await assert.rejects(monitor.capture({provider:'claude',quotaRemaining:101}));
});

test('fresh manual context can replace an older log observation for the same session',async t=>{const data=await mkdtemp(path.join(os.tmpdir(),'tn-budget-fresh-'));t.after(()=>rm(data,{recursive:true,force:true}));const monitor=await createBudgetMonitor({data,readContext:async()=>({remaining:10,at:Date.now()-600000})});await monitor.capture({provider:'claude',quotaRemaining:60,sessionId:'real-session',contextRemaining:60});assert.equal((await monitor.check({target:'claude',targetSession:'real-session'})).allowed,true);});
