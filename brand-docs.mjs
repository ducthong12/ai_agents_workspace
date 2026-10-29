import {mkdir,readFile,writeFile,realpath,stat,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {filesUnder} from './usage.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function brandFromProject(name){
 const tokens=String(name).toLowerCase().split(/[-_ ]+/);
 for(const [key,label] of [['castrol','Castrol'],['nestle','Nestlé'],['nestleevent','Nestlé'],['gsk','GSK'],['aptamil','Aptamil'],['nan','NAN'],['nin','NIN'],['ensureqip','Ensure'],['prosureqip','Prosure'],['enfa','Enfa'],['glico','Glico'],['icreo','Icreo'],['kinhdo','Kinh Đô'],['amazon','Amazon'],['amazoncrm','Amazon'],['gdnl','GDNL'],['333','333']])if(tokens.includes(key))return label;
 return null;
}
export async function syncBrandDocs({projects,workRoot,docRoot}){
 await mkdir(docRoot,{recursive:true});const root=await realpath(workRoot),manifestFile=path.join(docRoot,'.tn-brand-index.json');let previous={};try{previous=JSON.parse(await readFile(manifestFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const destinationRoot=await realpath(docRoot);const entries={},docs=[],stats={projects:0,copied:0,conflicts:0,errors:0},seen=new Set();
 const names=new Map();for(const p of projects)names.set(p.name,(names.get(p.name)||0)+1);
 for(const p of projects){const brand=brandFromProject(p.name);if(!brand)continue;let source;try{source=await realpath(p.root);const rel=path.relative(root,source);if(rel.startsWith('..')||path.isAbsolute(rel)||seen.has(source.toLowerCase()))continue;seen.add(source.toLowerCase());}catch{stats.errors++;continue;}
  const projectFolder=path.basename(source)+(names.get(p.name)>1?'--'+hash(source.toLowerCase()).slice(0,6):'');stats.projects++;
  const files=[];for(const folder of ['docs','.claude','.planning','.stitch'])files.push(...await filesUnder(path.join(source,folder),'.md',15));for(const name of ['README.md','AGENTS.md','CLAUDE.md']){const f=path.join(source,name);try{if((await stat(f)).isFile())files.push(f);}catch{}}
  for(const f of files){try{if(path.basename(f).startsWith('.env'))continue;const actual=await realpath(f),inside=path.relative(source,actual);if(inside.startsWith('..')||path.isAbsolute(inside)||path.basename(actual).startsWith('.env'))continue;const info=await stat(actual);if(info.size>512000)continue;const content=await readFile(actual,'utf8'),digest=hash(content),relative=path.join(brand,projectFolder,inside),destination=path.join(docRoot,relative),key=hash(actual.toLowerCase());await mkdir(path.dirname(destination),{recursive:true});const parent=await realpath(path.dirname(destination)),targetRel=path.relative(destinationRoot,parent);if(targetRel.startsWith('..')||path.isAbsolute(targetRel))continue;try{if((await lstat(destination)).isSymbolicLink())continue;}catch(e){if(e.code!=='ENOENT')throw e;}let existing=null;try{existing=await readFile(destination,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(existing!==null&&hash(existing)!==digest&&hash(existing)!==previous[key]?.digest){stats.conflicts++;entries[key]=previous[key]||{digest:null,relative};continue;}
    if(existing===null||hash(existing)!==digest){await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,content,'utf8');stats.copied++;}entries[key]={digest,relative};docs.push({id:hash(destination.toLowerCase()),project:p.name,projectId:p.id,brand,folder:path.dirname(relative),title:content.match(/^#\s+(.+)$/m)?.[1]||path.basename(f),content,source:relative,kind:'Nhãn hàng',updatedAt:info.mtime.toISOString()});
   }catch{stats.errors++;}}
 }
 // Retain source records so a missing repo never causes a copied document to be deleted.
 await writeFile(manifestFile,JSON.stringify({...previous,...entries},null,2));
 // Include user-edited copies and documents added directly to brand folders.
 const indexed=new Set(docs.map(d=>d.id));for(const file of await filesUnder(docRoot,'.md',18)){const relative=path.relative(docRoot,file),parts=relative.split(path.sep);if(parts.length<3||parts[0]!=='Chung'&&!projects.some(p=>brandFromProject(p.name)===parts[0]))continue;const id=hash(file.toLowerCase());if(indexed.has(id))continue;try{const info=await stat(file);if(info.size>512000)continue;const content=await readFile(file,'utf8');docs.push({id,brand:parts[0],project:parts[1],projectId:'brand-local',folder:path.dirname(relative),title:content.match(/^#\s+(.+)$/m)?.[1]||path.basename(file),content,source:relative,kind:'Nhãn hàng',updatedAt:info.mtime.toISOString()});}catch{stats.errors++;}}
 return {docs,stats};
}
