import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cssFiles=['switchable-themes.css','gondor-theme.css','theme-craft.css','theme-home-craft.css','theme-sidebars.css','dark-realms.css','warcraft-controls.css','continuous-materials.css','steampunk-theme.css','steampunk-sidebar.css'];
const references=new Set();
for(const file of cssFiles){
 const css=await readFile(resolve(root,'css',file),'utf8');
 for(const [,url] of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) references.add(resolve(root,'css',url));
}
const icons=['calendar','home','provisions','raven','orb','news','tools','compass','weather','camera','refresh','settings'];
for(const theme of ['hobbit','dwarven','gondor','mordor','one-ring','steampunk']){
 for(const icon of icons) references.add(resolve(root,`assets/themes/${theme}/icon-${icon}.${theme==='gondor'&&['refresh','settings'].includes(icon)?'svg':'webp'}`));
 references.add(resolve(root,`assets/themes/${theme}/scroll.webp`));
}
for(const theme of ['gondor','elven','mordor','one-ring','steampunk']) for(const icon of ['overview','home','provisions','warroom','treasury','settings']) references.add(resolve(root,`assets/themes/${theme}/sidebar-icon-${icon}.webp`));
// These two realms are complete families, including source-selected footer art
// and responsive imagery that may not be chosen by the current QA viewport.
const darkFamily=['header-2172','header-1100','background-1672','background-960','texture',
 ...['tl','tr','bl','br','top','bottom','left','right'].map(part=>'frame-'+part),
 'sidebar-top','sidebar-fill','sidebar-bottom','sidebar-crest','footer-emblem','scroll',
 ...['normal','hover','pressed','secondary','secondary-hover','disabled'].map(state=>'button-'+state),
 ...['idle','heat','cool'].map(state=>'hearth-'+state)];
for(const theme of ['mordor','one-ring','steampunk']) for(const name of darkFamily) references.add(resolve(root,`assets/themes/${theme}/${name}.webp`));
references.add(resolve(root,'assets/warcraft/alliance-lion-crest.webp'));
references.add(resolve(root,'assets/warcraft/alliance-paladin-seal.webp'));
for(const state of ['normal','hover','pressed','secondary','secondary-hover','disabled']) references.add(resolve(root,`assets/themes/gondor/button-${state}.webp`));
let bytes=0;
for(const file of references){
 const info=await stat(file);if(!info.isFile()||!info.size)throw Error('Missing theme asset: '+file);
 const data=await readFile(file);
 if(file.endsWith('.webp')&&(data.length<16||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP'))throw Error('Invalid WebP theme asset: '+file);
 if(file.endsWith('.svg')&&!/<svg\b/.test(data.toString('utf8')))throw Error('Invalid SVG theme asset: '+file);
 bytes+=info.size;
}
console.log(`${references.size} referenced theme files verified (${(bytes/1048576).toFixed(2)} MB).`);
