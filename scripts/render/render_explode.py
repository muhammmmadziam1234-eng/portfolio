"""Render the Cirrus explode sequence with the saved exploded camera. Run through bpy_run.py: <script> -- OUTDIR [N]"""
import sys, bpy
args = sys.argv[sys.argv.index("--") + 1:]
out, n = args[0], int(args[1]) if len(args) > 1 else 14
scene = bpy.context.scene
scene.camera = bpy.data.objects["Camera · 02 Exploded"]
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1120, 712, 100
scene.render.threads_mode, scene.render.threads = "FIXED", 3
scene.cycles.samples, scene.cycles.adaptive_min_samples = 24, 8
scene.render.image_settings.file_format, scene.render.image_settings.quality = "JPEG", 88
root = bpy.data.objects["Cirrus | Explode control"]
for i in range(n):
    root["Explode"] = i / (n - 1)
    bpy.context.view_layer.update()
    scene.render.filepath = f"{out}/explode-{i:02d}.jpg"
    bpy.ops.render.render(write_still=True)
    print(f"rendered {i + 1}/{n} at Explode={root['Explode']:.3f}", flush=True)
