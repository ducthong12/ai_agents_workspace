import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function discoverCLIs(){
  const found={};
  for(const [provider,name] of [['Claude','claude'],['Codex','codex']]){
    const configured=process.env[provider==='Codex'?'TN_CODEX_BIN':'TN_CLAUDE_BIN'];if(configured){found[provider]=configured;continue;}
    try{const {stdout}=await exec(process.platform==='win32'?'where.exe':'which',[name],{windowsHide:true,timeout:5000});const bin=stdout.trim().split(/\r?\n/).find(x=>process.platform!=='win32'||x.endsWith('.exe'));if(bin)found[provider]=bin;}catch{}
  }
  return found;
}
export function commandArgs(provider,mode,documentationRoot){
  const extra=mode==='code'&&documentationRoot?['--add-dir',documentationRoot]:[];
  if(provider==='Codex')return ['exec','--json','--color','never','--skip-git-repo-check','--sandbox',mode==='code'?'workspace-write':'read-only',...extra,'-'];
  return ['--print','--output-format','stream-json','--verbose','--permission-mode',mode==='code'?'acceptEdits':'plan',...(mode==='code'?[]:['--tools','Read,Glob,Grep']),...extra];
}
export function extractText(provider,e){
  if(provider==='Codex'){
    if(e.type==='item.completed' && e.item?.type==='agent_message')return e.item.text || '';
    if(e.type==='error')return 'Lỗi: '+(e.message || JSON.stringify(e));
    if(e.type==='turn.failed')return 'Lỗi: '+(e.error?.message || 'Turn thất bại');
  }else{
    if(e.type==='assistant')return (e.message?.content || []).filter(c=>c.type==='text').map(c=>c.text).join('\n');
    if(e.type==='result' && e.is_error)return 'Lỗi: '+(e.errors?.join('\n') || e.result || e.subtype);
  }
  return '';
}
export function startJob({job,bin,root,documentationRoot,prompt,onDone}){
  const suffix=job.mode==='code'?`\nRead and follow the selected repo's shared and local instructions, including AGENTS.override.md and CLAUDE.local.md when present. After code changes, ${documentationRoot?'write feature documentation under '+documentationRoot+'.':'follow the documentation location in those instructions (fallback docs/ai/).'} Include behavior, changed files, tests and limitations. Do not include credentials or raw transcripts.`:'\nOnly inspect and answer. Do not edit files.';
  const child=spawn(bin,commandArgs(job.provider,job.mode,documentationRoot),{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
  let buffer='',finished=false;
  const append=t=>{if(t)job.output=(job.output+t+'\n').slice(-200000);};
  function line(s){try{const e=JSON.parse(s);append(extractText(job.provider,e));if(e.type==='result'&&e.is_error||e.type==='turn.failed'||e.type==='error')job.aiError=true;if(e.type==='result'&&e.permission_denials?.length)append('Có thao tác bị chặn quyền. Mở CLI để xử lý quyền nếu cần.');}catch{append(s);}}
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n'))>=0){line(buffer.slice(0,at));buffer=buffer.slice(at+1);}if(buffer.length>1000000){append('Một sự kiện vượt giới hạn hiển thị.');buffer='';}});
  child.stderr.on('data',chunk=>{job.diagnostics=(job.diagnostics+chunk).slice(-20000);});
  child.stdin.on('error',()=>{});child.stdin.end(prompt+suffix);
  async function finish(code,error){if(finished)return;finished=true;clearTimeout(timer);if(buffer)line(buffer);job.status=job.status==='stopping'?'cancelled':code===0&&!job.aiError&&!error?'done':'failed';job.endedAt=new Date().toISOString();if(error)append(error.message);if(!job.output)append(job.status==='done'?'AI đã hoàn thành, không có văn bản trả về.':'Không có kết quả. Xem thông tin CLI.');await onDone(job);}
  child.on('error',e=>{void finish(null,e);});child.on('close',code=>{void finish(code);});
  const stop=()=>{job.status='stopping';if(process.platform==='win32'&&child.pid)execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill('SIGTERM');};
  const timer=setTimeout(()=>{append('Dừng vì vượt 15 phút.');stop();},15*60*1000);timer.unref();
  return {stop};
}
