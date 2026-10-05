# Fonts

| File | Face | Licence | Shipped |
|---|---|---|---|
| `Hellix-Bold.ttf` | Hellix Bold (main face, sheared to italic by the engine) | Commercial | **No**: bring your own licensed copy |
| `LibreBodoni-Italic.ttf` | Libre Bodoni Italic (variable, used at weight 430) | SIL OFL 1.1, see `OFL-LibreBodoni.txt` | Yes |
| `BigShouldersStencil.ttf` | Big Shoulders Stencil (variable, used at weight 900, opsz 72) | SIL OFL 1.1, see `OFL-BigShouldersStencil.txt` | Yes |

If you only have Hellix as `.woff2` (for example from a web project), convert it:

```sh
python3 -m pip install --user fonttools brotli
python3 -c "from fontTools.ttLib import TTFont; f = TTFont('Hellix-Bold.woff2'); f.flavor = None; f.save('Hellix-Bold.ttf')"
```

`reel.py` stops with a clear message while `Hellix-Bold.ttf` is missing.
