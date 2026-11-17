"""Render the Cirrus explode sequence for the site's slider.

The camera starts on the saved hero view and moves to the saved exploded view only as fast as the parts need, so the
sensor fills the picture at every step instead of starting small. Every frame is rendered from the project's own
Blender file with its explode control set to that position.

Run through bpy_run.py:  python bpy_run.py cirrus.blend render_explode.py OUTDIR [N] [PERCENT] [between]
  N frames (default 40). PERCENT of the 1120 x 712 base size (default 150, so 1680 x 1068: the high-resolution set; use 50 for a quick
  preview). The denoiser is on, so 32 samples are enough at this size.
  "between" renders the N - 1 frames halfway between each pair (explode-00b.webp is halfway between explode-00 and explode-01), on the
  same camera path, so they are true renders that sit exactly between the first set's. The page uses them for smoother motion.
  scripts/render/make_sets.py then builds the files the site loads from the two folders."""
import os, sys, bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
out, n = args[0], int(args[1]) if len(args) > 1 else 40
percent = int(args[2]) if len(args) > 2 else 150
between = len(args) > 3 and args[3] == "between"
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1120, 712, percent
scene.render.threads_mode, scene.render.threads = "FIXED", max(1, os.cpu_count() or 1)
scene.cycles.samples, scene.cycles.adaptive_min_samples = 32, 8
scene.render.image_settings.file_format, scene.render.image_settings.quality = "WEBP", 80

hero, wide = bpy.data.objects["Camera · 01 Hero"], bpy.data.objects["Camera · 02 Exploded"]
cam = bpy.data.objects.new("Camera · explode move", wide.data.copy())
scene.collection.objects.link(cam)
scene.camera = cam

root = bpy.data.objects["Cirrus | Explode control"]
moving = [ob for ob in bpy.data.objects if ob.animation_data and ob.animation_data.drivers]
parts = {child for ob in moving for child in [ob, *ob.children_recursive] if child.type == "MESH"}

# The face bounce card stands just in front of the sensor. As the cover explodes forward it passes through the card's
# plane, and an area light only shines forwards, so the cover went dark behind a hard diagonal edge. Move the card back
# along its own axis, out of the cover's way. Its power stays as saved: raising it washed out the lettering on the face.
card = bpy.data.objects["Studio | face bounce card"]
card.location = card.location + card.matrix_world.to_quaternion() @ Vector((0, 0, 9))


def explode(value):
    root["Explode"] = value
    root.update_tag()
    scene.frame_set(scene.frame_current)


def place(s):
    """Camera at fraction s of the way from the hero view (0) to the exploded view (1)."""
    loc = hero.matrix_world.translation.lerp(wide.matrix_world.translation, s)
    rot = hero.matrix_world.to_quaternion().slerp(wide.matrix_world.to_quaternion(), s)
    cam.matrix_world = Matrix.LocRotScale(loc, rot, Vector((1, 1, 1)))
    cam.data.ortho_scale = hero.data.ortho_scale + (wide.data.ortho_scale - hero.data.ortho_scale) * s
    bpy.context.view_layer.update()


def fits(margin_x=0.04, margin_y=0.06):
    deps = bpy.context.evaluated_depsgraph_get()
    for ob in parts:
        ev = ob.evaluated_get(deps)
        for corner in ev.bound_box:
            p = world_to_camera_view(scene, cam, ev.matrix_world @ Vector(corner))
            if not (margin_x <= p.x <= 1 - margin_x and margin_y <= p.y <= 1 - margin_y):
                return False
    return True


# 1. For each frame, the closest camera position that still shows every part.
need = []
for i in range(n):
    explode(i / (n - 1))
    lo, hi = 0.0, 1.0
    place(lo)
    if not fits():
        for _ in range(16):
            mid = (lo + hi) / 2
            place(mid)
            lo, hi = (lo, mid) if fits() else (mid, hi)
        lo = hi
    need.append(lo)

# 2. Never move back towards the hero view, and smooth the move without ever cutting a part off.
path, top = [], 0.0
for s in need:
    top = max(top, s)
    path.append(top)
smooth = [sum(path[max(0, i - 3):i + 4]) / len(path[max(0, i - 3):i + 4]) for i in range(n)]
path, top = [], 0.0
for s, required in zip(smooth, need):
    top = max(top, s, required)
    path.append(top)
print("camera path:", " ".join(f"{s:.2f}" for s in path), flush=True)

# 3. Render. The frames halfway between two positions use the explode value and the camera halfway between theirs.
jobs = ([((i + 0.5) / (n - 1), (path[i] + path[i + 1]) / 2, f"{out}/explode-{i:02d}b.webp") for i in range(n - 1)] if between
        else [(i / (n - 1), path[i], f"{out}/explode-{i:02d}.webp") for i in range(n)])
for k, (value, cam_at, filepath) in enumerate(jobs):
    explode(value)
    place(cam_at)
    scene.render.filepath = filepath
    bpy.ops.render.render(write_still=True)
    print(f"rendered {k + 1}/{len(jobs)} at Explode={root['Explode']:.3f}, camera {cam_at:.2f}", flush=True)
