import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {normalizeBaseUrl,listModels,runAssignment,assignmentMessages,isLocalHost} from '../llm-agent.mjs';

test('LLM agent talks to an OpenAI-compatible server, sends key and task, strips reasoning',async()=>{
 const seen=[];const server=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;seen.push({url:req.url,auth:req.headers.authorization,body:body&&JSON.parse(body)});res.setHeader('Content-Type','application/json');
  if(req.url==='/v1/models')return res.end(JSON.stringify({data:[{id:'zalo-llm'}]}));
  if(req.url==='/v1/chat/completions')return res.end(JSON.stringify({choices:[{message:{content:'<think>PRIVATE</think>\n## Kế hoạch\n- Bước 1'}}]}));
  res.statusCode=404;res.end('{}');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const agent={baseUrl:normalizeBaseUrl(`http://127.0.0.1:${server.address().port}/v1/`),model:'zalo-llm',apiKey:'k1'};
  assert.deepEqual(await listModels(agent),['zalo-llm']);
  const out=await runAssignment(agent,{kind:'plan',task:{ticket:'ABCORE-1',title:'Thêm API',description:'Mô tả'}});
  assert.equal(out,'## Kế hoạch\n- Bước 1');
  const chat=seen.find(s=>s.url==='/v1/chat/completions');assert.equal(chat.auth,'Bearer k1');assert.equal(chat.body.model,'zalo-llm');assert.match(chat.body.messages[1].content,/ABCORE-1/);
  await assert.rejects(runAssignment({...agent,baseUrl:agent.baseUrl.replace('/v1','/v2')},{kind:'custom',prompt:'x'}),/HTTP 404/);
 }finally{server.close();}
});

test('LLM agent input validation',()=>{
 assert.throws(()=>normalizeBaseUrl('ftp://10.0.0.1'),/http/);assert.throws(()=>normalizeBaseUrl('http://u:p@10.0.0.1/v1'),/tài khoản/);assert.throws(()=>assignmentMessages({kind:'plan'}),/task hoặc/);
 assert.ok(isLocalHost('127.0.0.1:8000'));assert.ok(!isLocalHost('192.168.1.20:8000'));
});

test('Zalo config import reads only gateway keys and appends /v1',async()=>{const {zaloAgentFromEnv}=await import('../llm-agent.mjs');const a=zaloAgentFromEnv('LITELLM_AUTH_TOKEN=k2\r\nOTHER_SECRET=x\r\nLITELLM_BASE_URL=https://gw.example/\r\nLITELLM_MODEL="Gemma4-26B-A4B"\r\n');assert.deepEqual(a,{id:'zalo-ai-llm',name:'Zalo AI LLM',provider:'LLM',baseUrl:'https://gw.example/v1',model:'Gemma4-26B-A4B',apiKey:'k2'});assert.throws(()=>zaloAgentFromEnv('LITELLM_AUTH_TOKEN=k'),/thiếu/);});

test('link analysis sends vision-proxy screenshot and snapshot to the agent model',async()=>{const {analyzeLink}=await import('../llm-agent.mjs');let sent,closed=false;
 const server=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;sent=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'Trang ví dụ'}}]}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const calls=[];const connect=async()=>({call:async(name,args)=>{calls.push([name,args]);return name==='vision_analyze'?{status:'SAVED',image_artifacts:['G:/shot.png']}:'- heading "Example Domain"';},close:()=>{closed=true;}});
 try{const out=await analyzeLink(connect,{baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'m'},{url:'https://example.com'},async p=>{assert.equal(p,'G:/shot.png');return Buffer.from('PNG');});
  assert.match(out,/Trang ví dụ/);assert.match(out,/G:\/shot.png/);assert.ok(closed);assert.equal(calls[0][1].output_mode,'artifact');
  const parts=sent.messages[1].content;assert.match(parts[0].text,/Example Domain/);assert.equal(parts[1].image_url.url,'data:image/png;base64,'+Buffer.from('PNG').toString('base64'));
  await assert.rejects(analyzeLink(connect,{},{url:'file:///C:/x'},async()=>Buffer.from('')),/http/);}
 finally{server.close();}});

test('unreachable LLM falls back to ChatGPT once and reports why',async()=>{const {runAssignment}=await import('../llm-agent.mjs');const reasons=[];
 await assert.rejects(runAssignment({baseUrl:'http://127.0.0.1:9/v1',model:'m'},{kind:'custom',prompt:'x'}),/Không kết nối được 127\.0\.0\.1:9.*VPN/);
 // A fake codex binary that fails proves the fallback path ran and surfaces its own error.
 await assert.rejects(runAssignment({baseUrl:'http://127.0.0.1:9/v1',model:'m'},{kind:'custom',prompt:'x'},{codexBin:process.execPath+'-missing',onFallback:e=>reasons.push(e.message)}),/ENOENT|spawn/);
 assert.equal(reasons.length,1);assert.match(reasons[0],/VPN/);});
