/** Export approved material, control, hearth, and scroll artwork without repainting it. */
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'../work-homepage-refresh/package.json'));
const sharp=require('sharp');
const generated=resolve(process.env.USERPROFILE||'C:/Users/Sage4','.codex/generated_images/01a1ea3c-b8a9-7863-aad5-46bbdc430100');
const sources={
  hobbit:{sidebar:'exec-800b3a1c-0882-4638-9ce3-cac8b496698a.png',texture:'exec-89fdf667-0cc8-4323-af47-595d59baff2b.png',buttons:'exec-9f50a07f-3552-4f6e-a066-430eb3141e8d.png',hearth:'exec-82c18501-51b7-402a-bd9b-26d08c46e601.png',scroll:'exec-90aa6251-eed9-4324-931c-608a9ceb50c1.png'},
  dwarven:{sidebar:'exec-c4a0d36f-de1a-48fb-aedf-9e3cfa831f49.png',texture:'exec-f38a05a4-72f9-41ce-acbf-d4dd97103ac6.png',buttons:'exec-a559e358-62be-4b9c-8544-98dc078c19df.png',hearth:'exec-341b1b39-66ca-47dc-ab1f-2e1f5e4e94b3.png',scroll:'exec-3c8e6ac1-0d8c-48a4-a4ab-758918823b6f.png'},
  gondor:{scroll:'exec-a95569a8-b017-4acf-9ecf-9d869cc50314.png'}
};
const buttonNames=['normal','hover','pressed','secondary','secondary-hover','disabled'];
const hearthNames=['idle','heat','cool'];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
function bounds(data,width,height){
  let left=width,top=height,right=0,bottom=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>32){
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
  }
  if(!right||!bottom)throw Error('Empty alpha asset');
  // Keep a four-pixel margin so antialiased silhouette edges remain intact.
  const l=Math.max(0,left-4),t=Math.max(0,top-4);
  return {left:l,top:t,width:Math.min(width,right+4)-l,height:Math.min(height,bottom+4)-t};
}

for(const [theme,files] of Object.entries(sources)){
  const originals=resolve(root,'design/switchable-themes',theme);
  const out=resolve(root,'assets/themes',theme);
  await mkdir(originals,{recursive:true});await mkdir(out,{recursive:true});
  const manifest={theme,source:'Built-in imagegen; approved dashboard style with additional crafted assets and parchment scroll',sources:{},assets:{},button:{columns:3,rows:2,outputWidth:600},hearth:{columns:3,rows:1,maxEdge:288},scroll:{width:1280,height:1280,mobileSlices:[250,0,250,0]}};
  const input={};
  for(const [name,filename] of Object.entries(files)){
    const target=resolve(originals,name+'.png');
    try{await readFile(target);}catch{await copyFile(resolve(generated,filename),target);}
    input[name]=target;
    const bytes=await readFile(target),meta=await sharp(bytes).metadata();
    manifest.sources[name]={path:`design/switchable-themes/${theme}/${name}.png`,generatedFilename:filename,sha256:hash(bytes),width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha};
  }
  async function save(name,pipeline,{lossless=true,quality=90,crop}={}){
    const bytes=await pipeline.webp({lossless,quality,effort:6}).toBuffer();
    await writeFile(resolve(out,name+'.webp'),bytes);
    const meta=await sharp(bytes).metadata();
    manifest.assets[name]={width:meta.width,height:meta.height,bytes:bytes.length,hasAlpha:meta.hasAlpha,sha256:hash(bytes),...(crop?{sourceCrop:crop}:{})};
  }
  if(input.sidebar)await save('sidebar',sharp(input.sidebar).resize({width:512}),{lossless:false,quality:88});
  if(input.texture)await save('texture',sharp(input.texture).resize({width:512}),{lossless:false,quality:88});
  for(const [kind,names,cols,rows] of [['buttons',buttonNames,3,2],['hearth',hearthNames,3,1]]){
    if(!input[kind])continue;
    const meta=await sharp(input[kind]).metadata();
    if(!meta.hasAlpha)throw Error(theme+' '+kind+' must have alpha');
    for(const [index,name] of names.entries()){
      const col=index%cols,row=Math.floor(index/cols);
      const left=Math.round(col*meta.width/cols),top=Math.round(row*meta.height/rows);
      const cell={left,top,width:Math.round((col+1)*meta.width/cols)-left,height:Math.round((row+1)*meta.height/rows)-top};
      const raw=await sharp(input[kind]).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const box=bounds(raw.data,cell.width,cell.height);
      let pipeline=sharp(raw.data,{raw:{width:cell.width,height:cell.height,channels:4}}).extract(box);
      pipeline=kind==='buttons'?pipeline.resize({width:600}):pipeline.resize({width:288,height:288,fit:'inside',withoutEnlargement:true});
      await save((kind==='buttons'?'button-':'hearth-')+name,pipeline,{crop:{left:left+box.left,top:top+box.top,width:box.width,height:box.height}});
    }
  }
  const scroll=await sharp(input.scroll).metadata();
  if(scroll.width!==scroll.height||!scroll.hasAlpha)throw Error(theme+' scroll must be square RGBA');
  await save('scroll',sharp(input.scroll).resize({width:1280,height:1280}),{lossless:false,quality:90});
  await writeFile(resolve(out,'craft-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(theme+': '+Object.keys(manifest.assets).length+' crafted assets; '+Object.values(manifest.assets).reduce((sum,a)=>sum+a.bytes,0)+' bytes.');
}
