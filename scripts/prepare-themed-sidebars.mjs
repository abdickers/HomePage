/** Prepare approved Gondor/Elven sidebar artwork without stretching or repainting it. */
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
  gondor:{background:'exec-7e788b12-ab0b-4a0e-b23b-32218554883d.png',crest:'exec-5e86b476-6957-41ec-99a0-8f43e609afcb.png',icons:'exec-ff004e3c-3f10-41bc-886f-6e4690dc049f.png'},
  elven:{background:'exec-552b988a-6a11-4047-b3cc-dbd38f2f442b.png',crest:'exec-33efc2cb-140d-4d81-a2ea-069daf77e303.png',icons:'exec-378a5819-f4be-462b-8b11-5faeb54f6e25.png'}
};
const iconNames=['overview','home','provisions','warroom','treasury','settings'];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
function alphaBounds(data,width,height){
  let left=width,top=height,right=0,bottom=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>32){
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
  }
  if(!right||!bottom)throw Error('Empty alpha asset');
  const l=Math.max(0,left-4),t=Math.max(0,top-4);
  return {left:l,top:t,width:Math.min(width,right+4)-l,height:Math.min(height,bottom+4)-t};
}

for(const [theme,files] of Object.entries(sources)){
  const originals=resolve(root,'design/switchable-themes',theme),out=resolve(root,'assets/themes',theme);
  await mkdir(originals,{recursive:true});await mkdir(out,{recursive:true});
  const manifest={theme,source:'Built-in imagegen; approved theme-specific Gondor and Elven sidebars',sources:{},assets:{},layout:{exportWidth:512,topSourceHeight:432,fillSourceTop:900,fillSourceHeight:100,bottomSourceTop:1320,rendering:'Top and bottom use 100% auto; only the quiet fill repeats vertically. Objects retain their original aspect ratio.'}};
  const input={};
  for(const [name,filename] of Object.entries(files)){
    const target=resolve(originals,'sidebar-'+name+'.png');
    try{await readFile(target);}catch{await copyFile(resolve(generated,filename),target);}
    input[name]=target;
    const bytes=await readFile(target),meta=await sharp(bytes).metadata();
    manifest.sources[name]={path:`design/switchable-themes/${theme}/sidebar-${name}.png`,generatedFilename:filename,sha256:hash(bytes),width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha};
  }
  async function save(name,pipeline,{lossless=true,quality=88,crop}={}){
    const bytes=await pipeline.webp({lossless,quality,effort:6}).toBuffer();
    await writeFile(resolve(out,name+'.webp'),bytes);
    const meta=await sharp(bytes).metadata();
    manifest.assets[name]={width:meta.width,height:meta.height,bytes:bytes.length,hasAlpha:meta.hasAlpha,sha256:hash(bytes),...(crop?{sourceCrop:crop}:{})};
  }
  const backdrop=await sharp(input.background).metadata();
  if(backdrop.width!==724||backdrop.height<2100)throw Error('Unexpected sidebar backdrop geometry');
  await save('sidebar',sharp(input.background).resize({width:512}),{lossless:false});
  const slices={top:{left:0,top:0,width:backdrop.width,height:432},fill:{left:0,top:900,width:backdrop.width,height:100},bottom:{left:0,top:1320,width:backdrop.width,height:backdrop.height-1320}};
  for(const [name,box] of Object.entries(slices))await save('sidebar-'+name,sharp(input.background).extract(box).resize({width:512}),{lossless:false,crop:box});
  const crest=await sharp(input.crest).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const crestCrop=alphaBounds(crest.data,crest.info.width,crest.info.height);
  await save('sidebar-crest',sharp(input.crest).extract(crestCrop).resize({width:320,height:320,fit:'inside',withoutEnlargement:true}),{crop:crestCrop});
  const atlas=await sharp(input.icons).metadata();
  if(!atlas.hasAlpha||atlas.width!==1536||atlas.height!==1024)throw Error('Expected final 3 x 2 RGBA sidebar icon atlas');
  for(const [index,name] of iconNames.entries()){
    const cell={left:(index%3)*512,top:Math.floor(index/3)*512,width:512,height:512};
    const raw=await sharp(input.icons).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const crop=alphaBounds(raw.data,512,512);
    const icon=sharp(raw.data,{raw:{width:512,height:512,channels:4}}).extract(crop).resize({width:160,height:160,fit:'inside',withoutEnlargement:true});
    await save('sidebar-icon-'+name,icon,{crop:{left:cell.left+crop.left,top:cell.top+crop.top,width:crop.width,height:crop.height}});
  }
  await writeFile(resolve(out,'sidebar-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(theme+': '+Object.keys(manifest.assets).length+' sidebar WebPs; '+Object.values(manifest.assets).reduce((sum,a)=>sum+a.bytes,0)+' bytes.');
}
