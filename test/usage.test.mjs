import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseEvents,day,createScanner} from '../usage.mjs';
import {commandArgs,extractText} from '../runner.mjs';
const time='2026-10-28T18:00:00Z';
const token=(input,output,timestamp=time)=>({type:'event_msg',timestamp,payload:{type:'token_count',info:{total_token_usage:{input_tokens:input,cached_input_tokens:input/2,output_tokens:output,reasoning_output_tokens:output/2}}}});
test('Codex cumulative counters count increments once and keep cache/reasoning as subsets',()=>{
  const rows=parseEvents([{type:'session_meta',payload:{id:'s1',cwd:'repo'}},{type:'turn_context',payload:{model:'test-model'}},token(100,10),token(100,10),token(200,30,'2026-10-29T18:00:00Z')],'Codex','fallback');
  assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.total),[110,120]);assert.equal(rows.reduce((s,r)=>s+r.total,0),230);assert.equal(rows[0].date,'2026-10-29');assert.equal(rows[1].date,'2026-10-30');assert.equal(rows[0].model,'test-model');
});
test('Claude streaming updates merge and distinct messages retain additive cache categories',()=>{
  const message=(id,out)=>({type:'assistant',timestamp:time,requestId:'req',message:{id,model:'claude-test',usage:{input_tokens:10,cache_read_input_tokens:50,cache_creation_input_tokens:20,output_tokens:out}}});
  const rows=parseEvents([message('one',2),message('one',12),message('two',5)],'Claude','session');
  assert.equal(rows.length,2);assert.equal(rows.reduce((s,r)=>s+r.total,0),177);
});
test('Vietnam day boundaries and missing usage',()=>{assert.equal(day('2026-10-29T17:00:00Z'),'2026-10-30');assert.deepEqual(parseEvents([token(0,0),{type:'event_msg',payload:{type:'token_count'}}],'Codex','x'),[]);});
test('scanner deduplicates archived sessions, tolerates partial writes and refreshes changed files',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'orbit-test-'));
  try{const a=path.join(dir,'active'),b=path.join(dir,'archive');await mkdir(a);await mkdir(b);const lines=[{type:'session_meta',payload:{id:'same'}},token(100,10)].map(JSON.stringify).join('\n');await writeFile(path.join(a,'s.jsonl'),lines+'\n{partial');await writeFile(path.join(b,'s.jsonl'),lines);const scan=createScanner();const roots=[{provider:'Codex',root:a},{provider:'Codex',root:b}];let result=await scan(roots);assert.equal(result.records.length,1);assert.equal(result.warnings.length,1);await writeFile(path.join(a,'s.jsonl'),lines+'\n'+JSON.stringify(token(200,30,'2026-10-29T18:00:00Z')));result=await scan(roots);assert.equal(result.records.reduce((n,r)=>n+r.total,0),230);}finally{await rm(dir,{recursive:true,force:true});}
});
test('AI runner restricts read mode and extracts final messages without rendering tool commands',()=>{
  assert.ok(commandArgs('Codex','read').includes('read-only'));assert.ok(commandArgs('Claude','read').includes('Read,Glob,Grep'));assert.equal(extractText('Codex',{type:'item.completed',item:{type:'agent_message',text:'Done'}}),'Done');assert.equal(extractText('Codex',{type:'item.completed',item:{type:'command_execution',command:'secret'}}),'');assert.equal(extractText('Claude',{type:'assistant',message:{content:[{type:'text',text:'Hello'},{type:'tool_use',name:'Edit'}]}}),'Hello');
});
test('external documentation folder is writable only for code mode and stays one CLI argument',()=>{
  const folder='G:\\Work\\docs\\AI-Hub\\docs\\projects\\base v3\\features';
  for(const provider of ['Claude','Codex']){
    const args=commandArgs(provider,'code',folder),at=args.indexOf('--add-dir');
    assert.ok(at>=0);assert.equal(args[at+1],folder);assert.ok(!commandArgs(provider,'read',folder).includes('--add-dir'));
  }
});
test('document discovery reaches nested SDK references and skips symlinks',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'orbit-docs-'));
  try{const deep=path.join(dir,'docs','projects','base-v3','reference','docs','miniapp-api','zmp-sdk','apis');await mkdir(deep,{recursive:true});await writeFile(path.join(deep,'auth.md'),'# Auth');const files=await (await import('../usage.mjs')).filesUnder(dir,'.md',20);assert.equal(files.length,1);assert.equal(path.basename(files[0]),'auth.md');}finally{await rm(dir,{recursive:true,force:true});}
});
