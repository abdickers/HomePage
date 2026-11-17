// Run from any directory. Reuses the Work Command Center's approved artwork.
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(root,'website-refresh/assets/themes/gondor');
const royal='work-homepage-refresh/public/art/royal-gondor/';
const sources=[
 [royal+'royal-court-twilight-1600.webp','header.webp'],
 [royal+'white-city-daylight-960.webp','white-city-daylight.webp'],
 [royal+'icons/calendar-256.webp','icon-calendar.webp'],
 [royal+'icons/shield-256.webp','icon-home.webp'],
 [royal+'icons/treasury-256.webp','icon-provisions.webp'],
 ['work-homepage-refresh/public/art/polish/raven.webp','icon-raven.webp'],
 [royal+'icons/council-256.webp','icon-orb.webp'],
 [royal+'icons/notes-256.webp','icon-news.webp'],
 [royal+'icons/quest-256.webp','icon-tools.webp'],
 [royal+'icons/overview-256.webp','icon-compass.webp'],
 [royal+'icons/beacon-256.webp','icon-weather.webp'],
 [royal+'icons/shield-256.webp','icon-camera.webp'],
 ...['header-top-left','header-top-right','header-bottom-left','header-bottom-right','header-top','header-bottom','header-left','header-right','header-tree','header-diamond','page-rail-top','page-rail-shaft','page-rail-bottom'].map(name=>['work-homepage-refresh/public/art/gondor/'+name+'.webp',name+'.webp'])
];
await mkdir(output,{recursive:true});
const manifest={source:'Work Command Center; app/royal-gondor.css',files:{}};
for(const [source,name] of sources){
 await copyFile(resolve(root,source),resolve(output,name));
 const bytes=await readFile(resolve(output,name));
 manifest.files[name]={source,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
for(const name of ['refresh','settings']){
 const source='work-homepage-refresh/public/art/icons/'+name+'.svg';
 const bytes=(await readFile(resolve(root,source),'utf8')).replace('stroke="currentColor"','stroke="#b8c9d8"');
 await writeFile(resolve(output,'icon-'+name+'.svg'),bytes);
 manifest.files['icon-'+name+'.svg']={source,note:'Native Work vector, fixed silver stroke for external img rendering.'};
}
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared '+Object.keys(manifest.files).length+' Gondor assets from the Work Command Center.');
