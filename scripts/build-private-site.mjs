import {execFileSync} from 'node:child_process';
import {mkdir,copyFile,rm,lstat,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist-private');
if(relative(root,output)!=='dist-private')throw Error('Invalid private build output');
try{if((await lstat(output)).isSymbolicLink())throw Error('Build output must not be a symbolic link');}catch(error){if(error.code!=='ENOENT')throw error;}
const git=process.env.SAGE_GIT_BIN||'git';
const tracked=execFileSync(git,['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const allowed=name=>name==='index.html'||name==='Revindale.jpg'||
  /^(css\/.*\.css|js\/.*\.(js|mjs)|data\/(news|wow)\.json)$/.test(name)||
  (name.startsWith('assets/')&&!name.includes('/originals/')&&/\.(png|jpe?g|webp|svg|gif|avif|woff2?)$/i.test(name));
// Include newly authored browser modules before their first commit, but no
// credentials, backend source, migrations, fixtures, source maps or Git files.
const files=new Set(tracked.filter(allowed));files.add('js/private-site.js');
await rm(output,{recursive:true,force:true});
for(const name of files){
  const target=resolve(output,'HomePage',name);
  if(!target.startsWith(output+sep))throw Error('Invalid asset path');
  await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,name),target);
}
const commit=execFileSync(git,['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await writeFile(resolve(output,'HomePage/release.json'),JSON.stringify({commit,privateHosting:true})+'\n');
console.log(`Private site: ${files.size} allowlisted files; backend, secrets, QA and source artwork excluded.`);
