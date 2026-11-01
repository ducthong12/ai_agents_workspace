import {open,stat} from 'node:fs/promises';
import path from 'node:path';
import {filesUnder} from './usage.mjs';

// Only bounded metadata is read here. Conversation bodies are fetched on selection.
export function createLocalSessionCatalog(){
 const cache=new Map();
 return async roots=>{
  const sessions=new Map(),seen=new Set();
  for(const root of roots)for(const file of await filesUnder(root,'.jsonl',8)){
   if(path.basename(file).startsWith('agent-')||file.split(path.sep).includes('subagents'))continue;
   const nativeId=path.basename(file).match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/ig)?.at(-1);if(!nativeId)continue;
   seen.add(file);
   try{
    const info=await stat(file),old=cache.get(file);let session;
    if(old?.size===info.size&&old?.mtime===info.mtimeMs)session={...old.session};
    else{
     const provider=file.includes(`${path.sep}projects${path.sep}`)?'claude-code':'codex',handle=await open(file,'r');let text;
     try{const buffer=Buffer.alloc(Math.min(info.size,65536));const {bytesRead}=await handle.read(buffer,0,buffer.length,0);text=buffer.subarray(0,bytesRead).toString('utf8');}finally{await handle.close();}
     let cwd='',title='',model='';
     for(const line of text.split('\n')){try{const event=JSON.parse(line),payload=event.payload;
      if(event.type==='session_meta'&&typeof payload?.cwd==='string')cwd=payload.cwd;
      if(provider==='claude-code'&&typeof event.cwd==='string')cwd=event.cwd;
      if(event.type==='custom-title'&&typeof event.customTitle==='string')title=event.customTitle;
      if(!title&&typeof event.slug==='string')title=event.slug;
      if(event.type==='turn_context'&&typeof payload?.model==='string')model=payload.model;
      if(provider==='claude-code'&&event.type==='assistant'&&typeof event.message?.model==='string')model=event.message.model;
     }catch{}}
     const repo=cwd.split(/[\\/]/).filter(Boolean).at(-1);
     session={id:provider+':'+nativeId,nativeId,provider,title:(title||`${provider==='codex'?'Codex':'Claude'} · ${repo||'Session'} · ${nativeId.slice(0,8)}`).slice(0,300),cwd,model:model.slice(0,120),hostId:'local',status:'saved',updatedAt:info.mtimeMs,readOnly:true,origin:'local-log'};
     cache.set(file,{mtime:info.mtimeMs,size:info.size,session});
    }
    const previous=sessions.get(session.id);if(!previous||session.updatedAt>previous.updatedAt)sessions.set(session.id,session);
   }catch{/* A log may be moved or still being written. Retry on the next refresh. */}
  }
  for(const file of cache.keys())if(!seen.has(file))cache.delete(file);
  return [...sessions.values()];
 };
}
