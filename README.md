# ぬいぐるみモンスター

ブラウザで遊ぶ横スクロールのドット絵ゲームです。

## 固定公開URL（GitHub Pages）

リポジトリ: https://github.com/iroh06137-afk/nuigurumi-monster

Pages を有効にしたあと:

https://iroh06137-afk.github.io/nuigurumi-monster/

拡大: `?scale=6`　タイトル飛ばし: `?skiptitle`

### Pages の付け方（初回だけ）

1. このリポジトリの **Settings → Pages**
2. Source を **Deploy from a branch**
3. Branch を **main** / **/** (root) にして Save

数分で上のURLが開きます。以降はファイルを更新するだけで同じURLの中身が新しくなります。

## 手元で動かす

```bash
python3 -m http.server 8000
```

http://localhost:8000/

操作: ←→歩く / ジャンプ / Cいれかえ / バトルは1〜4 / Mで音オフ
