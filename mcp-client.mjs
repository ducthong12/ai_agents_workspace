import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const expand=(s,env)=>String(s).replace(/\$\{([^}:]+)(?::-([^}]*))?\}/g,(_,k,f)=>env[k]??f??'${'+k+'}');
export function unpack(result){
  if(result?.isError)throw Error((result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').slice(0,1000)||'MCP tool failed');
  if(result?.structuredContent)return result.structuredContent;
  const texts=(result?.content||[]).filter(c=>c.type==='text').map(c=>c.text);const parsed=[];for(const t of texts){try{parsed.push(JSON.parse(t));}catch{}}if(parsed.length===1)return parsed[0];
  const text=texts.join('\n');
  try{return JSON.parse(text);}catch{return text;}
}
export async function connectServer(codexBinary,name,root,{desktopAction=false,transport}={}){
  const definition=transport?{transport}:JSON.parse((await exec(codexBinary,['mcp','get',name,'--json'],{cwd:root,windowsHide:true,timeout:10000,maxBuffer:2_000_000})).stdout);if(definition.enabled===false&&!(name==='codex_app'&&desktopAction))throw Error('MCP '+name+' đang tắt trong cấu hình');
  const config=definition.transport;if(config.type!=='stdio')throw Error('Bridge yêu cầu transport stdio: '+name);
  const env={...process.env,...config.env};for(const k of Object.keys(env))env[k]=expand(env[k],env);
  if(name==='codex_app'&&desktopAction)env.CODEX_APP_TOOLS_CALLER_HOST_ID='local';
  const command=expand(config.command,env),args=(config.args||[]).map(a=>expand(a,env));if([command,...args].some(s=>s.includes('${')))throw Error('Thiếu biến môi trường cho MCP '+name);
  const child=spawn(command,args,{cwd:config.cwd||root,env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
  let serial=0,buffer='',closed=false;const pending=new Map();
  const fail=()=>{closed=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('MCP '+name+' đã ngắt kết nối'));}pending.clear();};
  child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>16_000_000){fail();child.kill();return;}let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);let rpc;try{rpc=JSON.parse(line);}catch{continue;}if(rpc.method&&rpc.id!==undefined){child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:rpc.id,error:{code:-32601,message:'Client method not supported'}})+'\n');continue;}const p=pending.get(rpc.id);if(p){clearTimeout(p.timer);pending.delete(rpc.id);if(rpc.error)p.reject(Error('MCP '+name+': '+String(rpc.error.message).slice(0,500)));else p.resolve(rpc.result);}}});
  child.stderr.resume();child.on('error',fail);child.on('close',fail);child.stdin.on('error',fail);
  function send(method,params,id){child.stdin.write(JSON.stringify({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,...(params===undefined?{}:{params})})+'\n');}
  function request(method,params,timeout=60000){if(closed)return Promise.reject(Error('MCP '+name+' không hoạt động'));const id=++serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP '+name+' chưa trả lời trong thời gian cho phép'));},timeout);pending.set(id,{resolve,reject,timer});send(method,params,id);});}
  function close(){if(closed)return;child.stdin.end();const timer=setTimeout(()=>{if(child.exitCode!==null)return;if(process.platform==='win32'&&child.pid)execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill('SIGTERM');},1500);timer.unref();}
  try{await request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'tn-workspace',version:'1.0.0'}},20000);send('notifications/initialized');const result=await request('tools/list');const tools=result.tools||[];
    return {tools,close,call:async(wanted,args={},options={})=>{const tool=tools.find(t=>t.name===wanted||t.name.endsWith('__'+wanted));if(!tool)throw Error('MCP '+name+' không có tool '+wanted);return unpack(await request('tools/call',{name:tool.name,arguments:args,...(name==='codex_app'&&process.env.CODEX_THREAD_ID?{_meta:{'openai/threadId':process.env.CODEX_THREAD_ID}}:{})},options.timeoutMs||(name==='codex_app'?60000:180000)));}};
  }catch(e){close();throw e;}
}
