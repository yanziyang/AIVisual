from pathlib import Path
from PIL import Image, ImageDraw
import subprocess,sys
root=Path(__file__).resolve().parent.parent
ns={'__file__':str(root/'scripts'/'render_professional_animation.py')}
source=(root/'scripts'/'render_professional_animation.py').read_text(encoding='utf-8')
source=source.replace('def globe(d,cx,cy,r,t,belts=False,shift=0):','def globe(d,cx,cy,r,t,belts=False,shift=0,south=True):')
source=source.replace("txt(d,cx,cy+r+35,'S',22,MUTED,'mm')","\n if south:txt(d,cx,cy+r+35,'S',22,MUTED,'mm')")
source=source.replace('globe(d,1130,554,275,t)','globe(d,1130,554,275,t,south=False)')
(root/'scripts'/'render_professional_animation.py').write_text(source,encoding='utf-8')
exec(source.split("if '--preview' in sys.argv:")[0],ns)
patch=Image.new('RGBA',(1920,1080),(0,0,0,0))
bg=ns['BG'].crop((810,838,1490,920)).convert('RGBA')
patch.paste(bg,(810,838))
d=ImageDraw.Draw(patch)
ns['txt'](d,1130,871,'低纬受热多 · 高纬受热少',32,ns['INK'],'mm',True)
image=root/'professional_animation/heat_label_fix.png'
patch.save(image)
ff=ns['FF'];video=root/'atmospheric_circulation_studio.mp4'
fixed=root/'atmospheric_circulation_studio_fixed.mp4'
subprocess.run([ff,'-y','-v','error','-i',str(video),'-i',str(image),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='between(t,9.496,18.856)'[v]",'-map','[v]','-map','0:a','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(fixed)],check=True)
fixed.replace(video)
print('Label collision fixed.')
