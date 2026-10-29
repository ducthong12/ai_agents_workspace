import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const percent=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
export function budgetDecision(rows,now=Date.now()){
 const reasons=[];
 for(const r of rows){if(!percent(r.remaining)||!Number.isFinite(r.at)||now-r.at>300000||r.at>now+1000)reasons.push(r.label+': thiếu số liệu mới (tối đa 5 phút)');else if(r.remaining<20)reasons.push(r.label+': còn '+Math.round(r.remaining*10)/10+'%, dưới 20%');}
 return {allowed:reasons.length===0,reasons,error:reasons.length?'Tạm dừng bàn giao. '+reasons.join('; '):null,threshold:20};
}
export function codexQuotaRemaining(data){const bucket=data.rateLimitsByLimitId?.codex||data.rateLimits;const windows=[bucket?.primary,bucket?.secondary].filter(w=>percent(w?.usedPercent));return data.ordinaryUsageAllowed===false||bucket?.spendControlReached?0:windows.length?Math.min(...windows.map(w=>100-w.usedPercent)):null;}
export async function createBudgetMonitor({data,readCodexLimits,readContext=async()=>null}){
 const folder=path.join(data,'budgets');await mkdir(folder,{recursive:true});let refreshing=null,cachedAt=0,cached=null;
 const validProvider=p=>['claude','codex'].includes(p);
 const validId=id=>typeof id==='string'&&/^[a-z0-9_-]{8,100}$/i.test(id);
 const file=(provider,id)=>path.join(folder,provider+'-'+(id||'quota')+'.json');
 async function load(provider,id){try{return JSON.parse(await readFile(file(provider,id),'utf8'));}catch{return null;}}
 async function put(provider,id,remaining,source){const value={remaining,at:Date.now(),source},target=file(provider,id),tmp=target+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value));await rename(tmp,target);return value;}
 async function capture({provider,sessionId,quotaRemaining,contextRemaining}){if(!validProvider(provider)||sessionId!=null&&!validId(sessionId)||quotaRemaining!=null&&!percent(quotaRemaining)||contextRemaining!=null&&(!validId(sessionId)||!percent(contextRemaining)))throw Error('Số liệu ngân sách không hợp lệ');if(quotaRemaining==null&&contextRemaining==null)throw Error('Cần ít nhất một số liệu');if(quotaRemaining!=null)await put(provider,null,quotaRemaining,'manual');if(contextRemaining!=null)await put(provider,sessionId,contextRemaining,'manual');return {ok:true};}
 async function quota(provider){if(provider==='codex'&&readCodexLimits){if(Date.now()-cachedAt>60000){refreshing??=(async()=>{try{const remaining=codexQuotaRemaining(await readCodexLimits());cached=remaining==null?null:await put('codex',null,remaining,'codex-desktop');}catch{cached=null;}cachedAt=Date.now();})();try{await refreshing;}finally{refreshing=null;}}if(cached)return cached;}return load(provider);}
 async function context(provider,id){if(!validId(id))return null;const actual=await readContext(provider,id).catch(()=>null);const manual=await load(provider,id);if(percent(actual?.remaining)&&Number.isFinite(actual?.at)&&(!manual||actual.at>=manual.at))return {...actual,source:'session-log'};return manual;}
 async function rows(provider,id,live=true){let q;if(live)q=await quota(provider);else{if(provider==='codex')quota(provider).catch(()=>{});q=provider==='codex'&&cached?cached:await load(provider);}const c=id?await context(provider,id):null;return [{label:provider+' · hạn mức gói',...q},...(id?[{label:provider+' · context phiên',...c}]:[])];}
 async function check({target,targetSession,source,sourceSession}){if(!validProvider(target))throw Error('AI không hợp lệ');const values=await rows(target,targetSession);if(sourceSession&&validProvider(source)){const c=await context(source,sourceSession);values.push({label:source+' · context nguồn',...c});}return {...budgetDecision(values),measurements:values};}
 async function snapshot(sessions={}){return {threshold:20,providers:await Promise.all(['claude','codex'].map(async provider=>{const measurements=await rows(provider,sessions[provider],false);return {provider,sessionId:sessions[provider]||null,measurements,...budgetDecision(measurements)};}))};}
 return {check,capture,snapshot};
}
