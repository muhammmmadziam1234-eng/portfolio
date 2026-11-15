"""Run a Blender script with the bpy module the way `blender --background [FILE|--factory-startup] --python SCRIPT -- ARGS` would.
Usage: python bpy_run.py <file.blend | --factory> <script.py> [script args...]"""
import os, runpy, sys, time
import bpy
blend, script, *rest = sys.argv[1:]
if blend == "--factory":
    bpy.ops.wm.read_factory_settings(use_empty=False)
else:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(blend))
sys.argv = ["blender", "--background", "--python", script] + (["--"] + rest if rest else [])
start = time.time()
try:
    runpy.run_path(script, run_name="__main__")
finally:
    print(f"[bpy_run] Blender {bpy.app.version_string} | {script} {' '.join(rest)} | {time.time()-start:.1f}s", flush=True)
