from pathlib import Path
import hashlib, base64, ast, html, json, shutil, sys

sys.stdout.reconfigure(encoding='utf-8')
root=Path(r'C:\MyProjects\TempProject (OpenAI)')
assert root.resolve()==root and root.is_dir()
renames={
 '一卷穿越五千年_线稿动画.mp4':'five-thousand-years-line-art-animation.mp4',
 '制作说明.txt':'work/production-notes.txt',
 'outputs/一卷穿越五千年_字幕.srt':'outputs/five-thousand-years-subtitles.srt',
 'outputs/一卷穿越五千年_封面.jpg':'outputs/five-thousand-years-cover.jpg',
}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
for old,new in renames.items():
    src,dst=root/old,root/new
    if src.exists() and dst.exists():raise RuntimeError(f'Destination already exists: {dst}')
    if not src.exists() and not dst.exists():raise RuntimeError(f'Missing source: {src}')
for old,new in renames.items():
    src,dst=root/old,root/new
    if src.exists():
        before=sha(src);src.rename(dst);assert sha(dst)==before
build=root/'work/build_film.py'
content=build.read_text(encoding='utf-8')
content=content.replace("OUT/'一卷穿越五千年_字幕.srt'", "OUT/'five-thousand-years-subtitles.srt'")
content=content.replace("OUT/'一卷穿越五千年_封面.jpg'", "OUT/'five-thousand-years-cover.jpg'")
content=content.replace("OUT/'一卷穿越五千年_线稿动画.mp4'", "ROOT/'five-thousand-years-line-art-animation.mp4'")
build.write_text(content,encoding='utf-8')
verify=root/'work/verify_film.py'
verify.write_text(verify.read_text(encoding='utf-8').replace("root/'outputs/一卷穿越五千年_线稿动画.mp4'", "root/'five-thousand-years-line-art-animation.mp4'"),encoding='utf-8')
ast.parse(content);ast.parse(verify.read_text(encoding='utf-8'))
tree=ast.parse(content)
scenes=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCENES' for t in n.targets))
rows=[];start=0
def clock(v):return f'{v//60:02d}:{v%60:02d}'
for i,s in enumerate(scenes,1):
    rows.append(f'<tr><td>{i:02d}</td><td class="time">{clock(start)}—{clock(start+s[2])}</td><td><strong>{html.escape(s[0])}</strong><small>{html.escape(s[1])}</small></td><td>{html.escape(s[3])}<br>{html.escape(s[4])}</td></tr>')
    start+=s[2]
video=root/'five-thousand-years-line-art-animation.mp4'
poster=root/'outputs/five-thousand-years-cover.jpg'
video64=base64.b64encode(video.read_bytes()).decode('ascii')
poster64=base64.b64encode(poster.read_bytes()).decode('ascii')
template='''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="一卷穿越五千年：原始提示词、原创线稿动画、分镜与制作实现说明。">
<title>一卷穿越五千年 · 创作与实现说明</title>
<style>
:root{color-scheme:light;--paper:#f7f2e7;--ink:#293331;--red:#b34839;--muted:#687068;--line:#dcd5c6}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.85}main{max-width:1120px;margin:0 auto;padding:50px 32px 44px}header{padding-bottom:30px}.eyebrow{font-size:13px;letter-spacing:3px;color:var(--red);margin:0 0 16px}h1{font-size:clamp(30px,5vw,58px);line-height:1.3;letter-spacing:-1px;margin:0 0 12px}h2{font-size:25px;line-height:1.4;margin:0 0 18px}h3{font-size:18px;line-height:1.5;margin:0 0 10px}p{margin:0 0 14px}.lead{max-width:770px;color:var(--muted);font-size:17px}.specs{display:flex;flex-wrap:wrap;gap:8px 25px;margin-top:22px;font-size:14px}.specs span{padding-bottom:5px;border-bottom:2px solid var(--red)}video{display:block;width:100%;aspect-ratio:16/9;background:#293331;object-fit:contain;border-radius:8px}.player-note{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:12px;font-size:13px;color:var(--muted)}section{padding:34px 0;border-top:1px solid var(--line)}.video-section{border:0;padding:0 0 32px}.prompt{border-left:4px solid var(--red);margin:0;padding:19px 25px;background:#eee7d9;font-size:19px;line-height:1.9}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px 36px}.item{border-top:2px solid var(--line);padding-top:18px}.item p{color:var(--muted);font-size:15px}.pipeline{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:24px 0 0}.pipeline div{border-top:2px solid var(--red);padding-top:14px}.number{color:var(--red);font-size:13px;letter-spacing:2px}.pipeline strong{display:block;margin:5px 0}.pipeline p{font-size:14px;color:var(--muted)}code{font-family:Consolas,monospace;font-size:.9em;background:#eee7d9;padding:2px 5px;border-radius:3px;overflow-wrap:anywhere}a{color:var(--red);text-underline-offset:4px;overflow-wrap:anywhere}a:focus-visible,summary:focus-visible{outline:3px solid var(--red);outline-offset:5px}summary{cursor:pointer;font-weight:600;padding:15px 0;min-height:48px}details{border-top:1px solid var(--line)}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;min-width:690px}th,td{padding:14px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:500}td:first-child{color:var(--red);width:44px}.time{white-space:nowrap;font-variant-numeric:tabular-nums;font-size:13px}td small{display:block;color:var(--muted);font-size:12px;line-height:1.65;margin-top:6px}.files{display:grid;grid-template-columns:1fr 1fr;gap:14px 30px}.files div{padding:8px 0;border-bottom:1px solid var(--line)}.files small{display:block;color:var(--muted);font-size:13px;margin-top:4px}.sources{margin:0;padding-left:22px;font-size:14px}.sources li{margin:7px 0}footer{border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:12px}.muted{color:var(--muted);font-size:14px}.checks{margin:0;padding-left:22px}.checks li{margin:8px 0}.stamp{color:var(--red);font-weight:600}
@media(max-width:700px){main{padding:28px 20px}.grid,.files{grid-template-columns:1fr}.pipeline{grid-template-columns:1fr 1fr}section{padding:27px 0}.prompt{padding:15px 18px;font-size:17px}h2{font-size:23px}.player-note{display:block}.specs{gap:7px 16px}.lead{font-size:16px}}
@media print{main{max-width:none;padding:0}video{display:none}.video-section{display:none}details>summary{display:none}details>*:not(summary){display:block!important}section{break-inside:avoid}a{color:var(--ink)}body{font-size:12px}h1{font-size:32px}}
</style>
</head>
<body><main>
<header><p class="eyebrow">创作档案 / 原始提示词与实现说明</p><h1>一卷穿越五千年</h1><p class="lead">一卷会跑的小竹简，带观众从农耕聚落走到现代城市。用轻松的线稿、时代小梗与原创音乐，快速回顾中华文明的代表性节点。</p><div class="specs"><span>2 分 08 秒</span><span>19 幕分镜</span><span>1280 × 720 / 24 帧</span><span>中文字幕 + 原创器乐</span></div></header>
<section class="video-section" aria-label="动画播放器"><video controls playsinline preload="none" poster="data:image/jpeg;base64,__POSTER__" aria-label="一卷穿越五千年线稿动画，配有中文字幕和原创器乐"><source src="data:video/mp4;base64,__VIDEO__" type="video/mp4">您的浏览器不支持此视频，请使用现代浏览器打开。</video><div class="player-note"><span>点击播放即可开启时空之旅；字幕已直接写入画面。</span><span>视频与封面均内嵌，可离线播放。</span></div></section>
<section id="prompt"><h2>原始提示词</h2><blockquote class="prompt">做一个动画，快速回顾中华五千年的历史。风格轻松有趣，动画格式为线稿，添加合适的音乐，请务必做到引人入胜</blockquote><p class="muted" style="margin-top:14px">以上保留原始创作要求。后续文件整理要求已落实：文件与目录使用英文名称，页面内容使用中文。</p></section>
<section><h2>创意与叙事</h2><div class="grid"><div class="item"><h3>一条持续向前的线索</h3><p>以“时空快递”为叙事框架，小竹简作为贯穿角色。从种田、文字与思想，到城市、交通与探索，突出普通人的生活、创造与交流，让历史拥有连续的日常感。</p></div><div class="item"><h3>轻松，但保持分寸</h3><p>笑点来自“先种田，再开饭”“思想家，开麦”“知识，批量上线”等画面小梗。进入近代苦难与战争段落时，减少热闹动作并弱化音乐节奏。</p></div><div class="item"><h3>以代表性节点形成快节奏</h3><p>每幕约 6—8 秒，通过人物、物件与简短字幕呈现核心主题。19 幕覆盖文明起源、夏商周、春秋战国、秦汉、三国两晋南北朝、隋唐宋元明清、近代与当代。</p></div><div class="item"><h3>历史表述的边界</h3><p>“五千年”概括文明历程，不作为精确纪年。夏代区分传世记载与考古对应的讨论；宋代注明与其他政权并立；清代分别标明 1636 年建立与 1644 年入关。这是快速概览，并非完整通史。</p></div></div></section>
<section><h2>画面与动画实现</h2><p>使用 Python 与 Pillow 逐帧绘制线稿，再由 FFmpeg 编码。人物、建筑和道具均由程序生成的线条、曲线与少量遮挡填色组成，没有采用外部照片或现成动画素材。</p><div class="grid"><div class="item"><h3>视觉语言</h3><p>暖纸底色 <code>#f7f2e7</code>、墨色线条 <code>#293331</code> 与朱红点缀 <code>#bc493a</code>。纸面叠加固定的细微颗粒；中文使用本机微软雅黑字体。</p></div><div class="item"><h3>逐笔显现</h3><p>每幕的绘图操作按顺序揭示，使用缓动控制显现进度。线段按当前进度截取，形成“正在画出来”的效果；开头以纸面横向扫过形成卷页转场。</p></div><div class="item"><h3>持续的小动作</h3><p>以正弦函数控制人物起伏、挥手、眨眼、步伐、麦穗与水波。驿马和骆驼摆动四肢，高铁横向运动，火箭向上移动；胡旋舞场景使用摆动与旋转感线条。</p></div><div class="item"><h3>字幕与画面层级</h3><p>上方显示章节名和时代，下方保留两行叙述字幕，随段落切换强调。底部进度线贯穿全片。人物内部以纸色遮挡背景线条，保持脸部、衣襟和轮廓清楚。</p></div></div></section>
<section><h2>原创音乐实现</h2><p>用 NumPy 合成原创五声音阶旋律，基本速度为 <span class="stamp">112 BPM</span>。拨弦、笛声、低音与木质打击乐均为程序合成音色，不是现成歌曲或真实乐器录音。</p><div class="grid"><div class="item"><h3>音色与空间</h3><p>拨弦由多次谐波与衰减包络模拟；笛声使用柔和谐波、渐入渐出与细微颤音。打击乐使用短促衰减与噪声。左右声像及延迟回声形成轻微立体声空间。</p></div><div class="item"><h3>随剧情改变节奏</h3><p>每幕改变旋律片段或调性中心；秦、唐、当代与结尾加入上行音型。近代章节降低音量并去除常规鼓点，保留缓慢笛声。结尾加入收束旋律与淡出。</p></div></div><p class="muted" style="margin-top:18px">声音形式为原创器乐 + 画面字幕，没有人声旁白。配乐工作文件为 44.1 kHz 双声道 WAV，成片编码为 192 kbps AAC。</p></section>
<section><h2>制作流程与技术参数</h2><div class="pipeline"><div><span class="number">01 / 内容</span><strong>设定 19 幕分镜</strong><p>编写章节、年代、两行字幕、场景动作与每幕时长。</p></div><div><span class="number">02 / 绘制</span><strong>逐帧生成画面</strong><p>以 1.5 倍画布绘制，再用 Lanczos 缩小到 720p，减轻线条锯齿。</p></div><div><span class="number">03 / 音乐</span><strong>合成原创配乐</strong><p>生成立体声 WAV，按场景调整音色、旋律、鼓点与动态。</p></div><div><span class="number">04 / 封装</span><strong>输出与检查</strong><p>H.264 视频、AAC 音频、19 个章节位置，使用 faststart 封装 MP4。</p></div></div><p class="muted" style="margin-top:22px">编码设置：24 帧/秒；共 3072 帧；H.264 / yuv420p；CRF 19；fast 预设。绘图由 3 个工作进程处理，FFmpeg 使用 4 个编码线程。</p></section>
<section><h2>完整分镜</h2><p class="muted">每一幕的时间、时代与画面字幕如下。</p><details><summary>展开 19 幕分镜与字幕</summary><div class="table-wrap"><table><thead><tr><th>幕</th><th>时间</th><th>章节 / 时代</th><th>画面字幕</th></tr></thead><tbody>__ROWS__</tbody></table></div></details></section>
<section><h2>验证结果</h2><ul class="checks"><li>完整解码成片成功：时长 128 秒、3072 帧、1280 × 720、24 帧/秒。</li><li>确认 AAC 双声道音轨与 19 个章节位置均存在。</li><li>抽取成片的 19 幕画面检查布局，并修整人物与背景交叉、对话框与头部的遮挡关系。</li><li>字幕最大测量宽度约 621 像素，小于可用的 1150 像素。</li><li>原始配乐峰值约 0.469、均方根约 0.072，未检测到数字削波。</li><li>英文文件名整理时对四个改名文件比较 SHA-256，确认内容保持一致。</li></ul></section>
<section><h2>文件与源代码</h2><p class="muted">本页的文字、样式、视频与封面均内嵌，不需要网络连接。下方链接指向项目里的独立文件；把本页单独复制到其他位置后，内嵌视频仍可播放。</p><div class="files"><div><a href="five-thousand-years-line-art-animation.mp4">动画成片 MP4</a><small>five-thousand-years-line-art-animation.mp4 / 项目根目录</small></div><div><a href="work/production-notes.txt">制作说明 TXT</a><small>work/production-notes.txt</small></div><div><a href="outputs/five-thousand-years-subtitles.srt">字幕文件 SRT</a><small>outputs/five-thousand-years-subtitles.srt</small></div><div><a href="outputs/five-thousand-years-cover.jpg">封面图片 JPG</a><small>outputs/five-thousand-years-cover.jpg</small></div><div><a href="work/build_film.py">动画与音乐生成脚本</a><small>work/build_film.py / Pillow、NumPy、FFmpeg</small></div><div><a href="work/verify_film.py">成片验证脚本</a><small>work/verify_film.py / 完整解码与抽帧检查</small></div></div></section>
<section><h2>历史核对参考</h2><p class="muted">相关年代与代表性背景参考以下资料。参考链接需要网络连接。</p><ul class="sources"><li><a href="https://82nd-and-fifth.metmuseum.org/toah/ht/02/eac.html" target="_blank" rel="noopener">大都会艺术博物馆：史前中国年表</a></li><li><a href="https://www.metmuseum.org/zh/essays/shang-and-zhou-dynasties-the-bronze-age-of-china" target="_blank" rel="noopener">大都会艺术博物馆：商周青铜时代</a></li><li><a href="https://www.metmuseum.org/exhibitions/listings/2017/age-of-empires" target="_blank" rel="noopener">大都会艺术博物馆：秦汉展览</a></li><li><a href="https://82nd-and-fifth.metmuseum.org/toah/ht/07/eac.html" target="_blank" rel="noopener">大都会艺术博物馆：1000—1400 年中国年表</a></li><li><a href="https://www.metmuseum.org/exhibitions/listings/2009/arts-of-the-ming-dynasty" target="_blank" rel="noopener">大都会艺术博物馆：明代艺术</a></li><li><a href="https://history.state.gov/milestones/1899-1913/chinese-rev" target="_blank" rel="noopener">美国国务院历史办公室：1911 年革命</a></li><li><a href="https://history.state.gov/milestones/1945-1952/chinese-rev" target="_blank" rel="noopener">美国国务院历史办公室：1949 年中华人民共和国成立</a></li></ul></section>
<footer>原创线稿与器乐制作记录 · 中文页面 / 英文文件名 · 2026 年 9 月 26 日</footer>
</main></body></html>'''
page=template.replace('__POSTER__',poster64).replace('__VIDEO__',video64).replace('__ROWS__','\n'.join(rows))
target=root/'history-animation-details.html'
target.write_text(page,encoding='utf-8')
assert page.count('<tr>')==20
assert '__VIDEO__' not in page
assert hashlib.sha256(base64.b64decode(page.split('data:video/mp4;base64,')[1].split('"')[0])).hexdigest()==sha(video)
nonenglish=[str(p.relative_to(root)) for p in root.rglob('*') if any(ord(c)>127 for c in p.name)]
assert not nonenglish,nonenglish
shutil.copy2(__file__,root/'work/create_details.py')
print(json.dumps({'renamed_files':4,'remaining_non_english_names':nonenglish,'html':str(target),'html_bytes':target.stat().st_size,'embedded_video_verified':True},ensure_ascii=False))
