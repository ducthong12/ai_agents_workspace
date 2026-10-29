import {readdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export async function discoverProjects(root){
  root=await realpath(root);const projects=[];
  async function visit(dir,depth){
    if(depth>0){try{await lstat(path.join(dir,'.git'));projects.push({id:'scan-'+createHash('sha256').update(dir.toLowerCase()).digest('hex').slice(0,20),name:path.basename(dir),root:dir,kind:'code',discovered:true});return;}catch(e){if(e.code!=='ENOENT')throw e;}}
    if(depth>=2)return;
    for(const item of await readdir(dir,{withFileTypes:true})){if(!item.isDirectory()||item.isSymbolicLink()||item.name.startsWith('.')||['node_modules','docs','tests','dist','build'].includes(item.name))continue;await visit(path.join(dir,item.name),depth+1);}
  }
  await visit(root,0);return projects.sort((a,b)=>a.name.localeCompare(b.name));
}
