"""Prepare the supplied artwork without modifying the original PNGs.

Requires Pillow. Crop coordinates were chosen after visual inspection; this is
deliberately not an equal-cell atlas splitter or a dark-pixel background remover.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/redesign/originals'
OUTPUT = ROOT / 'assets/redesign'
records = []
ONLY = set(sys.argv[1:])


def save(image, name, source, crop=None, **extra):
    if ONLY and name not in ONLY:
        return image
    target = OUTPUT / (name + '.webp')
    image.save(target, 'WEBP', quality=88, method=6, exact=True)
    decoded = Image.open(target).convert('RGBA')
    assert ImageChops.difference(image.getchannel('A'), decoded.getchannel('A')).getbbox() is None
    records.append(dict(file=target.relative_to(ROOT).as_posix(), width=image.width,
                        height=image.height, source=source, crop=crop,
                        bytes=target.stat().st_size, alpha_preserved=True, **extra))
    return image


def original(name):
    return Image.open(SOURCE / (name + '.png')).convert('RGBA')


for entry in json.loads((ROOT / 'design/asset-pack/asset-manifest.json').read_text()):
    source = SOURCE / Path(entry['file']).name
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['sha256']
    assert original(source.stem).size == (entry['width'], entry['height'])

# Keep whole figures proportional. Transparent halos remain intact.
for name in ['hobbit-bag-end-door', 'gondor-white-tree-crest', 'wow-alliance-portrait-frame']:
    im = original(name)
    if name == 'hobbit-bag-end-door':
        im.thumbnail((600, 600), Image.Resampling.LANCZOS)
    if name == 'gondor-white-tree-crest':
        im.thumbnail((256, 384), Image.Resampling.LANCZOS)
    save(im, name, name + '.png')

# The authentic character has transparent margins; preserve every nonzero-alpha
# source pixel and include a 16px safety margin around the measured bounds.
frear = original('frear-armory')
x0, y0, x1, y1 = frear.getchannel('A').getbbox()
bounds = (max(0, x0-16), max(0, y0-16), min(frear.width, x1+16), min(frear.height, y1+16))
save(frear.crop(bounds), 'frear-armory-trimmed', 'frear-armory.png', bounds)


def repeat_patch(patch, width, height):
    result = Image.new('RGBA', (width, height))
    for y in range(0, height, patch.height):
        for x in range(0, width, patch.width):
            result.paste(patch, (x, y))
    return result


def frame_sheet(name, corner, top, bottom, left, right):
    """Nine-slice source with quiet repeated rails and untouched square corners.

    A normal nine-slice of the supplied files would stretch center leaves,
    gemstones and hammers. Move those into optional fixed ornaments instead.
    """
    im = original(name)
    c = corner
    sheet = Image.new('RGBA', (c*3, c*3))
    for box, xy in [((0, 0, c, c), (0, 0)), ((im.width-c, 0, im.width, c), (c*2, 0)),
                    ((0, im.height-c, c, im.height), (0, c*2)),
                    ((im.width-c, im.height-c, im.width, im.height), (c*2, c*2))]:
        sheet.paste(im.crop(box), xy)
    for box, xy in [(top, (c, 0)), (bottom, (c, c*2)), (left, (0, c)), (right, (c*2, c))]:
        sheet.paste(repeat_patch(im.crop(box), c, c), xy)
    save(sheet, name + '-nine-slice', name + '.png', slice=corner,
         quiet_rails=dict(top=top, bottom=bottom, left=left, right=right))


frame_sheet('elven-panel-frame', 360, (400, 0, 600, 360), (400, 664, 600, 1024),
            (0, 360, 360, 412), (1176, 360, 1536, 412))
frame_sheet('dwarven-vault-frame', 320, (340, 0, 450, 320), (340, 934, 450, 1254),
            (0, 340, 320, 475), (934, 340, 1254, 475))
vault = original('dwarven-vault-frame')
save(vault.crop((492, 6, 772, 213)), 'dwarven-vault-gem', 'dwarven-vault-frame.png', (492, 6, 772, 213))

# Scroll end caps retain their native aspect ratio. The flexible center uses a
# quiet paper strip. Reflecting the clean roller avoids a cut-off feather or a
# large opaque bottom crop laid over live controls.
scroll = original('ravens-email-scroll')
for name, box in [('ravens-scroll-top', (0, 12, 1223, 188)),
                  ('ravens-scroll-middle', (0, 430, 1223, 558)),
                  ('ravens-roller-left', (0, 12, 180, 188)),
                  ('ravens-roller-center', (300, 12, 420, 188)),
                  ('ravens-roller-right', (1043, 12, 1223, 188)),
                  ('ravens-paper-left', (100, 430, 260, 558)),
                  ('ravens-paper-center', (320, 430, 576, 558)),
                  ('ravens-paper-right', (960, 430, 1120, 558))]:
    save(scroll.crop(box), name, 'ravens-email-scroll.png', box)
save(scroll.crop((0, 12, 1223, 188)).transpose(Image.Transpose.FLIP_TOP_BOTTOM),
     'ravens-scroll-bottom', 'ravens-email-scroll.png', (0, 12, 1223, 188),
     transform='vertical reflection of clean top roller; no sliced-off quill')

# Irregular measured bounds, not 4x3 equal cells. The provisions/shield and
# news/weather pairs have close silhouettes; inspect the generated contact sheet.
atlas = original('section-icon-atlas')
icons = {
    'calendar': (20, 51, 309, 435), 'raven': (316, 49, 629, 419),
    'bag-end': (627, 93, 941, 433), 'hearth': (941, 100, 1254, 433),
    'provisions': (4, 481, 333, 808), 'war-room': (313, 441, 647, 818),
    'treasury': (648, 456, 958, 814), 'ai-orb': (960, 463, 1254, 813),
    'news': (0, 854, 314, 1214), 'weather': (307, 831, 645, 1200),
    'wisdom': (628, 826, 976, 1216), 'key': (982, 834, 1254, 1201),
}
for name, box in icons.items():
    cropped = atlas.crop(box)
    polygons = {
        'war-room': [(313,441),(647,441),(647,818),(337,818),(337,550),(313,520)],
        'weather': [(307,831),(627,831),(627,1015),(645,1015),(645,1200),(307,1200)],
        'wisdom': [(628,826),(976,826),(976,1216),(656,1216),(656,1120),(644,1030),(628,1010)],
    }
    polygon = polygons.get(name)
    if polygon:
        mask = Image.new('L', cropped.size)
        ImageDraw.Draw(mask).polygon([(x-box[0], y-box[1]) for x,y in polygon], fill=255)
        cropped.putalpha(ImageChops.multiply(cropped.getchannel('A'), mask))
    save(cropped, 'icon-' + name, 'section-icon-atlas.png', box, isolation_polygon=polygon)

manifest = OUTPUT / 'derivative-manifest.json'
if ONLY and manifest.exists():
    replaced = {r['file'] for r in records}
    records = [r for r in json.loads(manifest.read_text()) if r['file'] not in replaced] + records
manifest.write_text(json.dumps(records, indent=2) + '\n')
sheet = Image.new('RGB', (1200, 840), '#111c17')
draw = ImageDraw.Draw(sheet)
for index, name in enumerate(icons):
    im = Image.open(OUTPUT / ('icon-' + name + '.webp')).convert('RGBA')
    im.thumbnail((210, 210), Image.Resampling.LANCZOS)
    x, y = index % 4 * 300, index // 4 * 280
    draw.text((x+16, y+10), name, fill='#f3e8cf')
    sheet.paste(im, (x+(300-im.width)//2, y+42), im)
sheet.save(ROOT / 'qa/redesign-icon-crops.png')
print(f'Prepared {len(records)} derivatives; alpha preserved; original hashes verified.')
