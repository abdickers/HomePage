"""Reproducible, visually measured crops for the second supplied art pack.

No source pixels are recolored or keyed out. PNG originals stay byte-identical.
Pillow is required only to rebuild delivery assets, not to run the dashboard.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/expansion/originals'
OUT = ROOT / 'assets/expansion'
records = []

for a in json.loads((ROOT / 'design/expansion-pack/asset-manifest.json').read_text()):
    p = SOURCE / Path(a['file']).name
    assert hashlib.sha256(p.read_bytes()).hexdigest() == a['sha256']
    assert Image.open(p).size == (a['width'], a['height'])

def save(source, name, box=None, width=None):
    im = Image.open(SOURCE / (source + '.png')).convert('RGBA')
    if box:
        im = im.crop(box)
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
    p = OUT / (name + '.webp')
    im.save(p, 'WEBP', quality=88, method=6, exact=True)
    assert not ImageChops.difference(im.getchannel('A'), Image.open(p).convert('RGBA').getchannel('A')).getbbox()
    records.append(dict(file=p.relative_to(ROOT).as_posix(), source=source+'.png', crop=box,
                        width=im.width, height=im.height, bytes=p.stat().st_size, alpha_preserved=True))

for name, width in [('treasury-hidden-mine-door', 960), ('lonely-mountain-treasury', 1916),
                    ('bree-prancing-pony-news-board', 1672)]:
    save(name, name, width=width)
save('treasury-hidden-mine-door', 'treasury-hidden-mine-door-small', width=480)
save('bree-prancing-pony-news-board', 'bree-prancing-pony-news-board-small', width=768)
save('bree-prancing-pony-news-board', 'bree-board-quiet-wood', (600,300,1100,600), width=500)
save('bree-prancing-pony-news-board', 'bree-board-bottom-rail', (0,780,1672,941))
for name in ['hobbit-heating-fireplace', 'hobbit-cooling-open-window']:
    # Keep every nonzero-alpha pixel and the source's lighting halo.
    save(name, name, width=288)
    save(name, name+'-small', width=192)

# Rectangles were reviewed on the actual irregular atlas. The old round window
# is only a small climate heading icon; it is never the COOL mode illustration.
icons = {'fireplace': (8, 21, 521, 508), 'gate': (530, 62, 1045, 506),
         'lantern': (1104, 21, 1520, 515), 'key': (18, 526, 514, 998),
         'window': (539, 518, 1025, 991), 'basket': (1027, 522, 1520, 990)}
for name, box in icons.items():
    for width in [128, 64]:
        save('hobbit-home-icon-atlas', 'hobbit-icon-'+name+'-'+str(width), box, width)

# Irregular fixed corner rectangles preserve the tall top-left ivy and the
# hanging lantern. Quiet oak strips repeat between them; no carved leaf,
# mushroom, flower, or lantern is stretched to fit the panel.
frame = {'top-left': (0,0,340,470), 'top-right': (1332,0,1672,300),
         'bottom-left': (0,691,340,941), 'bottom-right': (1332,581,1672,941),
         'top': (400,0,600,130), 'bottom': (400,800,600,941),
         'left': (0,580,170,640), 'right': (1490,280,1672,330)}
for part, box in frame.items():
    save('hobbit-oak-ivy-frame', 'hobbit-oak-'+part, box)

(OUT / 'derivative-manifest.json').write_text(json.dumps(records, indent=2)+'\n')
sheet = Image.new('RGB', (1000, 680), '#122118')
draw = ImageDraw.Draw(sheet)
for i, name in enumerate(icons):
    im = Image.open(OUT / ('hobbit-icon-'+name+'-128.webp')).convert('RGBA')
    x=(i%3)*330+95; y=(i//3)*330+75
    sheet.paste(im, (x,y), im)
    draw.text((x,y+145), name, fill='#f1e6d1')
sheet.save(ROOT / 'qa/expansion-icon-crops.png')
print(f'{len(records)} delivery assets, {sum(r["bytes"] for r in records):,} bytes')
