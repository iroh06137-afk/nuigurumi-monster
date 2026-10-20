#!/usr/bin/env python3
"""Embed every 16x16 PNG in assets/icons16/ (menu_* hub icons, mini_<id> plush minis) into assets-img.js. Idempotent."""
import base64, glob, os, re, sys
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
js_path = os.path.join(root, 'assets-img.js')
js = open(js_path).read()
tail = js.index('(function(){')
head = re.sub(r"ASSET_DATA\['assets/icons16/[^']+'\] = '[^']*';\n", '', js[:tail])
add = ''
for f in sorted(glob.glob(os.path.join(root, 'assets/icons16/*.png'))):
    im = Image.open(f)
    if im.size != (16, 16) or 'A' not in im.convert('RGBA').getbands() or im.convert('RGBA').getextrema()[3][0] != 0:
        sys.exit(f'{f}: must be 16x16 with transparency (got {im.size} {im.mode})')
    rel = os.path.relpath(f, root).replace(os.sep, '/')
    add += f"ASSET_DATA['{rel}'] = 'b64png:{base64.b64encode(open(f, 'rb').read()).decode()}';\n"
    print('embedded', rel)
open(js_path, 'w').write(head + add + js[tail:])
