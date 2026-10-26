# Temporary OGP card (1200x630) from game art. Replace og.png with the artist's final file any time (same name/size).
# Integer nearest-neighbour scaling only.
from PIL import Image
import os
R = os.path.join(os.path.dirname(__file__), '..')
A = lambda p: Image.open(os.path.join(R, 'assets', p)).convert('RGBA')
up = lambda im, k: im.resize((im.width * k, im.height * k), Image.NEAREST)
W, H = 1200, 630
bg = up(A('opening/op_kingdom.png'), 7)                      # 2240x630
card = bg.crop(((bg.width - W) // 2, 0, (bg.width - W) // 2 + W, H))
logo = up(A('opening/title_logo.png'), 7)                    # 567x266
card.alpha_composite(logo, ((W - logo.width) // 2, 26))
row = ['evo/goririn.png', 'kitsunen.png', 'evo/fukuron.png', 'usagin.png', 'evo/kaerun.png', 'tsumaguro.png']
k = 5; n = len(row); gap = 16; tw = n * 32 * k + (n - 1) * gap
for i, p in enumerate(row):
    im = A(p); im = im.crop((0, 0, 32, 32))                  # first frame of a strip
    card.alpha_composite(up(im, k), ((W - tw) // 2 + i * (32 * k + gap), H - 32 * k - 22))
card.convert('RGB').save(os.path.join(R, 'og.png'), optimize=True)
print('og.png', card.size)
