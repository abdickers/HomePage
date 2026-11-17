import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cssFiles=['switchable-themes.css','gondor-theme.css','theme-craft.css','theme-home-craft.css','theme-sidebars.css'];
const references=new Set();
for(const file of cssFiles){
 const css=await readFile(resolve(root,'css',file),'utf8');
 for(const [,url] of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) references.add(resolve(root,'css',url));
}
const icons=['calendar','home','provisions','raven','orb','news','tools','compass','weather','camera','refresh','settings'];
for(const theme of ['hobbit','dwarven','gondor']){
 for(const icon of icons) references.add(resolve(root,`assets/themes/${theme}/icon-${icon}.${theme==='gondor'&&['refresh','settings'].includes(icon)?'svg':'webp'}`));
 references.add(resolve(root,`assets/themes/${theme}/scroll.webp`));
}
for(const theme of ['gondor','elven']) for(const icon of ['overview','home','provisions','warroom','treasury','settings']) references.add(resolve(root,`assets/themes/${theme}/sidebar-icon-${icon}.webp`));
let bytes=0;
for(const file of references){const info=await stat(file);if(!info.isFile()||!info.size)throw Error('Missing theme asset: '+file);bytes+=info.size;}
console.log(`${references.size} referenced theme files verified (${(bytes/1048576).toFixed(2)} MB).`);
