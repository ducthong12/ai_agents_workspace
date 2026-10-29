import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const exec=promisify(execFile);
export async function installLocalInstructions(root,documentationRoot){
  root=await realpath(root);
  let hasAgents=false;try{await readFile(path.join(root,'AGENTS.md'));hasAgents=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  const block=`<!-- tn-local-docs:start -->\n## Personal documentation location\nAfter changing code, update Markdown documentation under ${documentationRoot||'the location required by the project (otherwise docs/ai/)'}. Include the request, behavior, changed files, rationale, tests actually run and limitations. Keep stable feature names. Do not include credentials or raw transcripts. Do not change tracked AGENTS.md or CLAUDE.md for personal settings. This local location overrides older AI-note output paths only; preserve project code, security and test rules.\n<!-- tn-local-docs:end -->`;
  const roles=`<!-- tn-abtask-roles:start -->\n## AB Task roles\nFor AB Task only: Claude creates the detailed plan, implements backend, and performs data QC/import on local or staging using the configured MQLens local and Playwright LLM against cshub-stg. Codex implements/fixes UI from Figma data and verifies UI through Playwright LLM. Handoff order: Claude plan -> Claude backend -> Codex UI -> Claude data QC/import -> Codex UI integration checks -> human review. Skip unrelated stages explicitly. Confirm actual environment/database before writes; never guess the staging URL, use production, bypass tool permissions or write data beyond ticket scope. Missing tools block the affected step. Record plan, handoff, tests and evidence under the feature documentation directory. Do not automatically submit/done, merge or deploy.\n<!-- tn-abtask-roles:end -->`;
  for(const file of ['AGENTS.override.md','CLAUDE.local.md']){
    const target=path.join(root,file);let old='';try{const resolved=await realpath(target);if(path.dirname(resolved)!==root)throw Error('Không sửa instruction qua symlink');old=await readFile(target,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    const previous=old;
    if(!old)old=file==='AGENTS.override.md'?'# Local Codex instructions\n\nBefore working, read AGENTS.md and CLAUDE.md if present and follow the shared project rules. This local file changes personal documentation settings only.\n':`# Local Claude instructions\n\n${hasAgents?'@AGENTS.md\n':''}`;
    if(file==='CLAUDE.local.md'&&hasAgents&&!/^@(?:\.\/)?AGENTS\.md\s*$/m.test(old))old=old.trimEnd()+'\n\n@AGENTS.md\n';
    let next=old.includes('<!-- tn-local-docs:start -->')?old.replace(/<!-- tn-local-docs:start -->[\s\S]*?<!-- tn-local-docs:end -->/,block):old.trimEnd()+'\n\n'+block+'\n';
    next=next.includes('<!-- tn-abtask-roles:start -->')?next.replace(/<!-- tn-abtask-roles:start -->[\s\S]*?<!-- tn-abtask-roles:end -->/,roles):next.trimEnd()+'\n\n'+roles+'\n';
    if(next!==previous)await writeFile(target,next);
  }
  try{const {stdout}=await exec('git',['-C',root,'rev-parse','--git-path','info/exclude'],{windowsHide:true});const file=path.resolve(root,stdout.trim());let old='';try{old=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    const extra=['/AGENTS.override.md','/CLAUDE.local.md'].filter(s=>!old.split(/\r?\n/).includes(s));if(extra.length){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,old.trimEnd()+'\n\n# Personal AI instructions\n'+extra.join('\n')+'\n');}
  }catch(e){if(!e.code||e.code===1)return {gitIgnored:false};throw e;}
  return {gitIgnored:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),hubArg=args[args.indexOf('--hub')+1],repos=args.flatMap((v,i)=>v==='--repo'?[args[i+1]]:[]);
  if(!args.includes('--hub')||!hubArg||!repos.length)throw Error('Usage: node setup-ai-local.mjs --hub <AI-Hub folder> --repo <repository> [--repo <repository>]');
  const hub=await realpath(hubArg);
  for(const repo of repos){const root=await realpath(repo),docs=path.join(hub,'docs','projects',path.basename(root),'features');await mkdir(docs,{recursive:true});const result=await installLocalInstructions(root,docs);console.log(JSON.stringify({repo:root,documentationRoot:docs,...result}));}
}
