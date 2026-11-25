/** Export the approved Steampunk production artwork without repainting source masters. */
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportPocSidebar} from './steampunk-sidebar-art.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'../work-homepage-refresh/package.json'));
const sharp=require('sharp');
const originals=resolve(root,'design/steampunk-gothic-victorian');
const out=resolve(root,'assets/themes/steampunk');
await mkdir(originals,{recursive:true});await mkdir(out,{recursive:true});
const prompts=JSON.parse(await readFile(resolve(originals,'prompts.json'),'utf8'));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const manifest={theme:'steampunk',source:'Built-in image_gen.imagegen; approved Steampunk concept as style reference',prompts:'design/steampunk-gothic-victorian/prompts.json',alphaCleanupMax:3,sources:{},assets:{},frame:{corner:220,renderedCorner:50,horizontalTile:300,verticalTile:200,normalizedWidth:1024},sidebar:{exportWidth:512,topSourceHeight:432,fillSourceTop:700,fillSourceHeight:100,bottomSourceTop:1160},scroll:{width:1280,height:1280,suggestedMobileSlices:[360,0,200,0]}};
const input={};
for(const job of prompts.jobs){
  const target=resolve(originals,job.master||job.asset+'.png');
  try{await readFile(target);}catch{await copyFile(job.source,target);}
  input[job.asset]=target;
  const bytes=await readFile(target),meta=await sharp(bytes).metadata();
  manifest.sources[job.asset]={path:`design/steampunk-gothic-victorian/${job.master||job.asset+'.png'}`,generatedSource:job.source,sha256:hash(bytes),width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha};
}
function bounds(data,width,height,{threshold=32,margin=0}={}){
  let left=width,top=height,right=0,bottom=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>threshold){
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
  }
  if(!right||!bottom)throw Error('Empty alpha asset');
  const l=Math.max(0,left-margin),t=Math.max(0,top-margin);
  return {left:l,top:t,width:Math.min(width,right+margin)-l,height:Math.min(height,bottom+margin)-t};
}
async function save(name,pipeline,{lossless=true,quality=88,crop,source}={}){
  const processed=await pipeline.raw().toBuffer({resolveWithObject:true});
  // Generated masters can contain invisible alpha 1–3 noise far outside their
  // objects. Normalize that noise to true zero after resizing, retaining every
  // visible antialiased edge and leaving the original PNG masters unchanged.
  if(processed.info.channels===4)for(let i=0;i<processed.data.length;i+=4){
    if(processed.data[i+3]<=3){processed.data[i]=0;processed.data[i+1]=0;processed.data[i+2]=0;processed.data[i+3]=0;}
  }
  const bytes=await sharp(processed.data,{raw:{width:processed.info.width,height:processed.info.height,channels:processed.info.channels}}).webp({lossless,quality,effort:6}).toBuffer();
  await writeFile(resolve(out,name+'.webp'),bytes);
  const meta=await sharp(bytes).metadata();
  manifest.assets[name]={width:meta.width,height:meta.height,bytes:bytes.length,hasAlpha:meta.hasAlpha,sha256:hash(bytes),...(source?{source}:{}),...(crop?{sourceCrop:crop}:{})};
}
async function alias(target,source){
  const bytes=await readFile(resolve(out,source+'.webp'));
  await writeFile(resolve(out,target+'.webp'),bytes);
  manifest.assets[target]={...manifest.assets[source],aliasOf:source};
}
for(const [name,widths]of [['header',[2172,1100]],['background',[1672,960]]]){
  for(const width of widths)await save(name+'-'+width,sharp(input.header).resize({width}),{lossless:false,source:'header'});
}

// Normalize the whole frame proportionally before slicing, so the long corner
// loops remain inside the common 220px corner cells rather than being cut off.
const rawFrame=await sharp(input.frame).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const frameBounds=bounds(rawFrame.data,rawFrame.info.width,rawFrame.info.height);
const frame=await sharp(input.frame).extract(frameBounds).resize({width:1024}).png().toBuffer();
const fm=await sharp(frame).metadata(),w=fm.width,h=fm.height,c=220;
if(h<2*c+200||w<2*c+300)throw Error('Normalized frame too small for quiet rails');
const centerAlpha=rawFrame.data[(Math.floor(rawFrame.info.height/2)*rawFrame.info.width+Math.floor(rawFrame.info.width/2))*4+3];
if(centerAlpha!==0)throw Error('Frame opening must be truly transparent');
manifest.frame={...manifest.frame,sourceCrop:frameBounds,normalizedHeight:h,centerAlpha};
const frameBoxes={
  tl:{left:0,top:0,width:c,height:c},tr:{left:w-c,top:0,width:c,height:c},
  bl:{left:0,top:h-c,width:c,height:c},br:{left:w-c,top:h-c,width:c,height:c},
  top:{left:Math.floor(w/2-150),top:0,width:300,height:c},
  bottom:{left:Math.floor(w/2-150),top:h-c,width:300,height:c},
  left:{left:0,top:Math.floor(h/2-100),width:c,height:200},
  right:{left:w-c,top:Math.floor(h/2-100),width:c,height:200}
};
for(const[name,box]of Object.entries(frameBoxes))await save('frame-'+name,sharp(frame).extract(box),{crop:box,source:'normalized-frame'});

const sidebarMeta=await sharp(input.sidebar).metadata();
const sideTop=Math.round(sidebarMeta.height*.25), sideBottom=Math.round(sidebarMeta.height*.73), sideFill=Math.round(sidebarMeta.height*.44);
await save('sidebar',sharp(input.sidebar).resize({width:512}),{lossless:false,source:'sidebar'});
const sideBoxes={
  top:{left:0,top:0,width:sidebarMeta.width,height:sideTop},
  fill:{left:0,top:sideFill,width:sidebarMeta.width,height:100},
  bottom:{left:0,top:sideBottom,width:sidebarMeta.width,height:sidebarMeta.height-sideBottom}
};
for(const[name,box]of Object.entries(sideBoxes))await save('sidebar-'+name,sharp(input.sidebar).extract(box).resize({width:512}),{lossless:false,crop:box,source:'sidebar'});
manifest.sidebar={exportWidth:512,topSourceHeight:sideTop,fillSourceTop:sideFill,fillSourceHeight:100,bottomSourceTop:sideBottom};
const textureEdge=Math.round(sidebarMeta.width*.58);
const textureCrop={left:Math.round(sidebarMeta.width*.21),top:sideFill,width:textureEdge,height:textureEdge};
await save('texture',sharp(input.sidebar).extract(textureCrop).resize({width:512}),{lossless:false,crop:textureCrop,source:'sidebar'});

// The revised materials are square scans, never stretched from a shallow strip.
// Keep their natural grain scale independently of the viewport or panel ratio.
if(input.materials) {
  const meta=await sharp(input.materials).metadata();
  const middle=Math.round(meta.width/2);
  for(const [name,left,width] of [['sidebar-material-v2',0,middle],['panel-material-v2',middle,meta.width-middle]]) {
    const crop={left,top:0,width,height:meta.height};
    await save(name,sharp(input.materials).extract(crop).resize({width:1024,height:1024}),{lossless:false,quality:90,crop,source:'materials'});
  }
}
if(input.cabinet) {
  await save('clockwork-cabinet-v2',sharp(input.cabinet).resize({width:512,height:768,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}),{source:'cabinet'});
  manifest.cabinet={width:512,height:768,dialCenter:[.5,.355],openingDiameter:.43};
}

const iconNames=['calendar','home','provisions','raven','orb','news','tools','compass','weather','camera','refresh','settings','sidebar-crest','footer-emblem','sidebar-icon-warroom','sidebar-icon-treasury'];
const atlasMeta=await sharp(input.objects).metadata();
if(!atlasMeta.hasAlpha||atlasMeta.width!==atlasMeta.height)throw Error('Expected square 4 x 4 alpha object atlas');
for(const[index,name]of iconNames.entries()){
  const col=index%4,row=Math.floor(index/4),left=Math.round(col*atlasMeta.width/4),top=Math.round(row*atlasMeta.height/4);
  const cell={left,top,width:Math.round((col+1)*atlasMeta.width/4)-left,height:Math.round((row+1)*atlasMeta.height/4)-top};
  const raw=await sharp(input.objects).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const box=bounds(raw.data,cell.width,cell.height,{margin:4});
  const edge=name==='sidebar-crest'?320:name==='footer-emblem'?640:160;
  const targetName=index<12?'icon-'+name:name;
  await save(targetName,sharp(raw.data,{raw:{width:cell.width,height:cell.height,channels:4}}).extract(box).resize({width:edge,height:edge,fit:'inside'}),{crop:{left:left+box.left,top:top+box.top,width:box.width,height:box.height},source:'objects'});
}
for(const[target,source]of [['sidebar-icon-overview','icon-compass'],['sidebar-icon-home','icon-home'],['sidebar-icon-provisions','icon-provisions'],['sidebar-icon-settings','icon-settings']])await alias(target,source);

for(const[kind,names,cols,rows,max]of [
  ['buttons',['normal','hover','pressed','secondary','secondary-hover','disabled'],3,2,600],
  ['hearth',['idle','heat','cool'],3,1,288]
]){
  const meta=await sharp(input[kind]).metadata();
  if(!meta.hasAlpha)throw Error(kind+' must have alpha');
  for(const[index,name]of names.entries()){
    const col=index%cols,row=Math.floor(index/cols),left=Math.round(col*meta.width/cols),top=Math.round(row*meta.height/rows);
    const cell={left,top,width:Math.round((col+1)*meta.width/cols)-left,height:Math.round((row+1)*meta.height/rows)-top};
    const raw=await sharp(input[kind]).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const box=bounds(raw.data,cell.width,cell.height,{margin:4});
    let pipeline=sharp(raw.data,{raw:{width:cell.width,height:cell.height,channels:4}}).extract(box);
    pipeline=kind==='buttons'?pipeline.resize({width:max}):pipeline.resize({width:max,height:max,fit:'inside'});
    await save((kind==='buttons'?'button-':'hearth-')+name,pipeline,{crop:{left:left+box.left,top:top+box.top,width:box.width,height:box.height},source:kind});
  }
}
const scrollMeta=await sharp(input.scroll).metadata();
if(!scrollMeta.hasAlpha||scrollMeta.width!==scrollMeta.height)throw Error('Scroll must be square RGBA');
await save('scroll',sharp(input.scroll).resize({width:1280,height:1280}),{lossless:false,quality:90,source:'scroll'});
// Precisely centered code-native wheels avoid asymmetric raster teeth and
// guarantee a shared tooth pitch. All other production artwork is imagegen.
function gearSvg(teeth) {
  const pitch=teeth*4,extent=pitch+10,side=extent*2;
  const point=(radius,angle)=>`${(extent+radius*Math.cos(angle)).toFixed(3)} ${(extent+radius*Math.sin(angle)).toFixed(3)}`;
  let outline='';
  for(let tooth=0;tooth<teeth;tooth++) {
    for(const [fraction,radius] of [[-.5,pitch-5],[-.32,pitch-5],[-.23,pitch+5],[.23,pitch+5],[.32,pitch-5],[.5,pitch-5]]) {
      outline+=`${outline?'L':'M'}${point(radius,(tooth+fraction)*2*Math.PI/teeth)} `;
    }
  }
  outline+='Z';
  const spokes=teeth===24?6:4;
  for(let i=0;i<spokes;i++) {
    const start=(i+.16)*2*Math.PI/spokes,end=(i+.84)*2*Math.PI/spokes,outer=pitch-17,inner=26;
    outline+=` M${point(inner,start)} L${point(outer,start)} A${outer} ${outer} 0 0 1 ${point(outer,end)} L${point(inner,end)} A${inner} ${inner} 0 0 0 ${point(inner,start)} Z`;
  }
  const rivets=Array.from({length:spokes},(_,i)=>{
    const [cx,cy]=point((pitch+18)/2,i*2*Math.PI/spokes).split(' ');
    return `<circle cx="${cx}" cy="${cy}" r="3" fill="#b67639" stroke="#f1ca7a" stroke-width="1"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}"><defs><linearGradient id="brass" x2=".75" y2="1"><stop stop-color="#f4d18c"/><stop offset=".22" stop-color="#9d692f"/><stop offset=".47" stop-color="#e4b65f"/><stop offset=".7" stop-color="#6d431e"/><stop offset="1" stop-color="#c08a43"/></linearGradient><radialGradient id="hub"><stop stop-color="#d6ad65"/><stop offset=".75" stop-color="#885727"/><stop offset="1" stop-color="#2d1b10"/></radialGradient></defs><path d="${outline}" fill="url(#brass)" fill-rule="evenodd" stroke="#3c2514" stroke-width="2" stroke-linejoin="round"/><circle cx="${extent}" cy="${extent}" r="${pitch-10}" fill="none" stroke="#efc577" stroke-width="1"/><circle cx="${extent}" cy="${extent}" r="21" fill="none" stroke="#e9ba6a" stroke-width="2"/>${rivets}<circle cx="${extent}" cy="${extent}" r="16" fill="url(#hub)" stroke="#f0c77f" stroke-width="2"/><circle cx="${extent}" cy="${extent}" r="7" fill="#20160f" stroke="#8c602d" stroke-width="2"/><path d="M${extent-3} ${extent}h6" stroke="#dcb778" stroke-width="1.5"/></svg>`;
}
for(const [name,teeth,period] of [['large',24,72],['small',16,48]]) {
  const bytes=Buffer.from(gearSvg(teeth));
  await writeFile(resolve(out,`gear-${name}.svg`),bytes);
  manifest.assets[`gear-${name}`]={format:'svg',width:teeth*8+20,height:teeth*8+20,teeth,periodSeconds:period,bytes:bytes.length,hasAlpha:true,sha256:hash(bytes),source:'deterministic centered SVG geometry'};
}
manifest.pocSidebar=await exportPocSidebar({root,sharp,save});
manifest.sources['approved-poc-sidebar']=manifest.pocSidebar.source;
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Steampunk: ${Object.keys(manifest.assets).length} optimized assets; ${Object.values(manifest.assets).reduce((n,a)=>n+a.bytes,0)} bytes; normalized frame ${w}x${h}, corners220, quiet rail tiles300x220 and220x200; center alpha${centerAlpha}.`);
