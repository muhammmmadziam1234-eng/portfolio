"""Render every STEP-th frame of the lamp's 'Articulation study' scene. Run through bpy_run.py: <script> -- OUTDIR [STEP]"""
import sys, bpy
args = sys.argv[sys.argv.index("--") + 1:]
out, step = args[0], int(args[1]) if len(args) > 1 else 4
scene = bpy.data.scenes["Articulation study"]
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 800, 650, 100
scene.render.threads_mode, scene.render.threads = "FIXED", 3
scene.render.image_settings.file_format, scene.render.image_settings.quality = "JPEG", 88
frames = sorted(set(range(1, scene.frame_end + 1, step)) | {44, 64, 84, scene.frame_end})
for i, frame in enumerate(frames):
    scene.frame_set(frame)
    scene.render.filepath = f"{out}/pose-{i:02d}.jpg"
    bpy.ops.render.render(scene=scene.name, write_still=True)
    print(f"rendered {i + 1}/{len(frames)} (frame {frame})", flush=True)
print("frames:", frames, "camera:", scene.camera.name if scene.camera else None, flush=True)
