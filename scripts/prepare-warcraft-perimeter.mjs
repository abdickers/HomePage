/** Prepare the complete portrait-matched Alliance section perimeter. */
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'../work-homepage-refresh/package.json'));
const sharp=require('sharp');
const originalDir=resolve(root,'design/warcraft-controls'),out=resolve(root,'assets/warcraft');
await mkdir(originalDir,{recursive:true});await mkdir(out,{recursive:true});
const prompt=JSON.parse(await readFile(resolve(originalDir,'perimeter-prompt.json'),'utf8'));
const master=resolve(originalDir,'perimeter.png');
try{await readFile(master);}catch{await copyFile(prompt.source,master);}
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const source=await readFile(master),sourceMeta=await sharp(source).metadata();
if(!sourceMeta.hasAlpha)throw Error('Perimeter source must have alpha');
const manifest={source:{path:'design/warcraft-controls/perimeter.png',sha256:hash(source),width:sourceMeta.width,height:sourceMeta.height},portraitReference:'assets/redesign/wow-alliance-portrait-frame.webp',corner:400,renderedCorner:{desktop:112,mobile:84},alphaCleanupMax:3,assets:{}};
const raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=raw.info.width,top=raw.info.height,right=0,bottom=0;
for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
const sourceCrop={left,top,width:right-left,height:bottom-top};
manifest.sourceCrop=sourceCrop;
const center=raw.data[(Math.floor(raw.info.height/2)*raw.info.width+Math.floor(raw.info.width/2))*4+3];
if(center!==0)throw Error('Frame center must be truly transparent');
manifest.centerAlpha=center;
const frame=await sharp(source).extract(sourceCrop).png().toBuffer(),w=sourceCrop.width,h=sourceCrop.height,c=400;
async function save(name,pipeline,details={}){
  const rgba=await pipeline.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<rgba.data.length;i+=4)if(rgba.data[i+3]<=3){rgba.data[i]=0;rgba.data[i+1]=0;rgba.data[i+2]=0;rgba.data[i+3]=0;}
  const bytes=await sharp(rgba.data,{raw:{width:rgba.info.width,height:rgba.info.height,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
  await writeFile(resolve(out,name+'.webp'),bytes);
  manifest.assets[name]={width:rgba.info.width,height:rgba.info.height,bytes:bytes.length,sha256:hash(bytes),hasAlpha:true,...details};
}
const corners={tl:{left:0,top:0,width:c,height:c},tr:{left:w-c,top:0,width:c,height:c},bl:{left:0,top:h-c,width:c,height:c},br:{left:w-c,top:h-c,width:c,height:c}};
for(const[name,crop]of Object.entries(corners))await save('alliance-frame-'+name,sharp(frame).extract(crop),{sourceCrop:crop});

// Quiet cobalt/gold lattice segments are mirrored at one endpoint to make
// seamless repeats; large studs and banners remain fixed in corner artwork.
const railCrops={
  top:{left:710,top:0,width:88,height:c},
  bottom:{left:710,top:h-c,width:88,height:c},
  left:{left:0,top:570,width:c,height:80},
  right:{left:w-c,top:570,width:c,height:80}
};
for(const[name,crop]of Object.entries(railCrops)){
  const horizontal=name==='top'||name==='bottom';
  const first=await sharp(frame).extract(crop).png().toBuffer();
  const mirrored=await (horizontal?sharp(first).flop():sharp(first).flip()).png().toBuffer();
  const width=horizontal?crop.width*2:crop.width,height=horizontal?crop.height:crop.height*2;
  const tile=sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:first,left:0,top:0},{input:mirrored,left:horizontal?crop.width:0,top:horizontal?0:crop.height}]);
  await save('alliance-frame-'+name,tile,{sourceCrop:crop,construction:'quiet source segment plus reflected segment; no motif stretching'});
}

// The Paladin hammer/book medallion is an exact crop of the existing portrait,
// including its short joining tabs so it naturally meets the new bottom rail.
const portraitPath=resolve(root,'assets/redesign/wow-alliance-portrait-frame.webp');
const portrait=await readFile(portraitPath),sealCrop={left:290,top:1190,width:444,height:340};
manifest.paladinSealSource={path:'assets/redesign/wow-alliance-portrait-frame.webp',sha256:hash(portrait),crop:sealCrop};
await sharp(portrait).extract(sealCrop).png().toFile(resolve(originalDir,'perimeter-paladin-seal-crop.png'));
await save('alliance-paladin-seal',sharp(portrait).extract(sealCrop).resize({width:512}),{sourceCrop:sealCrop,source:'existing portrait frame'});
await writeFile(resolve(out,'alliance-frame-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Alliance full perimeter: '+Object.keys(manifest.assets).length+' WebPs; '+Object.values(manifest.assets).reduce((n,a)=>n+a.bytes,0)+' bytes; corners400, top/bottom176x400, sides400x160; center alpha'+center+'.');
