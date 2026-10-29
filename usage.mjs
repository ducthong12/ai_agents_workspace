import {createReadStream} from 'node:fs';
import {readdir, stat} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import path from 'node:path';

export const day = t => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const n = v => Number.isFinite(v) && v > 0 ? v : 0;
export function parseEvents(events, provider, fallback) {
  let session=fallback, project='Chưa xác định', model='unknown', previous={input:0,cached:0,write:0,output:0,reasoning:0};
  const records=[], messages=new Map();
  for(const e of events) {
    if(e.type==='session_meta') {session=e.payload?.id || session;project=e.payload?.cwd || project;}
    if(e.cwd) project=e.cwd;
    if(e.type==='turn_context') model=e.payload?.model || model;
    if(provider==='Codex' && e.type==='event_msg' && e.payload?.type==='token_count') {
      const u=e.payload.info?.total_token_usage;
      if(!u) continue;
      const current={input:n(u.input_tokens),cached:n(u.cached_input_tokens),write:n(u.cache_write_input_tokens),output:n(u.output_tokens),reasoning:n(u.reasoning_output_tokens)};
      // shortcut: a decreasing counter starts a new segment; validate again if the log schema changes.
      const reset=current.input<previous.input || current.output<previous.output;
      const delta=Object.fromEntries(Object.keys(current).map(k=>[k,Math.max(0,current[k]-(reset?0:previous[k]))]));
      previous=current;
      if(delta.input+delta.output+delta.write) records.push({...delta,id:JSON.stringify(current),timestamp:e.timestamp,model});
    }
    if(provider==='Claude' && e.type==='assistant' && e.message?.usage && e.message.id) {
      const u=e.message.usage,key=e.message.id+':'+(e.requestId || '');
      const current={id:key,input:n(u.input_tokens),cached:n(u.cache_read_input_tokens),write:n(u.cache_creation_input_tokens),output:n(u.output_tokens),reasoning:0,timestamp:e.timestamp,model:e.message.model || 'unknown'};
      const old=messages.get(key);
      if(old) for(const k of ['input','cached','write','output']) current[k]=Math.max(current[k],old[k]);
      messages.set(key,current);
    }
  }
  if(provider==='Claude') records.push(...messages.values());
  return records.filter(r=>r.timestamp && !Number.isNaN(Date.parse(r.timestamp))).map(r=>({...r,session,project,provider,date:day(r.timestamp),total:r.input+r.output+r.write+(provider==='Claude'?r.cached:0)}));
}
export async function filesUnder(root, extension='.jsonl', depth=20) {
  const files=[];
  async function visit(dir,d) {
    if(d<0)return;
    let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
    for(const e of entries) {
      if(e.isSymbolicLink())continue;
      const p=path.join(dir,e.name);
      if(e.isDirectory() && !['node_modules','.git','.venv','dist','data'].includes(e.name))await visit(p,d-1);
      else if(e.isFile() && e.name.endsWith(extension))files.push(p);
    }
  }
  await visit(root,depth);return files.sort();
}
export function createScanner() {
  const cache=new Map();
  return async roots=>{
    const all=[],warnings=[],sources=[],seen=new Set();
    for(const {provider,root} of roots) {
      let files=[];
      try{files=await filesUnder(root);}catch(e){warnings.push(`${provider}: ${e.message}`);}
      sources.push({provider,root,files:files.length});
      for(const file of files) {
        try{
          const s=await stat(file),key=provider+file,stamp=s.size+':'+s.mtimeMs;
          if(cache.get(key)?.stamp!==stamp) {
            const events=[];let malformed=0;
            const stream=createInterface({input:createReadStream(file),crlfDelay:Infinity});
            for await(const line of stream) {if(!line.trim())continue;try{const e=JSON.parse(line);if(['session_meta','turn_context'].includes(e.type)||e.payload?.type==='token_count'||(e.type==='assistant'&&e.message?.usage)||e.cwd)events.push({type:e.type,timestamp:e.timestamp,cwd:e.cwd,requestId:e.requestId,payload:['session_meta','turn_context'].includes(e.type)?{id:e.payload.id,cwd:e.payload.cwd,model:e.payload.model}:e.payload?.type==='token_count'?e.payload:undefined,message:e.message?.usage?{id:e.message.id,model:e.message.model,usage:e.message.usage}:undefined});}catch{malformed++;}}
            cache.set(key,{stamp,records:parseEvents(events,provider,file),malformed});
          }
          const c=cache.get(key);
          if(c.malformed)warnings.push(`${path.basename(file)}: bỏ qua ${c.malformed} dòng JSON chưa hoàn chỉnh/không hợp lệ`);
          for(const r of c.records) {const id=JSON.stringify([r.provider,r.session,r.id,r.timestamp,r.model,r.input,r.cached,r.write,r.output]);if(!seen.has(id)){seen.add(id);all.push(r);}}
        }catch(e){warnings.push(`${path.basename(file)}: ${e.message}`);}
      }
    }
    return {records:all,sources,warnings};
  };
}
