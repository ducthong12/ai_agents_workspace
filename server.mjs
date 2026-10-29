import {syncBrandDocs} from './brand-docs.mjs';
import {createBudgetMonitor} from './budget.mjs';
import {connectServer} from './mcp-client.mjs';
import {createClaudeDesktop} from './claude-desktop.mjs';
import {claudeSessionHealth,taskTrace} from './trace.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir,rename,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {createScanner,filesUnder} from './usage.mjs';
import {discoverCLIs,startJob} from './runner.mjs';
import {createMcpMonitor} from './mcp.mjs';
import {installLocalInstructions} from './instructions.mjs';
import {createAuth} from './auth.mjs';
import {createTaskMonitor} from './tasks.mjs';
import {discoverProjects} from './projects.mjs';
import {createStudio} from './studio.mjs';

const base=path.dirname(fileURLToPath(import.meta.url)),data=path.join(base,'data');
await mkdir(data,{recursive:true});
const auth=await createAuth(data);
const storeFile=path.join(data,'workspace.json');
let store;
try{store=JSON.parse(await readFile(storeFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;store={projects:[],docs:[]};}
const workRoot=process.env.TN_WORK_ROOT||store.workspaceRoot||'G:/Work',brandRoot=process.env.TN_AI_DOCS_ROOT||path.join(workRoot,'docs','AI');
async function save(){const tmp=storeFile+'.tmp';await writeFile(tmp,JSON.stringify(store,null,2));await rename(tmp,storeFile);}
const run=promisify(execFile),scan=createScanner();
const roots=[{provider:'Codex',root:path.join(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),'sessions')},{provider:'Codex',root:path.join(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),'archived_sessions')},{provider:'Claude',root:path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(),'.claude'),'projects')}];
let usage={records:[],sources:[],warnings:[]},busy=false,lastSync=null,syncError=null;
const cli=await discoverCLIs(),jobs=[],running=new Map();
const mcp=await createMcpMonitor(cli,base,path.join(data,'mcp-snapshot.json'));
const openClaudeURL=async url=>{if(!url.startsWith('claude://'))throw Error('URI Claude không hợp lệ');await new Promise((resolve,reject)=>{const p=spawn('explorer.exe',[url],{windowsHide:true,detached:true,stdio:'ignore'});p.once('error',reject);p.once('spawn',()=>{p.unref();resolve();});});};
let budgets;const claudeDesktop=createClaudeDesktop({data,openURL:openClaudeURL,docsRoot:brandRoot,checkBudget:args=>budgets.check(args)});
const tasks=await createTaskMonitor({cli,base,data,claudeDesktop,workspaceRoot:workRoot});
const studio=await createStudio({cli,base,data,claudeDesktop,checkBudget:args=>budgets.check(args),openExternal:async url=>{if(!url.startsWith('https://claude.ai/'))throw Error('URL không hợp lệ');await run('explorer.exe',[url],{windowsHide:true});}});
budgets=await createBudgetMonitor({data,readCodexLimits:async()=>{const client=await connectServer(cli.Codex,'codex_app',base,{desktopAction:true});try{return await client.call('get_usage_limits',{},{timeoutMs:8000});}finally{client.close();}},readContext:async(provider,id)=>(await studio.traceThread(id,provider==='claude'?'claude-code':'codex')).contextBudget});
const hash=s=>createHash('sha256').update(s).digest('hex');
async function syncProject(p) {
  const docs=[];
  const documentRoot=p.documentationRoot || p.root;
  for(const file of await filesUnder(documentRoot,'.md',20)) {
    const rel=path.relative(documentRoot,file),mirror=rel.replaceAll('\\','/').match(/^docs\/shared\/imported-ai\/(.+)$/i);if(p.kind==='library'&&mirror&&brandPaths.has(mirror[1].toLowerCase()))continue;
    if(p.kind!=='library'&&!p.documentationRoot&&!/^(docs[\\/]|README\.md$|AGENTS\.md$|CLAUDE\.md$)/i.test(rel))continue;
    const s=await stat(file);if(s.size>512000)continue;
    const content=await readFile(file,'utf8');
    docs.push({id:hash(file.toLowerCase()),project:p.name,projectId:p.id,title:content.match(/^#\s+(.+)$/m)?.[1] || rel,content,source:rel,kind:'Đồng bộ',updatedAt:s.mtime.toISOString()});
  }
  if(p.kind==='library')return docs;
  try{
    const {stdout}=await run('git',['-C',p.root,'status','--porcelain=v1','--untracked-files=normal'],{maxBuffer:1024*1024,timeout:10000,windowsHide:true});
    const fingerprint=hash(stdout);
    if(stdout.trim() && p.fingerprint!==fingerprint) {
      const now=new Date().toISOString();
      store.docs.unshift({id:randomUUID(),project:p.name,projectId:p.id,title:'Thay đổi mã nguồn · '+now.slice(0,16).replace('T',' '),content:'# Nhật ký thay đổi tự động\n\nPhát hiện từ Git status. Đây là danh sách file; phần giải thích do AI ghi trong thư mục tài liệu đã cấu hình cho dự án.\n\n```text\n'+stdout.trim()+'\n```',source:'Git watcher',kind:'Tự động',updatedAt:now});
    }
    p.fingerprint=fingerprint;p.gitError=null;
  }catch{p.gitError='Không đọc được Git. Tài liệu Markdown vẫn được đồng bộ.';}
  return docs;
}
let indexed=[],brandStats=null,brandPaths=new Set();
async function sync(){
  if(busy)return;busy=true;
  try{const scanned=await scan(roots);const grouped=new Map();for(const r of scanned.records){if(!r.total)continue;const key=JSON.stringify([r.date,r.provider,r.session,r.project,r.model]);if(!grouped.has(key))grouped.set(key,{...r,input:0,cached:0,write:0,output:0,reasoning:0,total:0});const g=grouped.get(key);for(const k of ['input','cached','write','output','reasoning','total'])g[k]+=r[k];if(r.timestamp>g.timestamp)g.timestamp=r.timestamp;}usage={...scanned,records:[...grouped.values()]};const brand=await syncBrandDocs({projects:store.discoveredProjects||[],workRoot,docRoot:brandRoot});brandStats=brand.stats;brandPaths=new Set(brand.docs.map(d=>d.source.replaceAll('\\','/').toLowerCase()));const next=[...brand.docs];for(const p of store.projects){try{next.push(...await syncProject(p));p.error=null;}catch(e){p.error=e.message;next.push(...indexed.filter(d=>d.projectId===p.id));}}indexed=[...new Map(next.map(d=>[d.id,d])).values()];await save();lastSync=new Date().toISOString();syncError=null;}
  catch(e){syncError=e.message;}finally{busy=false;}
}
const port=Number(process.env.PORT || 4317);
function reply(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
async function body(req,limit=600000){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>limit)throw Error('Nội dung quá lớn');}return JSON.parse(raw || '{}');}
let mutation=Promise.resolve();
async function handle(req,res){
  const host=req.headers.host;
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))return reply(res,403,{error:'Host không hợp lệ'});
  const url=new URL(req.url,'http://'+host);
  if(req.method==='POST' && req.headers.origin!=='http://'+host)return reply(res,403,{error:'Origin không hợp lệ'});
  try{
    if(req.method==='GET'&&url.pathname==='/api/auth/session')return reply(res,200,{authenticated:auth.authenticated(req)});
    if(req.method==='POST'&&url.pathname==='/api/auth/login'){const b=await body(req),result=await auth.login(req,b.username,b.password);if(result.cookie)res.setHeader('Set-Cookie',result.cookie);return reply(res,result.status,result.error?{error:result.error}:{ok:true});}
    if(req.method==='POST'&&url.pathname==='/api/auth/logout'){res.setHeader('Set-Cookie',auth.logout(req));return reply(res,200,{ok:true});}
    const signedIn=auth.authenticated(req),publicAsset=['/login','/login.js','/style.css','/tn-logo.png'].includes(url.pathname);
    if(!signedIn&&!publicAsset){if(url.pathname.startsWith('/api/'))return reply(res,401,{error:'Vui lòng đăng nhập'});res.writeHead(302,{Location:'/login','Cache-Control':'no-store'});res.end();return;}
    if(signedIn&&req.method==='GET'&&url.pathname==='/login'){res.writeHead(302,{Location:'/','Cache-Control':'no-store'});res.end();return;}
    if(req.method==='GET' && url.pathname==='/api/state')return reply(res,200,{...usage,projects:store.projects,discoveredProjects:store.discoveredProjects||[],workspaceRoot:store.workspaceRoot||workRoot,brandRoot,brandStats,docs:[...indexed,...store.docs].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(({content,...meta})=>meta),lastSync,busy,syncError,cli:Object.keys(cli),jobs});
    if(req.method==='GET'&&url.pathname==='/api/docs/read'){const d=[...indexed,...store.docs].find(d=>d.id===url.searchParams.get('id'));return reply(res,d?200:404,d||{error:'Không tìm thấy tài liệu'});}
    if(req.method==='GET'&&url.pathname==='/api/docs/search'){const q=(url.searchParams.get('q')||'').slice(0,200).toLowerCase();return reply(res,200,{ids:[...indexed,...store.docs].filter(d=>(d.title+' '+d.project+' '+d.source+' '+d.content).toLowerCase().includes(q)).map(d=>d.id)});}
    if(req.method==='GET' && url.pathname==='/api/jobs')return reply(res,200,{jobs});
    if(req.method==='GET' && url.pathname==='/api/mcp')return reply(res,200,mcp.snapshot());
    if(req.method==='GET' && url.pathname==='/api/tasks'){const snapshot=await tasks.snapshot();return reply(res,200,{...snapshot,tasks:await Promise.all(snapshot.tasks.map(async t=>({...t,agentWork:await claudeDesktop.findAgentWorkSession(t.ticket)})))});}
    if(req.method==='GET'&&url.pathname==='/api/studio/sessions'){await studio.refresh();return reply(res,200,studio.page(Object.fromEntries(url.searchParams)));}
    if(req.method==='GET'&&url.pathname==='/api/studio/read')return reply(res,200,await studio.read(url.searchParams.get('id'),{cursor:url.searchParams.has('cursor')?url.searchParams.get('cursor'):undefined,limit:url.searchParams.get('limit')}));
    if(req.method==='GET'&&url.pathname==='/api/studio/trace'){const id=url.searchParams.get('id'),session=studio.snapshot().sessions.find(s=>s.id===id),provider=session?.provider==='codex'?'codex':'claude';return reply(res,200,{...await studio.trace(id),budgets:await budgets.snapshot({[provider]:session?.cliSessionId||session?.nativeId})});}
    if(req.method==='GET'&&url.pathname==='/api/tasks/trace'){const snapshot=await tasks.snapshot(),t=snapshot.tasks.find(t=>t.id===url.searchParams.get('id'));if(!t)throw Error('Task không thuộc danh sách assign của bạn');const head=t.claudeCliSessionId?await studio.traceThread(t.claudeCliSessionId,'claude-code'):t.threadId?await studio.traceThread(t.threadId):null,ui=t.codexThreadId?await studio.traceThread(t.codexThreadId):null;let live=ui&&Date.parse(ui.lastActivity)>Date.parse(head?.lastActivity||0)?{...ui,completed:[...new Set([...(head?.completed||[]),...(ui.completed||[])])]}:head;const session=await claudeDesktop.findAgentWorkSession(t.ticket);let agentWork=null;if(session){const log=await studio.traceThread(session.cliSessionId,'claude-code'),health=claudeSessionHealth(log,session);agentWork={session,health,repo:log.repo,file:log.file,lastTool:log.lastTool,summary:log.summary};if(!live){live={...log,actor:log.actor||'Claude',stageTitle:log.stage?log.stageTitle:'Phiên Claude Desktop · AgentWork'};if(health.state==='stale'&&live.status==='running')live={...live,status:'blocked',summary:health.label};}}const observedTask=!head&&session?{...t,claudeSessionId:session.nativeId}:t;return reply(res,200,{...taskTrace(observedTask,live,snapshot.statesByProject),agentWork,budgets:await budgets.snapshot({claude:t.claudeCliSessionId||session?.cliSessionId,codex:t.codexThreadId||t.threadId})});}
    if(req.method==='POST') {
      const b=await body(req,url.pathname==='/api/studio/import'?20_000_000:600000);
      if(url.pathname==='/api/studio/refresh'){await studio.refresh(true);return reply(res,200,studio.page(b));}
      if(url.pathname==='/api/budgets/capture')return reply(res,200,await budgets.capture(b));
      if(url.pathname==='/api/studio/import')return reply(res,200,await studio.importChats(b.conversations));
      if(url.pathname==='/api/studio/open')return reply(res,200,await studio.openSession(b.id));
      if(url.pathname==='/api/studio/send'){let cwd;if(!b.sessionId){const p=[...store.projects,...(store.discoveredProjects||[])].find(p=>p.id===b.projectId&&p.kind!=='library');if(b.projectId&&!p)throw Error('Dự án không hợp lệ');cwd=await realpath(p?.root||store.workspaceRoot||'G:/Work');}return reply(res,200,await studio.send({...b,cwd}));}
      if(url.pathname==='/api/projects/scan'){const root=await realpath(b.root||store.workspaceRoot||'G:/Work');if(root===path.parse(root).root||root===os.homedir())throw Error('Chọn thư mục workspace cụ thể');store.discoveredProjects=await discoverProjects(root);store.workspaceRoot=root;await save();return reply(res,200,{count:store.discoveredProjects.length,root});}
      if(url.pathname==='/api/tasks/refresh')return reply(res,200,await tasks.refresh());
      if(url.pathname==='/api/tasks/phase')return reply(res,200,await tasks.phase(b.taskId,b.phase));
      if(url.pathname==='/api/tasks/seen'){if(!Array.isArray(b.ids)||!b.ids.every(id=>typeof id==='string'))throw Error('Danh sách task không hợp lệ');return reply(res,200,await tasks.seen(b.ids));}
      if(url.pathname==='/api/tasks/plane-state')return reply(res,200,await tasks.changePlaneState(b.taskId,b.stateId));
      if(url.pathname==='/api/claude/open'){await claudeDesktop.openNew();return reply(res,200,{ok:true});}
      if(url.pathname==='/api/tasks/retry')return reply(res,202,await tasks.retry(b.taskId,b.confirmedRetry));
      if(url.pathname==='/api/tasks/code')return reply(res,202,await tasks.startCode(b.taskId));
      if(url.pathname==='/api/tasks/open')return reply(res,200,await tasks.openDesktop(b.taskId));
      if(url.pathname==='/api/mcp/refresh')return reply(res,200,await mcp.refresh(store.projects));
      if(url.pathname==='/api/mcp/check')return reply(res,200,await mcp.check(b.id,b.projectId));
      if(url.pathname==='/api/mcp/claude')return reply(res,200,await mcp.scanClaude(b.projectId));
      if(url.pathname==='/api/run') {
        let p=[...store.projects,...(store.discoveredProjects||[])].find(p=>p.id===b.projectId);
        if(!b.projectId){const root=await realpath(store.workspaceRoot||'G:/Work');p={id:'auto',name:'Tự xác định repo trong '+root,root};}
        if(!p||p.kind==='library')throw Error('Dự án code không hợp lệ');
        if(!cli[b.provider]||!['read','code'].includes(b.mode)||typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>20000)throw Error('Nhà cung cấp, chế độ hoặc yêu cầu không hợp lệ');
        if(running.size)throw Error('Đợi tác vụ hiện tại hoàn thành hoặc bấm Dừng');
        if(!p.documentationRoot){const library=store.projects.find(x=>x.kind==='library'&&path.basename(x.root)==='AI-Hub');if(library){p={...p,documentationRoot:path.join(library.root,'docs','projects',p.id==='auto'?'workspace':path.basename(p.root),'features')};await mkdir(p.documentationRoot,{recursive:true});}}
        const job={id:randomUUID(),provider:b.provider,project:p.name,projectId:p.id,mode:b.mode,status:'running',startedAt:new Date().toISOString(),output:'',diagnostics:''};jobs.unshift(job);if(jobs.length>30)jobs.pop();
        const prompt=p.id==='auto'?`Làm việc trong workspace ${p.root}. Trước khi sửa code, xác định đúng repo từ yêu cầu và đọc instruction local/shared của repo đó. Nếu chưa đủ thông tin xác định repo, hỏi lại thay vì sửa đoán. Không sửa nhiều repo ngoài phạm vi yêu cầu.\n\n${b.prompt}`:b.prompt;
        const control=startJob({job,bin:cli[b.provider],root:p.root,documentationRoot:p.documentationRoot,prompt,onDone:async j=>{running.delete(j.id);mutation=mutation.then(async()=>{store.docs.unshift({id:randomUUID(),title:`${j.provider} · ${j.project} · ${j.status}`,content:'# Kết quả tác vụ AI\n\n'+j.output,source:'AI CLI',project:p.name,projectId:p.id,kind:'Tự động',updatedAt:j.endedAt});await save();await sync();});}});running.set(job.id,control);
        return reply(res,202,{id:job.id});
      }
      if(url.pathname==='/api/stop'){const control=running.get(b.id);if(!control)throw Error('Tác vụ không còn chạy');control.stop();return reply(res,200,{ok:true});}
      if(url.pathname==='/api/sync'){await sync();return reply(res,200,{ok:true});}
      if(url.pathname==='/api/projects') {
        if(typeof b.root!=='string'||!path.isAbsolute(b.root))throw Error('Nhập đường dẫn thư mục tuyệt đối');
        const root=await realpath(b.root);
        if(!(await stat(root)).isDirectory() || root===path.parse(root).root || root===os.homedir())throw Error('Chọn thư mục dự án cụ thể');
        if(store.projects.some(p=>p.root.toLowerCase()===root.toLowerCase()))throw Error('Dự án đã được kết nối');
        const p={id:randomUUID(),name:path.basename(root),root,kind:b.kind==='library'?'library':'code'};
        if(b.documentationRoot){if(typeof b.documentationRoot!=='string'||!path.isAbsolute(b.documentationRoot))throw Error('Thư mục tài liệu phải là đường dẫn tuyệt đối');const docRoot=await realpath(b.documentationRoot);if(!(await stat(docRoot)).isDirectory()||docRoot===path.parse(docRoot).root||docRoot===os.homedir())throw Error('Chọn thư mục tài liệu cụ thể');p.documentationRoot=docRoot;}
        if(b.installRules===true&&p.kind==='code')await installLocalInstructions(root,p.documentationRoot);
        store.projects.push(p);await save();await sync();return reply(res,201,{ok:true});
      }
      if(url.pathname==='/api/docs') {
        if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200||typeof b.content!=='string'||b.content.length>500000)throw Error('Tiêu đề hoặc nội dung không hợp lệ');
        const old=b.id?store.docs.find(d=>d.id===b.id&&d.kind==='Thủ công'):null;
        if(b.id&&!old)throw Error('Chỉ sửa tài liệu thủ công tại đây; sửa tài liệu đồng bộ ở repo');
        const doc={id:old?.id || randomUUID(),title:b.title.trim(),content:b.content,project:'Thư viện cá nhân',source:'Workspace',kind:'Thủ công',updatedAt:new Date().toISOString()};
        if(old)Object.assign(old,doc);else store.docs.unshift(doc);await save();return reply(res,201,{ok:true});
      }
      return reply(res,404,{error:'Không tìm thấy'});
    }
    const assets={'/':'index.html','/login':'login.html','/login.js':'login.js','/app.js':'app.js','/trace-chart.js':'trace-chart.js','/trace-view.js':'trace-view.js','/studio.js':'studio.js','/task-view.js':'task-view.js','/workflow.js':'workflow.js','/style.css':'style.css','/tn-logo.png':'tn-logo.png'};
    if(req.method==='GET' && assets[url.pathname]) {const file=assets[url.pathname];return reply(res,200,await readFile(path.join(base,'public',file)),file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');}
    reply(res,404,{error:'Không tìm thấy'});
  }catch(e){reply(res,400,{error:e.message});}
}
const server=http.createServer((req,res)=>{if(req.method==='POST'){mutation=mutation.then(()=>handle(req,res)).catch(()=>{});}else handle(req,res).catch(()=>{if(!res.headersSent)reply(res,500,{error:'Lỗi máy chủ'});});});
server.listen(port,'127.0.0.1',()=>console.log(`AI Workspace: http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
await sync();
await mcp.refresh(store.projects);
const timer=setInterval(()=>{mutation=mutation.then(()=>sync());},30000);timer.unref();
const desktopTimer=setInterval(()=>{tasks.pollDesktop().catch(()=>{});studio.pollDesktop().catch(()=>{});},30000);desktopTimer.unref();
