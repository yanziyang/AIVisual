# J-36 — reference-based exterior model

Created locally with **Blender 3.6.23**.

## Open

Open `J36_Reference_Model.blend` in Blender. The aircraft is arranged into named collections for the airframe, cockpit, intakes/exhausts, surface details, and landing gear. The studio and cameras are separate. Both supplied reference images are packed into the file in the hidden reference collection.

The active camera is the front three-quarter view. The other named cameras provide top, rear, underside and front views. Press Numpad 0 to enter the active camera; F12 renders it. Studio helpers are hidden in the editing viewport but remain enabled for rendering.

## Included

- Continuous, closed, symmetric cranked-delta airframe mesh.
- Broad smoked cockpit glazing with frame and seals.
- Conformal dorsal scoop, recessed side-intake mouths and three exhausts with individual petals.
- Leading-edge coating, panel seams, access covers, three elevons per wing and actuator fairings.
- Closed ventral door outlines.
- Twin nose wheels, tandem main wheels, struts, braces, hydraulic lines and gear doors.
- Subtle prototype markings and optical apertures.
- Four full-aircraft PNG renders in `renders`.
- A reproducible Blender Python construction script, `build_j36.py`.

## Reference fidelity

The supplied illustrated plan, front and side views guide proportions. The supplied underside image guides the visible lower surfaces and landing-gear arrangement. Four build-and-review passes refined the coating, outline, intake integration, canopy proportions and camera framing. Earlier front-view renders remain in `renders/iterations` for comparison.

This is an exterior visual reconstruction. The illustration is not a calibrated technical drawing, and the two images do not establish all hidden shapes or real dimensions. The model uses a nominal span of 23.2 m and a length of approximately 26 m solely to establish a convenient working scale. Materials, minor panel details, markings and unseen surfaces include interpretation. No measurable claim of 99% resemblance or technical accuracy is made.

The gear is modeled deployed, with closed ventral doors. Components are editable objects, but no retracting-gear animation or flight rig is included.

## Rebuild

From this folder in PowerShell:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 3.6\blender.exe' --background --python '.\build_j36.py' -- all
```

Keep the original `J-36 Stealth Bomber images` folder one level above this folder when rebuilding. The saved `.blend` itself is self-contained.
