import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createTaskMonitor} from './tasks.mjs';
import {discoverCLIs} from './runner.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const monitor=await createTaskMonitor({cli:await discoverCLIs(),base,data:path.join(base,'data')});
const known=new Set((await monitor.snapshot()).tasks.map(t=>t.id));
const state=await monitor.refresh();
console.log(JSON.stringify({syncedAt:state.syncedAt,nextScanAt:state.nextScanAt,total:state.tasks.filter(t=>t.available).length,newTasks:state.tasks.filter(t=>t.available&&!known.has(t.id)).map(t=>({id:t.id,ticket:t.ticket,title:t.title})),warning:state.error}));
