import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {safeEndpoint,publicConnection,parseClaudeHealth,probeHttp,probeStdio} from '../mcp.mjs';
import {once} from 'node:events';
test('public inventory does not expose credentials, headers, args or environment',()=>{
  const secret='TEST_SECRET_NOT_FOR_UI',context={id:'p',root:'C:/project',name:'Project'};
  const config={type:'http',url:`https://user:${secret}@example.com/private/${secret}?token=${secret}`,headers:{Authorization:secret},env:{KEY:secret},args:['--token',secret]};
  const result=publicConnection('Claude','test',config,context,'User');assert.equal(result.endpoint,'https://example.com');assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(safeEndpoint({command:'C:\\tools\\server.exe',args:[secret]}),'server.exe');
});
test('Claude CLI parser distinguishes connected, authentication and failures without exposing URLs',()=>{
  const rows=parseClaudeHealth('Checking MCP server health…\nplane: uvx --token PRIVATE - √ Connected\nclaude.ai CRM: https://secret.example/private?key=PRIVATE (HTTP) - ! Needs authentication\nfailed: node file.js - ✗ Failed to connect\n');
  assert.deepEqual(rows.map(r=>r.status),['connected','needs_auth','failed']);assert.equal(rows[1].endpoint,'https://secret.example');assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
});
async function serve(handler){const server=http.createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');return {server,url:`http://127.0.0.1:${server.address().port}/mcp`};}
test('HTTP probe performs initialize and tool discovery, sends auth and exposes only counts',async()=>{
  const methods=[];let authenticated=false;
  const {server,url}=await serve(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const rpc=JSON.parse(raw);methods.push(rpc.method);authenticated=req.headers.authorization==='Bearer LOCAL_TEST_TOKEN';
    if(rpc.method==='notifications/initialized'){res.writeHead(202);return res.end();}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:rpc.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{tools:{}}}:{tools:[{name:'one'},{name:'two'}]}}));
  });
  try{const result=await probeHttp({url,bearer_token_env_var:'TEST_KEY'},{TEST_KEY:'LOCAL_TEST_TOKEN'});assert.equal(result.status,'connected');assert.equal(result.toolCount,2);assert.ok(authenticated);assert.deepEqual(methods,['initialize','notifications/initialized','tools/list']);assert.ok(!JSON.stringify(result).includes('LOCAL_TEST_TOKEN'));}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('HTTP probe accepts SSE and reports authentication failures without server body',async()=>{
  let reject=false;const {server,url}=await serve(async(req,res)=>{
    if(reject){res.writeHead(401);res.end('PRIVATE');return;}
    let raw='';for await(const c of req)raw+=c;const rpc=JSON.parse(raw);if(!rpc.id){res.writeHead(202);res.end();return;}
    res.setHeader('Content-Type','text/event-stream');res.end('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-03-26',capabilities:{}}})+'\n\n');
  });
  try{assert.equal((await probeHttp({url})).status,'connected');reject=true;const r=await probeHttp({url});assert.equal(r.status,'needs_auth');assert.ok(!JSON.stringify(r).includes('PRIVATE'));}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('stdio probe uses JSON-RPC without a shell and ignores diagnostic output',async()=>{
  const fixture=`let s='';process.stdin.on('data',c=>{s+=c;let at;while((at=s.indexOf('\\n'))>=0){const r=JSON.parse(s.slice(0,at));s=s.slice(at+1);if(r.id)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result:r.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{tools:{}}}:{tools:[{name:'test'}]}})+'\\n');}});process.stderr.write('PRIVATE diagnostic');`;
  const r=await probeStdio({command:process.execPath,args:['-e',fixture]},process.cwd());assert.equal(r.status,'connected');assert.equal(r.toolCount,1);assert.ok(!JSON.stringify(r).includes('PRIVATE'));
});
test('unresolved env and dynamic auth helpers do not execute commands',async()=>{
  assert.equal((await probeHttp({url:'${MISSING}/mcp'},{})).status,'needs_config');assert.equal((await probeHttp({url:'http://127.0.0.1',http_headers_helper:'do-not-run'})).status,'cli_required');
  assert.equal((await probeStdio({command:'${MISSING}'},process.cwd(),{})).status,'needs_config');
});
