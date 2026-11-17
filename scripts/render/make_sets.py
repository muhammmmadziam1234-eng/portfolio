"""Build the sensor picture files the site loads from the renders of render_explode.py. Needs Pillow.

  python make_sets.py HI_DIR OUT_DIR [BETWEEN_DIR]

HI_DIR holds the 40 renders at 1680 x 1068 (explode-NN.webp). BETWEEN_DIR, if given, holds the 39 renders halfway between them
(explode-NNb.webp). OUT_DIR is assets/media/cirrus-explode. It receives:

  hi/explode-NN.webp           the 40 large pictures, copied as rendered. The page shows these when the sensor is at rest.
  explode-NN.webp, -NNb.webp   the standard pictures (1120 x 712) the canvas moves between: the same renders shrunk by 1.5 with a Lanczos
                               filter. That is sharper at the same file size than rendering at 1120 (a render's own pixel filter is soft).

Nothing is drawn or painted over: every picture is a render, or a render shrunk."""
import os, shutil, sys
from PIL import Image

hi_dir, out = sys.argv[1], sys.argv[2]
between_dir = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(os.path.join(out, "hi"), exist_ok=True)


def shrink(src, dst):
    with Image.open(src) as im:
        im.convert("RGB").resize((1120, 712), Image.LANCZOS).save(dst, "WEBP", quality=82, method=6)


count = 0
for name in sorted(os.listdir(hi_dir)):
    if name.startswith("explode-") and name.endswith(".webp"):
        shutil.copyfile(os.path.join(hi_dir, name), os.path.join(out, "hi", name))
        shrink(os.path.join(hi_dir, name), os.path.join(out, name))
        count += 1
extra = 0
if between_dir:
    for name in sorted(os.listdir(between_dir)):
        if name.startswith("explode-") and name.endswith("b.webp"):
            shrink(os.path.join(between_dir, name), os.path.join(out, name))
            extra += 1
print(f"{count} large pictures in {out}/hi, {count} standard pictures and {extra} in-between pictures in {out}")
