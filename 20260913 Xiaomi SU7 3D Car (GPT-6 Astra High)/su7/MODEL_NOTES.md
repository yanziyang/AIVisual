# Xiaomi SU7 Max — Aqua Blue

Photo-referenced exterior reconstruction created with the locally installed **Blender 3.6.23**.

## Files

- `Xiaomi_SU7_Max.blend`: native editable scene with organized vehicle collections, studio, six cameras, and all five supplied reference images packed into the file.
- `Xiaomi_SU7_Max.glb`: portable mesh/material export of the vehicle, excluding the studio and reference images. Procedural paint and tire shading are simplified by the glTF format; the native Blender scene is the visual master.
- `renders/`: final front and rear three-quarter views, side/front/rear inspection views, and a wheel close-up. The `draft_` images preserve the visual iterations.
- `build_su7.py`: complete procedural modeling source, using Blender's bundled Python and `bpy`.
- `finalize_su7.py`: production rendering, export, and scene audit.
- `scene_audit.json`: measured scene details and validation results.

## Reference and scope

The five press photos in the supplied `Xiaomi-su7-images` folder define the first-generation Aqua Blue SU7 Max appearance. Modeling cues include the fastback roof, teardrop front lamps, halo rear lamp, roof lidar, black panoramic glazing, flush handles, five split-spoke wheels, yellow brake calipers, side cameras, bumper air curtains, and black lower aerodynamic trim.

Nominal proportions: **4.997 m length, 1.963 m body width, 1.440 m roof height, 3.000 m wheelbase**. Mirrors are outside the body-width measurement. The scene uses metres. The car's front points along negative X; Z is up.

Dimension source: [Xiaomi's original SU7 parameter sheet](https://s1.xiaomiev.com/activity-outer-assets/0328/env/SU7%E5%8F%82%E6%95%B0%E9%85%8D%E7%BD%AE%E8%A1%A8328.pdf).

This is a photo-based reconstruction, not Xiaomi factory CAD or a laser scan. No objective 99% similarity measurement has been established. Small compound curves, optical internals, trim sections, hidden geometry, and interior details remain approximations. Doors are represented by exterior seams and handles; there is no opening-door rig or engineering-grade chassis.

## Visual iterations

1. Established the body proportions, wheelbase, arches, greenhouse, lighting signatures, wheel and brake assemblies, trim, and studio views.
2. Joined the body into a continuous surface; corrected side-window projections, panel seams, rear-seat clearance, materials, and camera height.
3. Rebuilt the headlamps using intersections with the actual body surface; refined the DRL paths, rear lettering placement, roof sensor, trim thicknesses, and studio reflections.

4. Refined absorptive glass tint, Aqua Blue paint, intake corner shapes, and camera framing.
5. Increased curved lens and glazing topology to fix intersections, rebuilt smooth roof rails, and corrected handle and shut-line locations.

6. Aligned the painted roof rails to the window perimeter and corrected the remaining front vent overlap.

7. Full-resolution inspection caught a wavy A-pillar trim projection; replaced it with a smooth surface-parameterized rail.

8. Registered the painted window frame directly to the smooth window seal to remove the remaining A-pillar alignment difference.

## Rebuild

Run from this workspace in PowerShell:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 3.6\blender.exe' --background --threads 4 --python '.\su7\build_su7.py' -- --no-render
& 'C:\Program Files\Blender Foundation\Blender 3.6\blender.exe' --background --threads 4 '.\su7\Xiaomi_SU7_Max.blend' --python '.\su7\finalize_su7.py'
```

Use `--draft` instead of `--no-render` on the first command to regenerate low-resolution review renders. The revision scripts document changes already incorporated into the modeling source; do not rerun them on the finished source.

The build and finalize scripts replace their own generated scene and render files. The supplied reference image files are read only.
