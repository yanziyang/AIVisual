from pathlib import Path
p=Path(__file__).with_name('build_su7.py');s=p.read_text()
s=s.replace("VERSION = '05'","VERSION = '06'")
old="    curve('Painted continuous A pillar and roof rail',[canopy(lerp(-1.008,1.89,k/200),s*sample(CW,lerp(-1.008,1.89,k/200))*.775,.005) for k in range(201)],paint,.018)"
new="""    rail=[(-1.008,.95),(-.886,1.010),(-.660,1.164),(-.29,1.328),(-.035,1.376),(.35,1.375),(.69,1.318),(1.11,1.162),(1.58,1.046),(1.79,1.004)]
    curve('Painted continuous A pillar and roof rail',[winpoint(x,z,s,.010) for x,z in smooth_open_path(rail,32)],paint,.016)"""
s=s.replace(old,new)
s=s.replace("proj2=lambda y,z:front_surface(s*y,z,.007)","proj2=lambda y,z:front_surface(s*y,z,.022)")
p.write_text(s)
fp=p.with_name('finalize_su7.py');fp.write_text(fp.read_text().replace("'visual_iterations':5","'visual_iterations':6"))
np=p.with_name('MODEL_NOTES.md');np.write_text(np.read_text().replace('## Rebuild','6. Aligned the painted roof rails to the window perimeter and corrected the remaining front vent overlap.\n\n## Rebuild'))
print('Applied revision 06: final roof rail alignment and vent clearance.')
