#!/usr/bin/env python3
"""Embed (or refresh) the given PNGs (paths relative to the repo) into assets-img.js. Usage: tools/embed_assets.py assets/x.png ..."""
import base64, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(root, 'assets-img.js'); js = open(p).read(); tail = js.index('(function(){'); head = js[:tail]
for rel in sys.argv[1:]:
    head = re.sub(r"ASSET_DATA\['" + re.escape(rel) + r"'\] = '[^']*';\n", '', head)
    head += f"ASSET_DATA['{rel}'] = 'b64png:{base64.b64encode(open(os.path.join(root, rel), 'rb').read()).decode()}';\n"; print('embedded', rel)
open(p, 'w').write(head + js[tail:])
