import {open,stat} from 'node:fs/promises';
import {canRetryTask} from './public/task-view.js';
import {WORKFLOW_STEPS} from './public/workflow.js';
export const clean=s=>String(s||'').replace(/(Bearer\s+)\S+/gi,'$1[redacted]').replace(/((?:token|password|api[_-]?key|secret)\s*[:=]\s*)\S+/gi,'$1[redacted]').slice(0,300);
const absolute=p=>typeof p==='string'&&(/^[a-z]:[\\/]/i.test(p)||p.startsWith('/'));
export function launchEvent(task,label,status='running',detail=''){
 const events=task.launchEvents||=[];const last=events.at(-1);if(last?.status==='running'){last.status=status==='failed'?'failed':'done';last.endedAt=new Date().toISOString();if(status==='failed'){last.detail=clean(detail);return;}}
 events.push({at:new Date().toISOString(),label:clean(label),status,...(detail?{detail:clean(detail)}:{})});if(events.length>30)events.splice(0,events.length-30);
}
export function taskTrace(task,engine=null,statesByProject={}){
 const events=task.launchEvents?.length?task.launchEvents.map(e=>({at:e.at,endedAt:e.endedAt,label:clean(e.label),status:e.status,detail:clean(e.detail)})):[];
 if(!events.length){if(task.acceptedAt)events.push({at:task.acceptedAt,label:'Đã nhận AB Task',status:'done'});if(task.codeError)events.push({at:null,label:'Chưa xác nhận mở chat Desktop',status:'failed',detail:clean(task.codeError)});}
 const hasEngine=Boolean(engine?.logUpdatedAt||engine?.stage||engine?.repo||engine?.lastActivity);
 return {...(engine||{}),hasEngine,task:{canRetry:canRetryTask(task,statesByProject),id:task.id,ticket:task.ticket,planeState:task.planeItem?.stateName,phase:task.phase,acceptedAt:task.acceptedAt,awaitingDesktop:!!task.awaitingDesktop,desktopProvider:task.desktopProvider||'codex',threadId:task.claudeSessionId||task.threadId||null,clientThreadId:task.clientThreadId||null,workspace:task.launchWorkspace||null,claudeFallback:task.claudeFallback?.reason||null,dispatchDirectory:task.dispatchDirectory||null},events,
 ...(task.codexError?{stage:'ui',actor:'Codex',stageTitle:'Bàn giao Codex UI bị chặn',status:'blocked',summary:clean(task.codexError)}:{}),...(!hasEngine?{stage:null,actor:'TN Workspace',stageTitle:task.awaitingDesktop?'Chờ gửi yêu cầu trong Claude Code Desktop':task.launching?task.launchStage||'Chuẩn bị phiên':task.codeError?'Dừng ở bước mở Desktop':'Chưa có log phiên AI',status:task.awaitingDesktop?'waiting':task.launching?'running':task.codeError?'blocked':'observed',summary:task.awaitingDesktop?'Claude Desktop đã mở bản nháp. Xác nhận thư mục và nhấn Gửi trong ứng dụng; website chỉ đánh dấu Coding khi thấy phiên thật.':task.codeError?clean(task.codeError):(task.threadId||task.claudeSessionId)?'Đã có ID phiên, nhưng chưa đọc được log local.':task.clientThreadId?'Desktop chưa trả ID phiên chính thức.':'Chưa có phiên AI được liên kết để đọc log coding.',source:'launch-status'}:{})};
}
export function parseTraceLog(text,provider='codex'){
 let report=null,skipped=new Set(),lastActivity=null,lastTool=null,lastMessage='',cwd='',branch='',turnState='unknown',turnActivityAt=null,contextBudget=null;const files=[];
 for(const line of text.split('\n')){try{const e=JSON.parse(line),p=provider==='codex'?e.payload:e.message;if(e.timestamp)lastActivity=e.timestamp;
  if(e.type==='session_meta'||e.type==='turn_context'){if(absolute(p?.cwd))cwd=p.cwd;if(p?.git?.branch)branch=clean(p.git.branch);}
  if(provider!=='codex'&&absolute(e.cwd))cwd=e.cwd;
  const content=p?.content;
  if(provider==='codex'&&e.type==='event_msg'&&p?.type==='token_count'){const info=p.info,window=info?.model_context_window,used=info?.last_token_usage?.total_tokens;if(Number.isFinite(window)&&window>0&&Number.isFinite(used)&&used>=0)contextBudget={remaining:Math.max(0,100-used/window*100),at:Date.parse(e.timestamp)};}
  if(provider!=='codex'){const chunks=Array.isArray(content)?content:[],text=typeof content==='string'?content:chunks.filter(c=>c.type==='text').map(c=>c.text||'').join('');let next;if(e.type==='api-request'||e.type==='user'&&(text||chunks.some(c=>c.type==='tool_result'))||e.type==='assistant'&&chunks.some(c=>c.type==='tool_use'))next='pending';if(e.type==='assistant'&&text&&p.stop_reason==='end_turn')next='responded';if(e.type==='assistant'&&p.stop_reason==='max_tokens')next='interrupted';if(next){turnState=next;turnActivityAt=e.timestamp||turnActivityAt;}}
  if((provider==='codex'&&e.type==='response_item'&&p?.type==='message'&&p.role==='assistant'&&p.channel!=='analysis')||(provider!=='codex'&&e.type==='assistant')){
   const body=Array.isArray(content)?content.filter(c=>['text','output_text'].includes(c.type)).map(c=>c.text||'').join('\n'):'';if(body)lastMessage=clean(body.replace(/TN_TRACE:\s*\{[^\n]*\}/g,''));
   for(const match of body.matchAll(/(?:^|\n)TN_TRACE:\s*(\{[^\n]*\})/g)){try{const value=JSON.parse(match[1]);if(WORKFLOW_STEPS.some(s=>s.id===value.stage)){report=value;if(value.status==='skipped')skipped.add(value.stage);else skipped.delete(value.stage);}}catch{}}
  }
  const calls=provider==='codex'&&e.type==='response_item'&&['function_call','custom_tool_call'].includes(p?.type)?[p]:provider!=='codex'&&Array.isArray(content)?content.filter(c=>c.type==='tool_use'):[];
  for(const call of calls){lastTool=String(call.name||'').replace(/[^a-z0-9_.:-]/gi,'').slice(0,100);let args=call.input||{};try{if(call.arguments)args=JSON.parse(call.arguments);}catch{args={input:call.arguments};}if(typeof args==='string')args={input:args};if(absolute(args.workdir||args.cwd))cwd=args.workdir||args.cwd;const code=String(args.code||args.input||'').replaceAll('\\n','\n'),match=code.match(/workdir\s*:\s*["']([^"'\n]+)/);if(match){const candidate=match[1].replaceAll('\\\\','\\');if(absolute(candidate))cwd=candidate;}
   for(const m of code.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm))files.push(m[1].trim().slice(0,500));if(absolute(args.file_path||args.path))files.push(args.file_path||args.path);
  }
 }catch{}}
 const stage=WORKFLOW_STEPS.find(s=>s.id===report?.stage),status=['running','blocked','review','done','skipped'].includes(report?.status)?report.status:'observed';
 return {stage:stage?.id||null,stageTitle:stage?.title||'Chưa xác định bước',actor:stage?.owner||(provider==='codex'?'Codex':'Claude'),status,repo:absolute(report?.repo)?report.repo:cwd,branch:clean(report?.branch||branch),file:clean(report?.file||files.at(-1)),files:[...new Set(files)].slice(-10),summary:clean(report?.summary||lastMessage),completed:Array.isArray(report?.completed)?report.completed.filter(id=>WORKFLOW_STEPS.some(s=>s.id===id)):[],skipped:[...skipped],lastActivity,lastTool,contextBudget,...(provider!=='codex'?{turnState,turnActivityAt}:{}),source:report?'agent-report':'session-log'};
}
export async function readTraceLog(file,provider){const info=await stat(file),h=await open(file,'r');try{const start=Math.max(0,info.size-524288),b=Buffer.alloc(info.size-start);await h.read(b,0,b.length,start);let head='';if(start){const first=Buffer.alloc(Math.min(start,65536));await h.read(first,0,first.length,0);const end=first.indexOf(10);if(end>=0)head=first.subarray(0,end+1).toString('utf8');}const trim=start?b.indexOf(10)+1:0;return {...parseTraceLog(head+b.subarray(trim).toString('utf8'),provider),logUpdatedAt:info.mtime.toISOString()};}finally{await h.close();}}

export function claudeSessionHealth(trace,session={},now=Date.now()){
 const at=trace?.turnActivityAt||trace?.lastActivity||null,age=at?Math.max(0,(now-Date.parse(at))/1000):null;let state,label;
 if(session.archived){state='archived';label='Đã lưu trữ';}
 else if(session.awaitingPerson){state='needs_attention';label='Chờ người dùng / cấp quyền';}
 else if(!at){state='no_log';label='Đã có phiên · chưa đọc được log';}
 else if(trace.turnState==='responded'){state='idle';label='Đã phản hồi · chờ lượt tiếp';}
 else if(trace.turnState==='interrupted'){state='needs_attention';label='Phản hồi bị ngắt · cần kiểm tra';}
 else if(age>300&&trace.turnState==='pending'){state='stale';label='Lâu chưa có tiến triển · cần kiểm tra';}
 else if(trace.turnState==='pending'){state=age<=90?'active':'waiting';label=age<=90?'Có hoạt động gần đây':'Đang chờ AI / công cụ';}
 else{state='unknown';label='Có log · chưa xác định hoạt động';}
 return {state,label,lastActivity:at,quietSeconds:Number.isFinite(age)?Math.floor(age):null};
}
