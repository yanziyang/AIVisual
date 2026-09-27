from pathlib import Path
import math,json
from PIL import Image,ImageDraw,ImageFont,ImageFilter
ROOT=Path(__file__).resolve().parent
W,H=1280,720
F={s:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',s) for s in [18,22,26,28,32,40,64,78]}
timeline=json.loads((ROOT/'timeline.json').read_text(encoding='utf-8'))
bounds={s:min(x['start'] for x in timeline if x['scene']==s)-1 for s in range(7)};bounds[0]=0
DURATION=113.53215419501133
source=(ROOT/'make_film.py').read_text(encoding='utf-8')
exec(source[source.index('BG=Image.open'):source.index("if '--preview'")])
sheet=Image.new('RGB',(1280,1440),(243,239,226))
for s in range(7):
 im=frame(bounds[s]+5)
 im.save(ROOT/f'check_{s}.jpg',quality=92)
 sheet.paste(im.resize((640,360)),((s%2)*640,(s//2)*360))
sheet.save(ROOT/'contact_sheet.jpg',quality=93)
print('CHECK_FRAMES_READY')
