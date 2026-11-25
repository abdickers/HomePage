/* Deterministic export of the approved POC's decorative sidebar regions.
   No navigation labels, data cards or functional controls are used as art. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

export async function exportPocSidebar({root,sharp,save}) {
  const path='design/steampunk-gothic-victorian/dashboard-poc.png';
  const bytes=await readFile(resolve(root,path));
  const meta=await sharp(bytes).metadata();
  if(meta.width!==819||meta.height!==1920)throw Error('Approved POC dimensions changed; recheck source regions.');
  const regions={
    'sidebar-brand-v3':{left:0,top:0,width:152,height:326},
    'sidebar-cabinet-v3':{left:0,top:742,width:152,height:1178},
    'sidebar-rail-left-v3':{left:0,top:758,width:8,height:40},
    'sidebar-rail-right-v3':{left:144,top:758,width:8,height:40},
    'sidebar-wheel-large-v3':{left:15,top:1389,width:72,height:72},
    'sidebar-wheel-small-v3':{left:54,top:1455,width:50,height:50},
    'sidebar-clock-foreground-v3':{left:0,top:1350,width:152,height:70}
  };
  for(const [name,crop] of Object.entries(regions)) {
    let art=sharp(bytes).extract(crop).ensureAlpha();
    if(name.includes('-wheel-')) {
      const r=crop.width/2;
      const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${crop.width}" height="${crop.height}"><circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`);
      const isolated=await art.composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
      art=sharp(isolated);
    }
    await save(name,art.resize({width:crop.width*3}),{crop,source:'approved-poc-sidebar'});
  }
  return {
    source:{path,sha256:createHash('sha256').update(bytes).digest('hex'),width:meta.width,height:meta.height},
    sidebarWidth:152,sourceHeight:1920,brandHeight:326,cabinetStart:742,cabinetHeight:1178,
    regions,method:'Exact decorative crops and circular wheel sprite masks; no generative reinterpretation.'
  };
}
