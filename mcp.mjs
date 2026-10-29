import {readFile,writeFile} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
const exec=promisify(execFile),sha=s=>createHash('sha256').update(s).digest('hex');
const normalize=p=>path.resolve(p).replaceAll('\\','/').toLowerCase();
const initialize={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'orbit-mcp-check',version:'1.0.0'}}};
async function json(file,fallback={}){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('Không đọc được cấu hình JSON: '+path.basename(file));}}
export function safeEndpoint(config){
  if(config.url){try{const u=new URL(config.url);return u.origin==='null'?'URL chưa resolve':u.origin;}catch{return 'URL dùng biến môi trường';}}
  return String(config.command||'Không có lệnh').split(/[\\/]/).at(-1).slice(0,60);
}
export function publicConnection(provider,name,config,context,source){
  const type=config.type||(config.url?'http':'stdio');
  return {id:sha(JSON.stringify([provider,name,config])),provider,name:String(name).slice(0,120),transport:type==='streamable_http'||type==='streamable-http'?'http':type,endpoint:safeEndpoint(config),enabled:config.enabled!==false,contexts:[context],source,status:config.enabled===false?'disabled':'unchecked',checkedAt:null,toolCount:null};
}
export function parseClaudeHealth(output){
  const rows=[];
  for(const line of output.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)){
    const m=line.match(/^(.+?):\s+(.+?)\s+-\s+(.+)$/);if(!m)continue;
    const status=/Connected/i.test(m[3])?'connected':/Needs auth/i.test(m[3])?'needs_auth':/Pending approval/i.test(m[3])?'pending':/Disabled|Rejected|Blocked/i.test(m[3])?'disabled':/Failed|Error|Timed out/i.test(m[3])?'failed':null;
    if(!status)continue;
    const url=m[2].match(/https?:\/\/[^\s]+/i)?.[0];
    rows.push({name:m[1].slice(0,120),status,transport:url?'http':'stdio',endpoint:url?safeEndpoint({url}):'CLI quản lý'});
  }
  return rows;
}
function expand(value,env){return String(value).replace(/\$\{([^}:]+)(?::-([^}]*))?\}/g,(_,key,fallback)=>env[key]??fallback??'${'+key+'}');}
async function httpMessage(url,headers,message,signal){
  const response=await fetch(url,{method:'POST',redirect:'error',headers:{...headers,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify(message),signal});
  if(response.status===401||response.status===403)throw Error('needs_auth');
  if(!response.ok)throw Error('failed');
  if(message.id===undefined){await response.body?.cancel();return {};}
  const reader=response.body?.getReader();if(!reader)throw Error('failed');
  const decoder=new TextDecoder();let text='';
  try{while(true){const {done,value}=await reader.read();if(value)text+=decoder.decode(value,{stream:!done});if(text.length>2_000_000)throw Error('oversized');
    if(response.headers.get('content-type')?.includes('text/event-stream')){
      text=text.replaceAll('\r\n','\n');let end;
      while((end=text.indexOf('\n\n'))>=0){const event=text.slice(0,end);text=text.slice(end+2);const data=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)continue;let rpc;try{rpc=JSON.parse(data);}catch{continue;}if(rpc.id===message.id)return {rpc,session:response.headers.get('mcp-session-id')};}
    }else if(done)return {rpc:JSON.parse(text),session:response.headers.get('mcp-session-id')};
    if(done)throw Error('failed');
  }}finally{await reader.cancel().catch(()=>{});}
}
export async function probeHttp(config,env=process.env){
  if(config.http_headers_helper)return {status:'cli_required',toolCount:null};
  const url=expand(config.url,env),headers={};
  if(url.includes('${'))return {status:'needs_config',toolCount:null};
  const u=new URL(url);if(!['http:','https:'].includes(u.protocol))return {status:'unsupported',toolCount:null};
  for(const [k,v] of Object.entries(config.http_headers||config.headers||{}))headers[k]=expand(v,env);
  for(const [k,v] of Object.entries(config.env_http_headers||{})){if(!env[v])return {status:'needs_config',toolCount:null};headers[k]=env[v];}
  if(config.bearer_token_env_var){if(!env[config.bearer_token_env_var])return {status:'needs_config',toolCount:null};headers.Authorization='Bearer '+env[config.bearer_token_env_var];}
  if(Object.values(headers).some(v=>v.includes('${')))return {status:'needs_config',toolCount:null};
  const signal=AbortSignal.timeout(10000),start=Date.now();
  try{
    const init=await httpMessage(url,headers,initialize,signal);
    if(init.rpc?.error||!init.rpc?.result?.protocolVersion)throw Error('failed');
    if(init.session)headers['Mcp-Session-Id']=init.session;
    headers['MCP-Protocol-Version']=init.rpc.result.protocolVersion;
    await httpMessage(url,headers,{jsonrpc:'2.0',method:'notifications/initialized'},signal);
    let toolCount=null;
    if(init.rpc.result.capabilities?.tools){const r=await httpMessage(url,headers,{jsonrpc:'2.0',id:2,method:'tools/list'},signal);if(Array.isArray(r.rpc?.result?.tools))toolCount=r.rpc.result.tools.length;}
    return {status:'connected',toolCount,latencyMs:Date.now()-start};
  }catch(e){return {status:e.message==='needs_auth'?'needs_auth':'failed',toolCount:null,latencyMs:Date.now()-start};}
}
function terminate(child){if(child.exitCode!==null||!child.pid)return;if(process.platform==='win32')execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill('SIGTERM');}
export function probeStdio(config,root,env=process.env){
  return new Promise(resolve=>{
    const environment={...env,...config.env};
    for(const key of Object.keys(environment))environment[key]=expand(environment[key],environment);
    const command=expand(config.command||'',environment),args=(config.args||[]).map(a=>expand(a,environment));
    if(!command||[command,...args].some(s=>s.includes('${'))){resolve({status:'needs_config',toolCount:null});return;}
    if(process.platform==='win32'&&/\.(cmd|bat)$/i.test(command)){resolve({status:'cli_required',toolCount:null});return;}
    const start=Date.now(),child=spawn(command,args,{cwd:config.cwd?path.resolve(root,config.cwd):root,env:environment,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
    let buffer='',done=false,initialized=false,deadline;
    function finish(status,toolCount=null){if(done)return;done=true;clearTimeout(deadline);terminate(child);resolve({status,toolCount,latencyMs:Date.now()-start});}
    function send(message){child.stdin.write(JSON.stringify(message)+'\n');}
    child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>2_000_000)return finish('failed');let at;
      while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);let r;try{r=JSON.parse(line);}catch{continue;}
        if(r.id===1){if(r.error||!r.result?.protocolVersion)return finish('failed');initialized=true;send({jsonrpc:'2.0',method:'notifications/initialized'});if(r.result.capabilities?.tools)send({jsonrpc:'2.0',id:2,method:'tools/list'});else return finish('connected');}
        if(r.id===2)return finish(initialized?'connected':'failed',Array.isArray(r.result?.tools)?r.result.tools.length:null);
      }
    });
    child.stderr.resume();child.stdin.on('error',()=>{});child.on('error',()=>finish('failed'));child.on('close',()=>finish(initialized?'connected':'failed'));
    deadline=setTimeout(()=>finish(initialized?'connected':'failed'),12000);deadline.unref();send(initialize);
  });
}
export async function createMcpMonitor(cli,base,cachePath){
  let connections=[],warnings=[],updatedAt=null,refreshing=false,checking=false,contexts=[];
  const privateConfigs=new Map(),health=new Map();
  if(cachePath){const cached=await json(cachePath,{connections:[]});connections=cached.connections||[];updatedAt=cached.updatedAt||null;for(const c of connections)if(c.checkedAt)health.set(c.id,{status:c.status,checkedAt:c.checkedAt,checkedContext:c.checkedContext,toolCount:c.toolCount??null,...(c.latencyMs===undefined?{}:{latencyMs:c.latencyMs})});}
  function snapshot(){return {connections:connections.map(c=>({...c,...health.get(c.id)})),warnings,updatedAt,refreshing,checking};}
  async function persisted(){const result=snapshot();if(cachePath)await writeFile(cachePath,JSON.stringify(result));return result;}
  async function refresh(projects){
    if(refreshing)return snapshot();refreshing=true;
    const next=[],notes=[],secrets=new Map();
    try{
      const home=os.homedir(),claudeHome=process.env.CLAUDE_CONFIG_DIR||path.join(home,'.claude');
      const config=await json(process.env.CLAUDE_CONFIG_DIR?path.join(claudeHome,'.claude.json'):path.join(home,'.claude.json'));
      const userSettings=await json(path.join(claudeHome,'settings.json'));
      contexts=projects.filter(p=>p.kind!=='library').map(p=>({id:p.id,name:p.name,root:p.root}));if(!contexts.some(p=>normalize(p.root)===normalize(base)))contexts.unshift({id:'workspace',name:'Orbit workspace',root:base});
      for(const context of contexts){
        const keys=Object.keys(config.projects||{}),projectKey=keys.find(k=>k===context.root)||keys.find(k=>k===context.root.replaceAll('\\','/'))||keys.find(k=>normalize(k)===normalize(context.root));
        const local=config.projects?.[projectKey]||{};
        let projectFile={},settings={},localSettings={};
        try{projectFile=await json(path.join(context.root,'.mcp.json'));settings=await json(path.join(context.root,'.claude','settings.json'));localSettings=await json(path.join(context.root,'.claude','settings.local.json'));}catch{notes.push('Claude / '+context.name+': không đọc được cấu hình dự án.');}
        const environment={...process.env,...userSettings.env,...settings.env,...localSettings.env};
        const rejected=new Set([...(userSettings.disabledMcpjsonServers||[]),...(settings.disabledMcpjsonServers||[]),...(localSettings.disabledMcpjsonServers||[]),...(local.disabledMcpjsonServers||[])]);
        const disabled=new Set(local.disabledMcpServers||[]);
        const merged={};for(const [scope,servers] of [['User',config.mcpServers],['Project',projectFile.mcpServers],['Local',local.mcpServers]])for(const [name,cfg] of Object.entries(servers||{}))merged[name]={cfg,scope};
        for(const [name,{cfg,scope}] of Object.entries(merged)){
          const raw={...cfg,enabled:cfg.enabled!==false&&!disabled.has(name)&&!(scope==='Project'&&rejected.has(name))};
          const entry=publicConnection('Claude',name,raw,context,scope);
          if(raw.url&&!raw.type)entry.status='needs_config';
          entry.id=sha(entry.id+JSON.stringify({...userSettings.env,...settings.env,...localSettings.env}));next.push(entry);secrets.set(entry.id,{config:raw,environment,context});
        }
        if(cli.Codex){try{const {stdout}=await exec(cli.Codex,['mcp','list','--json'],{cwd:context.root,windowsHide:true,timeout:10000,maxBuffer:2_000_000});const list=JSON.parse(stdout);for(const item of list){const raw={...item.transport,enabled:item.enabled};const entry=publicConnection('Codex',item.name,raw,context,'Codex CLI');entry.authentication=item.auth_status==='unsupported'?'Không công bố':item.auth_status;next.push(entry);secrets.set(entry.id,{config:raw,environment:process.env,context});}}catch{notes.push('Codex / '+context.name+': không lấy được danh sách cấu hình.');}}
      }
      const unique=new Map();for(const c of next){const old=unique.get(c.id);if(old)old.contexts.push(...c.contexts);else unique.set(c.id,c);}
      // Cloud connectors discovered by the official Claude CLI are retained until the next CLI scan.
      for(const c of connections.filter(c=>c.source==='Claude CLI'))if(!unique.has(c.id))unique.set(c.id,c);
      connections=[...unique.values()];privateConfigs.clear();for(const [id,value] of secrets)privateConfigs.set(id,value);warnings=notes;updatedAt=new Date().toISOString();
    }catch{warnings=['Không đọc được một nguồn cấu hình MCP. Kiểm tra JSON và quyền đọc trên máy.'];}finally{refreshing=false;}
    return persisted();
  }
  async function check(id,contextId){
    if(checking)throw Error('Đang kiểm tra MCP khác');
    const entry=connections.find(c=>c.id===id),privateData=privateConfigs.get(id);
    if(!entry)throw Error('Không tìm thấy MCP');if(!entry.enabled)return snapshot();
    if(!privateData)throw Error('Kết nối này do Claude CLI quản lý; dùng Kiểm tra Claude');
    checking=true;try{const {config,environment}=privateData,context=entry.contexts.find(c=>c.id===contextId)||entry.contexts[0];let result;
      if(entry.status==='needs_config')result={status:'needs_config',toolCount:null};
      else if(entry.transport==='http')result=await probeHttp(config,environment);
      else if(entry.transport==='stdio')result=await probeStdio(config,context.root,environment);
      else result={status:'cli_required',toolCount:null};
      health.set(id,{...result,checkedAt:new Date().toISOString(),checkedContext:context.name});
    }finally{checking=false;}
    return persisted();
  }
  async function scanClaude(contextId){
    if(checking)throw Error('Đang kiểm tra MCP khác');if(!cli.Claude)throw Error('Chưa tìm thấy Claude CLI');const context=contexts.find(c=>c.id===contextId)||contexts[0];if(!context)throw Error('Chưa có dự án');checking=true;
    try{
      const {stdout}=await exec(cli.Claude,['mcp','list'],{cwd:context.root,windowsHide:true,timeout:60000,maxBuffer:2_000_000});const rows=parseClaudeHealth(stdout),now=new Date().toISOString();
      if(!rows.length)throw Error('Không có trạng thái MCP từ CLI');
      connections=connections.filter(c=>!(c.source==='Claude CLI'&&c.contexts.some(p=>p.id===context.id)));
      for(const row of rows){const match=connections.find(c=>c.provider==='Claude'&&c.name===row.name&&c.contexts.some(p=>p.id===context.id));
        if(match)health.set(match.id,{status:match.enabled?row.status:'disabled',toolCount:null,checkedAt:now,checkedContext:context.name});
        else{const entry={...row,id:sha('Claude CLI'+context.id+row.name),provider:'Claude',enabled:row.status!=='disabled',contexts:[context],source:'Claude CLI',checkedAt:now,checkedContext:context.name,toolCount:null};connections.push(entry);}
      }
      updatedAt=now;
    }catch{throw Error('Claude CLI chưa trả được danh sách health trong 60 giây. Không thay đổi quyền hoặc đăng nhập.');}finally{checking=false;}
    return persisted();
  }
  return {snapshot,refresh,check,scanClaude};
}
