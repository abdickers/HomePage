/** Crop the six built-in imagegen button states without repainting their art. */
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'../work-homepage-refresh/package.json'));
const sharp=require('sharp');
const source=resolve(root,'design/switchable-themes/gondor/button-states.png');
const out=resolve(root,'assets/themes/gondor');
const bytes=await readFile(source),meta=await sharp(bytes).metadata();
if(!meta.hasAlpha||meta.width%3||meta.height%2)throw Error('Expected a transparent exact 3-by-2 Gondor button atlas.');
const states=['normal','hover','pressed','secondary','secondary-hover','disabled'];
const cellWidth=meta.width/3,cellHeight=meta.height/2;
const hash=data=>createHash('sha256').update(data).digest('hex');
function alphaBounds(data,width,height){
 let left=width,top=height,right=0,bottom=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>16){
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
 }
 if(!right||!bottom)throw Error('A Gondor button cell is empty.');
 return {left,top,width:right-left,height:bottom-top};
}
const cells=[];
for(let index=0;index<states.length;index++){
 const cell={left:index%3*cellWidth,top:Math.floor(index/3)*cellHeight,width:cellWidth,height:cellHeight};
 const raw=await sharp(bytes).extract(cell).ensureAlpha().raw().toBuffer();
 cells.push({cell,bounds:alphaBounds(raw,cellWidth,cellHeight)});
}
// All states share one crop footprint and scale. Their individual placements
// in the generated cells may vary, but hover/press never changes CSS geometry.
const cropWidth=Math.max(...cells.map(({bounds})=>bounds.width))+8;
const cropHeight=Math.max(...cells.map(({bounds})=>bounds.height))+8;
const manifest={theme:'gondor',source:{path:'design/switchable-themes/gondor/button-states.png',prompt:'design/switchable-themes/gondor/button-states.prompt.json',tool:'Built-in imagegen',width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha,sha256:hash(bytes)},atlas:{columns:3,rows:2,states,alphaThreshold:16,edgeMargin:4},output:{width:600,lossless:true,cssSlice:[40,90]},assets:{}};
await mkdir(out,{recursive:true});
for(let index=0;index<states.length;index++){
 const {cell,bounds}=cells[index];
 const crop={left:cell.left+Math.round(bounds.left+(bounds.width-cropWidth)/2),top:cell.top+Math.round(bounds.top+(bounds.height-cropHeight)/2),width:cropWidth,height:cropHeight};
 if(crop.left<cell.left||crop.top<cell.top||crop.left+crop.width>cell.left+cell.width||crop.top+crop.height>cell.top+cell.height)throw Error('Button crop crosses its atlas cell.');
 const data=await sharp(bytes).extract(crop).resize({width:600}).webp({lossless:true,effort:6}).toBuffer();
 const name='button-'+states[index]+'.webp',outputMeta=await sharp(data).metadata(),stats=await sharp(data).stats();
 if(!outputMeta.hasAlpha||stats.channels[3].min!==0)throw Error('Gondor button transparency was lost.');
 await writeFile(resolve(out,name),data);
 manifest.assets[name]={sourceCell:cell,sourceCrop:crop,width:outputMeta.width,height:outputMeta.height,hasAlpha:outputMeta.hasAlpha,bytes:data.length,sha256:hash(data)};
}
await writeFile(resolve(out,'button-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Gondor: exported '+states.length+' alpha-preserving button states at width 600.');
