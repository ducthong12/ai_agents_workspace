export const isInDevName=name=>/^(in\s*dev(?:elopment)?|đang\s+phát\s+triển)$/iu.test(String(name||'').trim());
const priority=t=>isInDevName(t.planeItem?.stateName)?0:t.planeItem?.stateName?1:2;
const seenAt=t=>Date.parse(t.firstSeenAt)||0;
export const sortTaskRows=rows=>[...rows].sort((a,b)=>Number(Boolean(b.isNew))-Number(Boolean(a.isNew))||(a.isNew&&b.isNew?seenAt(b)-seenAt(a)||priority(a)-priority(b):priority(a)-priority(b)||seenAt(b)-seenAt(a)));
export const sortPlaneStates=states=>[...states].sort((a,b)=>Number(isInDevName(b.name))-Number(isInDevName(a.name)));
export const CODE_PHASE_NAMES={todo:'Chưa code',coding:'Coding',review:'Review',done:'Done'};
export const CODE_PHASE_COLORS={todo:'#94a3b8',coding:'#60a5fa',review:'#fbbf24',done:'#4ade80'};
export function canCodeTask(task,statesByProject={}){const state=statesByProject[task.projectCode]?.states?.find(s=>s.id===task.planeItem?.stateId);return Boolean(state&&!isInDevName(state.name)&&['backlog','unstarted'].includes(state.group));}
export function canRetryTask(task,statesByProject={}){return Boolean(task.available!==false&&task.assignedToMe&&task.codeError&&!task.launching&&!task.threadId&&!task.clientThreadId&&(!task.phase||task.phase==='todo')&&(canCodeTask(task,statesByProject)||(task.acceptedAt&&isInDevName(task.planeItem?.stateName))));}
export function planeColor(state){const color=String(state?.color||'');if(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))return color.slice(0,7);if(/^#[0-9a-f]{3}$/i.test(color))return '#'+[...color.slice(1)].map(c=>c+c).join('');return {started:'#60a5fa',completed:'#4ade80',cancelled:'#94a3b8',unstarted:'#a78bfa',backlog:'#94a3b8'}[state?.group]||'#94a3b8';}
export function taskBoardColumns(tasks,mode='phase',statesByProject={}){
 if(mode!=='plane'){const eligible=tasks.filter(t=>canCodeTask(t,statesByProject)),other=tasks.filter(t=>!canCodeTask(t,statesByProject));return [...Object.entries(CODE_PHASE_NAMES).map(([id,title])=>({id,title,color:CODE_PHASE_COLORS[id],tasks:sortTaskRows(eligible.filter(t=>t.phase===id))})),...(other.length?[{id:'plane-progress',title:'Theo dõi trên Plane',color:'#a78bfa',tasks:sortTaskRows(other)}]:[])];}
 const groups=new Map();for(const task of tasks){const state=statesByProject[task.projectCode]?.states.find(s=>s.id===task.planeItem?.stateId),id=task.planeItem?task.projectCode+':'+task.planeItem.stateId:'unknown';if(!groups.has(id))groups.set(id,{id,title:state?task.projectCode+' · '+state.name:'Chưa có State',stateName:state?.name,color:planeColor(state),tasks:[]});groups.get(id).tasks.push(task);}
 return [...groups.values()].sort((a,b)=>Number(b.tasks.some(t=>t.isNew))-Number(a.tasks.some(t=>t.isNew))||Number(isInDevName(b.stateName))-Number(isInDevName(a.stateName))||a.title.localeCompare(b.title)).map(g=>({...g,tasks:sortTaskRows(g.tasks)}));
}
