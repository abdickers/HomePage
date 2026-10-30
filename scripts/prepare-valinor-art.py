"""Export approved raster artwork without repainting it; keep all alpha channels."""
from pathlib import Path
from PIL import Image
import json

root=Path(__file__).resolve().parents[1]
src=root/'design/two-trees-high-elves'
dest=root/'assets/valinor'
dest.mkdir(parents=True,exist_ok=True)
manifest={}
def save(im,name,lossless=True):
    im.save(dest/(name+'.webp'),lossless=lossless,quality=85,method=6)
    manifest[name]={'size':im.size,'bytes':(dest/(name+'.webp')).stat().st_size}
for name,widths in [('header',[2172,1100]),('background',[1672,960])]:
    im=Image.open(src/(name+'.png')).convert('RGB')
    for w in widths:save(im.resize((w,round(im.height*w/im.width)),Image.Resampling.LANCZOS),name+'-'+str(w),False)
frame=Image.open(src/'panel-frame-v2.png').convert('RGBA')
boxes={'tl':(8,48,228,268),'tr':(1308,48,1528,268),'bl':(8,744,228,964),'br':(1308,744,1528,964),
       'top':(300,48,600,268),'bottom':(300,744,600,964),'left':(8,350,228,550),'right':(1308,350,1528,550),'crest':(700,48,835,160)}
for name,box in boxes.items():save(frame.crop(box),'frame-'+name)
rail=Image.open(src/'navigation-divider.png').convert('RGBA')
for name,box in {'top':(330,0,585,400),'shaft':(420,440,495,740),'bottom':(365,1310,550,1640)}.items():save(rail.crop(box),'rail-'+name)
icons=Image.open(src/'icons-atlas.png').convert('RGBA')
names=['calendar','home','provisions','raven','orb','news','tools','compass','weather','camera','refresh','settings']
def cell(im,box):
    tile=im.crop(box)
    bounds=tile.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
    if bounds:
        l,t,r,b=bounds;tile=tile.crop((max(0,l-4),max(0,t-4),min(tile.width,r+4),min(tile.height,b+4)))
    return tile
for i,name in enumerate(names):
    col,row=i%4,i//4
    tile=cell(icons,(col*362,row*362,(col+1)*362,(row+1)*362))
    tile.thumbnail((160,160),Image.Resampling.LANCZOS)
    save(tile,'icon-'+name)
buttons=Image.open(src/'buttons-atlas.png').convert('RGBA')
for i,name in enumerate(['normal','hover','pressed','secondary','secondary-hover','disabled']):
    col,row=i%3,i//3
    save(cell(buttons,(col*724,row*362,(col+1)*724,(row+1)*362)),'button-'+name)
if (src/'elven-scroll.png').exists():save(Image.open(src/'elven-scroll.png').convert('RGBA'),'elven-scroll',False)
if (src/'two-trees-emblem.png').exists():
    emblem=Image.open(src/'two-trees-emblem.png').convert('RGBA');emblem.thumbnail((160,160),Image.Resampling.LANCZOS);save(emblem,'two-trees-emblem')
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',len(manifest),'Valinor assets; source alpha retained.')
