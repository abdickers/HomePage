/** Export the approved Alliance control plates and lion crest without repainting art. */
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'../work-homepage-refresh/package.json'));
const sharp=require('sharp');
const originals=resolve(root,'design/warcraft-controls'),out=resolve(root,'assets/warcraft');
await mkdir(originals,{recursive:true});await mkdir(out,{recursive:true});
const jobs=JSON.parse(await readFile(resolve(originals,'prompts.json'),'utf8')).jobs;
const manifest={source:'Built-in imagegen, matching existing Alliance character portrait frame',alphaCleanupMax:3,sources:{},assets:{},control:{columns:3,rows:2,exportWidth:600,cssSlices:[48,96],cssWidths:['10px','22px']}};
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const input={};
for(const job of jobs){
  const target=resolve(originals,job.asset+'.png');
  try{await readFile(target);}catch{await copyFile(job.source,target);}
  input[job.asset]=target;
  const bytes=await readFile(target),meta=await sharp(bytes).metadata();
  if(!meta.hasAlpha)throw Error('Approved artwork must have alpha');
  manifest.sources[job.asset]={path:`design/warcraft-controls/${job.asset}.png`,generatedSource:job.source,width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha,sha256:hash(bytes)};
}
function bounds(data,width,height){
  let left=width,top=height,right=0,bottom=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  if(!right||!bottom)throw Error('Empty artwork');
  const l=Math.max(0,left-4),t=Math.max(0,top-4);
  return {left:l,top:t,width:Math.min(width,right+4)-l,height:Math.min(height,bottom+4)-t};
}
async function save(name,pipeline,crop){
  const raw=await pipeline.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<raw.data.length;i+=4)if(raw.data[i+3]<=3){raw.data[i]=0;raw.data[i+1]=0;raw.data[i+2]=0;raw.data[i+3]=0;}
  const bytes=await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
  await writeFile(resolve(out,name+'.webp'),bytes);
  const meta=await sharp(bytes).metadata();
  manifest.assets[name]={path:`assets/warcraft/${name}.webp`,width:meta.width,height:meta.height,bytes:bytes.length,hasAlpha:meta.hasAlpha,sourceCrop:crop,sha256:hash(bytes)};
}
const atlas=await sharp(input.controls).metadata();
for(const[index,name]of ['normal','hover','pressed','secondary','secondary-hover','disabled'].entries()){
  const col=index%3,row=Math.floor(index/3),left=Math.round(col*atlas.width/3),top=Math.round(row*atlas.height/2);
  const cell={left,top,width:Math.round((col+1)*atlas.width/3)-left,height:Math.round((row+1)*atlas.height/2)-top};
  const raw=await sharp(input.controls).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const box=bounds(raw.data,cell.width,cell.height);
  await save('control-'+name,sharp(raw.data,{raw:{width:cell.width,height:cell.height,channels:4}}).extract(box).resize({width:600}),{left:left+box.left,top:top+box.top,width:box.width,height:box.height});
}
const lion=await sharp(input.lion).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const lionCrop=bounds(lion.data,lion.info.width,lion.info.height);
await save('alliance-lion-crest',sharp(input.lion).extract(lionCrop).resize({width:512,height:512,fit:'inside'}),lionCrop);
await writeFile(resolve(originals,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Alliance controls: '+Object.keys(manifest.assets).length+' WebPs; '+Object.values(manifest.assets).reduce((sum,a)=>sum+a.bytes,0)+' bytes.');
