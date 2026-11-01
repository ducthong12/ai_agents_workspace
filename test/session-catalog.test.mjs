import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createLocalSessionCatalog} from '../session-catalog.mjs';
import {createStudio} from '../studio.mjs';
import {WORKFLOW_ID} from '../public/workflow.js';

async function fixture(t){
 const prefix=path.join(os.tmpdir(),'tn-log-catalog-'),base=await mkdtemp(prefix);
 t.after(async()=>{assert.ok(path.resolve(base).startsWith(prefix));await rm(base,{recursive:true,force:true});});
 const codex=path.join(base,'codex','sessions'),claude=path.join(base,'claude','projects','repo');
 await mkdir(codex,{recursive:true});await mkdir(claude,{recursive:true});
 const id='12345678-1234-1234-1234-123456789012';
 const codexFile=path.join(codex,'rollout-'+id+'.jsonl'),claudeFile=path.join(claude,id+'.jsonl');
 await writeFile(codexFile,[{type:'session_meta',payload:{id,cwd:'D:/Work/repo',token:'PRIVATE_CREDENTIAL'}},{type:'turn_context',payload:{model:'model-codex'}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'A visible question'}]}}].map(x=>JSON.stringify(x)).join('\n')+'\n');
 await writeFile(claudeFile,[{type:'user',cwd:'D:/Work/claude-repo',slug:'claude-session',message:{role:'user',content:'Claude question'}},{type:'assistant',message:{model:'model-claude',role:'assistant',content:[{type:'text',text:'Claude reply'},{type:'thinking',thinking:'PRIVATE_THOUGHT'}]}}].map(x=>JSON.stringify(x)).join('\n')+'\n');
 return {base,codex,claude,id,codexFile,claudeFile,roots:[codex,path.dirname(claude)]};
}

test('local catalog exposes metadata and model, deduplicates roots and excludes subagents and bodies',async t=>{
 const f=await fixture(t),scan=createLocalSessionCatalog();
 await writeFile(path.join(f.claude,'agent-'+f.id+'.jsonl'),'{}\n');
 await mkdir(path.join(f.claude,'subagents'));await writeFile(path.join(f.claude,'subagents',f.id+'.jsonl'),'{}\n');
 const rows=await scan([...f.roots,f.codex]);assert.equal(rows.length,2);
 assert.equal(rows.find(s=>s.provider==='codex').model,'model-codex');assert.equal(rows.find(s=>s.provider==='claude-code').model,'model-claude');
 assert.ok(rows.every(s=>s.readOnly));assert.ok(!JSON.stringify(rows).includes('PRIVATE_'));assert.ok(!JSON.stringify(rows).includes('visible question'));
 assert.deepEqual(await scan(f.roots),rows);
 await writeFile(f.claudeFile,JSON.stringify({type:'custom-title',customTitle:'Updated title',cwd:'D:/Work/repo'})+'\n');
 assert.equal((await scan(f.roots)).find(s=>s.provider==='claude-code').title,'Updated title');
});

test('catalog reads at most the metadata prefix, ignoring a later title',async t=>{
 const f=await fixture(t);await writeFile(f.codexFile,JSON.stringify({type:'session_meta',payload:{cwd:'D:/Work/repo'}})+'\n'+JSON.stringify({type:'tool_output',text:'x'.repeat(80000)})+'\n'+JSON.stringify({type:'custom-title',customTitle:'PRIVATE_LATE_TITLE'})+'\n');
 const row=(await createLocalSessionCatalog()([f.codex]))[0];assert.ok(row.title.includes('repo'));assert.ok(!JSON.stringify(row).includes('PRIVATE_LATE_TITLE'));
});

test('history mode lists both providers and reads selected text without calling Desktop or allowing sends',async t=>{
 const f=await fixture(t);let calls=0;
 const studio=await createStudio({cli:{},base:f.base,data:path.join(f.base,'data'),codeRoots:f.roots,claudeDesktopRoot:path.join(f.base,'missing'),logCatalog:true,readOnly:true,connect:async()=>{calls++;throw Error('Desktop must not be called');}});
 const state=await studio.refresh();assert.equal(state.sessions.length,2);assert.deepEqual(state.capabilities,{send:false,open:false});assert.deepEqual(state.sources.map(s=>s.count),[1,1]);
 assert.equal((await studio.read('codex:'+f.id)).messages[0].text,'A visible question');
 const detail=await studio.read('claude-code:'+f.id);assert.equal(detail.messages.length,2);assert.ok(!JSON.stringify(detail).includes('PRIVATE_THOUGHT'));
 await assert.rejects(studio.send({sessionId:'codex:'+f.id,prompt:'Continue',requestId:'request-12345678',confirmedWorkflow:WORKFLOW_ID}),/chế độ xem lịch sử/);
 await assert.rejects(studio.openSession('codex:'+f.id),/chỉ hỗ trợ xem/);assert.equal(calls,0);
});

test('Desktop metadata and local logs merge the same Claude session without duplicate rows',async t=>{
 const f=await fixture(t),metadata=path.join(f.base,'metadata');await mkdir(metadata);
 await writeFile(path.join(metadata,'local_'+f.id+'.json'),JSON.stringify({sessionId:'local_'+f.id,cliSessionId:f.id,title:'Native title',cwd:'D:/Work/repo'}));
 const studio=await createStudio({cli:{},base:f.base,data:path.join(f.base,'data'),codeRoots:f.roots,claudeDesktopRoot:metadata,logCatalog:true,readOnly:true});
 const state=await studio.refresh();assert.equal(state.sources.find(s=>s.provider==='claude-code').count,1);const session=state.sessions.find(s=>s.provider==='claude-code');assert.equal(session.title,'Native title');assert.equal(session.model,'model-claude');assert.equal(session.readOnly,true);
});
