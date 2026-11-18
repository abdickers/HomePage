/** Export individually generated Mordor masters without repainting the artwork. */
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'../work-homepage-refresh/package.json'));
const sharp=require('sharp');
const source=resolve(root,'design/switchable-themes/mordor'),out=resolve(root,'assets/themes/mordor');
await mkdir(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest={theme:'mordor',source:'Built-in imagegen from approved Mordor concept; exact prompts and original PNGs in design/switchable-themes/mordor',sources:{},assets:{},frame:{corner:220,renderedCorner:50,horizontalTile:300,verticalTile:200},scroll:{width:1280,height:1280,mobileSlices:[250,0,250,0]}};
for(const name of ['header','sidebar','frame','icons','scroll','buttons','hearth']) {
  const bytes=await readFile(resolve(source,name+'.png')),m=await sharp(bytes).metadata();
  manifest.sources[name]={width:m.width,height:m.height,hasAlpha:m.hasAlpha,sha256:hash(bytes)};
}
function bounds(data,width,height,threshold=32) {
  let left=width,top=height,right=0,bottom=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>threshold){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  if(!right||!bottom)throw Error('Empty alpha asset');
  const l=Math.max(0,left-4),t=Math.max(0,top-4);
  return {left:l,top:t,width:Math.min(width,right+4)-l,height:Math.min(height,bottom+4)-t};
}
async function save(name,pipeline,{lossless=true,crop}={}) {
  const bytes=await pipeline.webp({lossless,quality:88,effort:6}).toBuffer(),m=await sharp(bytes).metadata();
  await writeFile(resolve(out,name+'.webp'),bytes);
  manifest.assets[name]={width:m.width,height:m.height,hasAlpha:m.hasAlpha,bytes:bytes.length,sha256:hash(bytes),...(crop?{sourceCrop:crop}:{})};
}
for(const [name,widths] of [['header',[2172,1100]],['background',[1672,960]]])for(const width of widths)await save(name+'-'+width,sharp(resolve(source,'header.png')).removeAlpha().resize({width}),{lossless:false});
const portrait=manifest.sources.sidebar;
for(const [name,box] of Object.entries({top:{left:0,top:0,width:portrait.width,height:432},fill:{left:0,top:900,width:portrait.width,height:100},bottom:{left:0,top:1080,width:portrait.width,height:portrait.height-1080}}))await save('sidebar-'+name,sharp(resolve(source,'sidebar.png')).extract(box).resize({width:512}),{lossless:false,crop:box});
await save('texture',sharp(resolve(source,'sidebar.png')).extract({left:150,top:580,width:400,height:400}).resize(512,512),{lossless:false});
const frame=await sharp(resolve(source,'frame.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const frameCrop=bounds(frame.data,frame.info.width,frame.info.height),w=frameCrop.width,h=frameCrop.height,c=220;
const frameBytes=await sharp(resolve(source,'frame.png')).extract(frameCrop).png().toBuffer();
manifest.frame.sourceCrop=frameCrop;
manifest.frame.centerAlpha=frame.data[(Math.floor(frame.info.height/2)*frame.info.width+Math.floor(frame.info.width/2))*4+3];
if(manifest.frame.centerAlpha!==0)throw Error('Frame center must be transparent');
for(const [name,box] of Object.entries({tl:{left:0,top:0,width:c,height:c},tr:{left:w-c,top:0,width:c,height:c},bl:{left:0,top:h-c,width:c,height:c},br:{left:w-c,top:h-c,width:c,height:c},top:{left:Math.floor(w/2-150),top:0,width:300,height:c},bottom:{left:Math.floor(w/2-150),top:h-c,width:300,height:c},left:{left:0,top:Math.floor(h/2-100),width:c,height:200},right:{left:w-c,top:Math.floor(h/2-100),width:c,height:200}}))await save('frame-'+name,sharp(frameBytes).extract(box),{crop:box});
async function atlas(kind,names,columns,rows,maxEdge) {
  const meta=manifest.sources[kind];if(!meta.hasAlpha)throw Error(kind+' needs genuine alpha');
  for(const [i,name] of names.entries()) {
    const left=Math.round((i%columns)*meta.width/columns),top=Math.round(Math.floor(i/columns)*meta.height/rows);
    const cell={left,top,width:Math.round((i%columns+1)*meta.width/columns)-left,height:Math.round((Math.floor(i/columns)+1)*meta.height/rows)-top};
    const raw=await sharp(resolve(source,kind+'.png')).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const crop=bounds(raw.data,cell.width,cell.height);
    await save(name,sharp(raw.data,{raw:{width:cell.width,height:cell.height,channels:4}}).extract(crop).resize({width:maxEdge,height:maxEdge,fit:'inside',withoutEnlargement:true}),{crop:{left:left+crop.left,top:top+crop.top,width:crop.width,height:crop.height}});
  }
}
await atlas('icons',['calendar','home','provisions','raven','orb','news','tools','compass','weather','camera','refresh','settings'].map(name=>'icon-'+name).concat(['sidebar-crest','footer-emblem','sidebar-icon-warroom','sidebar-icon-treasury']),4,4,320);
// Use the same individual object family for navigation, at readable small sizes.
for(const [target,icon] of Object.entries({overview:'compass',home:'home',provisions:'provisions',settings:'settings'}))await save('sidebar-icon-'+target,sharp(resolve(out,'icon-'+icon+'.webp')).resize({width:160,height:160,fit:'inside'}));
await atlas('buttons',['normal','hover','pressed','secondary','secondary-hover','disabled'].map(name=>'button-'+name),3,2,600);
await atlas('hearth',['idle','heat','cool'].map(name=>'hearth-'+name),3,1,288);
const scroll=manifest.sources.scroll;if(scroll.width!==scroll.height||!scroll.hasAlpha)throw Error('Scroll must be square with alpha');
await save('scroll',sharp(resolve(source,'scroll.png')).resize(1280,1280),{lossless:false});
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Mordor: '+Object.keys(manifest.assets).length+' assets, '+(Object.values(manifest.assets).reduce((sum,a)=>sum+a.bytes,0)/1048576).toFixed(2)+' MB; frame center alpha '+manifest.frame.centerAlpha);
