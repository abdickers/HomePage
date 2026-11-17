/** Prepare approved Hobbit/Dwarven raster art without repainting source images. */
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
  hobbit:{header:'exec-77ff9317-6bf7-499b-bc73-1e840cd50a64.png',frame:'exec-bc642d4d-6eec-4e71-b151-8f4037f272bf.png',icons:'exec-c65a1d0d-01dd-4737-a5f0-0ee8bd5e23d9.png'},
  dwarven:{header:'exec-e0ea9d03-a6af-4753-ad35-c8c0eb02cabc.png',frame:'exec-e3609fc9-1535-4f38-95ee-98c04d799d76.png',icons:'exec-77a96dff-2031-443c-a523-da09a6877bb8.png'}
};
const iconNames=['calendar','home','provisions','raven','orb','news','tools','compass','weather','camera','refresh','settings'];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
function bounds(data,width,height,threshold=32){
  let left=width,top=height,right=0,bottom=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>threshold){
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
  }
  if(!right||!bottom)throw Error('Empty alpha asset');
  return {left,top,width:right-left,height:bottom-top};
}

for(const [theme,files] of Object.entries(sources)){
  const originals=resolve(root,'design/switchable-themes',theme);
  const out=resolve(root,'assets/themes',theme);
  await mkdir(originals,{recursive:true});await mkdir(out,{recursive:true});
  const manifest={theme,source:'Built-in imagegen; approved dashboard mockup used as style reference',sources:{},assets:{},frame:{corner:220,renderedCorner:50,horizontalTile:300,verticalTile:200}};
  const input={};
  for(const [name,filename] of Object.entries(files)){
    const target=resolve(originals,name+'.png');
    try{await readFile(target);}catch{await copyFile(resolve(generated,filename),target);}
    input[name]=target;
    const bytes=await readFile(target);
    const meta=await sharp(bytes).metadata();
    manifest.sources[name]={path:`design/switchable-themes/${theme}/${name}.png`,generatedFilename:filename,sha256:hash(bytes),width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha};
  }
  async function save(name,pipeline,lossless=true){
    const bytes=await pipeline.webp({lossless,quality:85,effort:6}).toBuffer();
    await writeFile(resolve(out,name+'.webp'),bytes);
    const meta=await sharp(bytes).metadata();
    manifest.assets[name]={width:meta.width,height:meta.height,bytes:bytes.length,hasAlpha:meta.hasAlpha,sha256:hash(bytes)};
  }
  for(const [name,widths] of [['header',[2172,1100]],['background',[1672,960]]]){
    for(const width of widths)await save(name+'-'+width,sharp(input.header).removeAlpha().resize({width}),false);
  }
  const raw=await sharp(input.frame).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const frameBounds=bounds(raw.data,raw.info.width,raw.info.height);
  const frame=await sharp(input.frame).extract(frameBounds).png().toBuffer();
  manifest.frame.sourceCrop=frameBounds;
  const {width:w,height:h}=frameBounds,c=220;
  const boxes={
    tl:{left:0,top:0,width:c,height:c},tr:{left:w-c,top:0,width:c,height:c},
    bl:{left:0,top:h-c,width:c,height:c},br:{left:w-c,top:h-c,width:c,height:c},
    top:{left:Math.floor(w/2-150),top:0,width:300,height:c},
    bottom:{left:Math.floor(w/2-150),top:h-c,width:300,height:c},
    left:{left:0,top:Math.floor(h/2-100),width:c,height:200},
    right:{left:w-c,top:Math.floor(h/2-100),width:c,height:200}
  };
  for(const [name,box] of Object.entries(boxes))await save('frame-'+name,sharp(frame).extract(box));
  const atlas=await sharp(input.icons).metadata();
  if(atlas.width%4||atlas.height%3)throw Error('Atlas must have a 4 x 3 grid');
  const cw=atlas.width/4,ch=atlas.height/3;
  for(const [index,name] of iconNames.entries()){
    const cell={left:(index%4)*cw,top:Math.floor(index/4)*ch,width:cw,height:ch};
    const tile=await sharp(input.icons).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const box=bounds(tile.data,cw,ch);
    // Leave a four-pixel alpha-safe margin before proportional downsampling.
    const left=Math.max(0,box.left-4),top=Math.max(0,box.top-4);
    const crop={left,top,width:Math.min(cw,box.left+box.width+4)-left,height:Math.min(ch,box.top+box.height+4)-top};
    await save('icon-'+name,sharp(tile.data,{raw:{width:cw,height:ch,channels:4}}).extract(crop).resize({width:160,height:160,fit:'inside',withoutEnlargement:true}));
  }
  const center=raw.data[(Math.floor(raw.info.height/2)*raw.info.width+Math.floor(raw.info.width/2))*4+3];
  if(center!==0)throw Error(theme+' frame center must be transparent');
  manifest.frame.centerAlpha=center;
  await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`${theme}: ${Object.keys(manifest.assets).length} WebP assets; corner 220px → 50px, horizontal repeat 68.182px, vertical repeat 45.455px; center alpha ${center}.`);
}
