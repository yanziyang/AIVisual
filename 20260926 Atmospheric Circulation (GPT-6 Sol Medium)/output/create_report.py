from pathlib import Path
import base64, json, html, hashlib

root = Path(__file__).parent
assets = root / 'atmospheric_circulation'
meta = json.loads((assets / 'storyboard_and_narration.json').read_text(encoding='utf-8'))
video = root / 'atmospheric_circulation_bilingual_animation.mp4'
source = (root / 'make_animation.py').read_text(encoding='utf-8')
esc = html.escape
def data_uri(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
def clock(seconds):
    value = round(seconds)
    return f'{value // 60:02}:{value % 60:02}'
rows = []
start = 0
for number, (scene, duration) in enumerate(zip(meta['scenes'], meta['durations']), 1):
    title, zh, en, kind = scene
    rows.append(f'<tr><td>{number:02}</td><td class="time">{clock(start)}–{clock(start+duration)}</td><td><strong>{esc(title)}</strong><p>{esc(zh)}</p><p class="english">{esc(en)}</p><code>{esc(kind)}</code></td></tr>')
    start += duration
digest = hashlib.sha256(video.read_bytes()).hexdigest()
report = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="高中地理大气环流线稿动画：需求提示词、分镜、TTS、原创音乐、字幕与视频编码的中文实现报告。">
<title>大气环流动画｜需求与技术实现报告</title>
<style>
:root{--ink:#23313b;--muted:#566774;--paper:#faf8f1;--accent:#ac482f;--blue:#31708a;--line:#dddcd3}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;font-size:16px;line-height:1.85}
main{max-width:1080px;margin:auto;padding:46px 30px 70px}header{padding:26px 0 34px;border-bottom:2px solid var(--ink)}.eyebrow{font-size:13px;letter-spacing:.16em;color:var(--accent)}h1{font-size:clamp(30px,5vw,48px);line-height:1.25;margin:14px 0}h2{font-size:25px;margin:0 0 18px}h3{font-size:18px;margin:22px 0 8px}p{margin:10px 0}.lead{max-width:790px;color:var(--muted)}nav{display:flex;flex-wrap:wrap;gap:10px 24px;padding:21px 0}a{color:var(--blue);text-underline-offset:4px}section{padding:30px 0;border-top:1px solid var(--line);scroll-margin-top:20px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin:24px 0}.metric{border-left:3px solid var(--blue);padding-left:15px}.metric strong{display:block;font-size:26px}.metric span{font-size:14px;color:var(--muted)}blockquote{margin:16px 0;padding:18px 24px;background:#f0ece1;border-left:4px solid var(--accent);white-space:pre-wrap}.note{padding:14px 20px;background:#eaf0f1;border-left:3px solid var(--blue)}video,img{display:block;width:100%;height:auto;border-radius:8px}video{background:#23313b}.caption{font-size:14px;color:var(--muted)}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:15px}th,td{text-align:left;vertical-align:top;padding:13px 14px;border-bottom:1px solid var(--line)}th{background:#efede4}td p{margin:7px 0}.time{white-space:nowrap;color:var(--muted)}.english{color:var(--muted);font-size:14px}code,pre{font-family:Consolas,monospace}code{font-size:.9em;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#23313b;color:#f5f4ed;padding:20px;border-radius:6px;font-size:13px;line-height:1.65}details{margin:16px 0}summary{cursor:pointer;font-weight:600;padding:10px 0}ol,ul{padding-left:24px}li{margin:7px 0}footer{padding-top:24px;color:var(--muted);font-size:13px}.hash{word-break:break-all;font-size:12px}.flow{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:16px 0}.flow span{padding:6px 10px;background:#eeece2;border-radius:4px}.flow b{color:var(--accent)}
@media(max-width:640px){main{padding:22px 18px 40px}.metrics{grid-template-columns:repeat(2,1fr)}th,td{padding:10px 8px;font-size:14px}h2{font-size:22px}}
@media print{body{background:white}main{max-width:none;padding:0}nav,video{display:none}section{break-inside:auto}h2,h3{break-after:avoid}tr,img,blockquote{break-inside:avoid}.metrics{grid-template-columns:repeat(4,1fr)}a{color:inherit}pre{background:#eee;color:#111}details{display:block}footer{font-size:10px}}
</style>
</head><body><main>
<header><div class="eyebrow">项目制作记录 · 2026 年 9 月 26 日</div><h1>大气环流动画<br>需求与技术实现报告</h1><p class="lead">以“空气快递员”为叙事主线，用线稿示意、中文语音、双语字幕和轻快音乐讲解高中地理“大气环流”。本报告依据实际生成脚本、分镜数据和成片检查结果编写。</p>
<div class="metrics"><div class="metric"><strong>3 分 14 秒</strong><span>精确时长 193.65 秒</span></div><div class="metric"><strong>19 个</strong><span>教学分镜</span></div><div class="metric"><strong>720p</strong><span>1280 × 720 · 20 fps</span></div><div class="metric"><strong>中英双语</strong><span>中文 TTS · 原创配乐</span></div></div></header>
<nav aria-label="报告目录"><a href="#prompt">需求提示词</a><a href="#result">成片预览</a><a href="#design">教学与视觉</a><a href="#implementation">技术实现</a><a href="#storyboard">完整分镜</a><a href="#verification">验证结果</a><a href="#files">文件与复现</a></nav>
<section id="prompt"><h2>01 · 需求提示词与后续调整</h2><h3>原始提示词（原文）</h3><blockquote>做一个动画，讲解高中地理知识点“大气环流”。风格轻松有趣，动画格式为线稿，添加合适的音乐，请务必做到引人入胜，字幕用中英双语，解说用TTS</blockquote>

<h3>执行时采用的制作规格</h3><p>用户未指定时长、画幅或语音角色。制作中采用约三分钟、16:9 横屏、中文女声和 19 个教学分镜。线稿通过程序逐帧绘制；“空气快递员”、颜色箭头、动态雨滴、季节移动和快问快答共同承担注意力引导。</p><p class="note">没有使用额外的图像生成提示词或生成式视频模型。本项目的画面由 Python 绘图逻辑生成；原始提示词经人工结构化为分镜、解说和动画函数。</p></section>
<section id="result"><h2>02 · 成片预览</h2><video controls preload="none" playsinline poster="__PREVIEW__" aria-label="大气环流双语线稿动画"><source src="__VIDEO__" type="video/mp4">当前浏览器不支持播放 MP4。</video><p class="caption">视频及预览图已嵌入报告。报告本身不依赖网络、外部字体或相邻资源文件；可直接用支持 H.264／AAC 的浏览器打开。</p></section>
<section id="design"><h2>03 · 教学设计与视觉表达</h2><h3>知识链条</h3><p>从纬度间受热不均切入，先展示假设不自转的单圈环流，再引入地球自转和南北半球偏转，解释三圈环流、气压带与风带，最后连接降水、季节移动和季风。结尾用 30° 附近的升降运动与降水倾向检验理解。</p>
<h3>轻松叙事</h3><p>把空气拟人化为“快递员”，把热量与水汽当作配送内容，把三圈环流当作三个接力队。笑脸沿环流路径移动；风向箭头、下雨线条和气压带位移让抽象过程可见。字幕同时提供中文解释和英文概念表达。</p>
<h3>画面规格</h3><p>采用暖白纸面、浅色点阵、深色线稿与少量橙红／蓝色箭头。底部使用深色字幕区，中文 28 像素、英文 20 像素；标题使用 42 像素。字体为 Windows 本地微软雅黑 <code>msyh.ttc</code>。图形为地球和环流的教学示意，不是按比例的地理地图。</p>
<h3>概念边界</h3><p>三圈环流与七带六风是理想化、概括性的全球格局，实际纬度和强度会变化。报告与成片明确提到费雷尔环流主要由涡旋活动维持，并指出具体降水还受海陆位置、洋流和地形影响。季风场景中的海洋至陆地箭头标注为夏季示意。</p></section>
<section id="implementation"><h2>04 · 技术实现</h2><div class="flow" aria-label="制作流程"><span>分镜与解说</span><b>→</b><span>逐段 TTS</span><b>→</b><span>音频混合与时间轴</span><b>→</b><span>逐帧绘制</span><b>→</b><span>MP4 编码</span></div>
<div class="table-wrap"><table><thead><tr><th>组件</th><th>实际用途</th></tr></thead><tbody><tr><td>Python</td><td>组织分镜、音频合成、字幕输出和渲染流程。</td></tr><tr><td>Pillow（PIL）</td><td>逐帧绘制文字、线条、箭头、笑脸、地球与云雨示意。</td></tr><tr><td>NumPy</td><td>处理 PCM 波形、合成配乐、计算分镜时间轴及动画坐标。</td></tr><tr><td>edge-tts</td><td>调用在线 TTS，逐段保存中文语音 MP3。</td></tr><tr><td>imageio-ffmpeg / FFmpeg</td><td>语音解码、视频编码、音视频封装以及成片解码检查。</td></tr></tbody></table></div>
<h3>TTS 解说</h3><p>语音角色为 <code>zh-CN-XiaoxiaoNeural</code>，语速设为 <code>+3%</code>。每段中文解说分别生成 <code>voice_00.mp3</code> 至 <code>voice_18.mp3</code>；已存在的文件会被复用。随后统一转换为 24,000 Hz、单声道、16 位 PCM WAV，每段前置 0.3 秒静音、后置 0.8 秒静音。分镜时长由语音与这些静音的实际样本数决定。TTS 生成需要联网；成片播放不需要联网。</p>
<h3>原创背景音乐</h3><p>没有使用外部音乐或音色样本。NumPy 通过正弦波、二次谐波和指数衰减合成近似木琴的音色。音符频率按 <code>f = 440 × 2^((n − 69) / 12)</code> 换算，按固定 16 音符序列循环；每拍间隔 0.375 秒，每四拍加入较低音。合成信号采用语音 0.88 的增益，并叠加低音量配乐；开头约 2 秒淡入、结尾约 3 秒淡出，最终限制到合法振幅范围。未做响度标准化或自动侧链压低。</p>
<h3>动画与时间同步</h3><p>按每秒 20 帧采样，累计各段音频时长形成分镜边界，使用 <code>numpy.searchsorted</code> 找到当前帧所属场景。笑脸沿矩形环流路径作分段线性运动；雨滴纵向循环；季节移动用正弦函数控制带状线条位移。场景按分镜边界切换，没有采用补帧或复杂镜头转场。</p>
<h3>双语字幕</h3><p>每个分镜的完整中文解说和对应英文释义绘制进画面，属于固定字幕；另外输出独立的 <code>bilingual_subtitles.srt</code>。字幕时间与分镜时间一致，按分镜显示，而非逐字高亮。文字根据实际字体宽度逐字符换行，最大行宽为 1,160 像素。</p>
<h3>编码参数</h3><pre>输入画面：RGB24 原始帧，1280 × 720，20 fps
视频编码：libx264 / H.264，preset=fast，CRF=21
像素格式：yuv420p
音频编码：AAC，目标码率 160 kbit/s，24 kHz 单声道
容器：MP4，+faststart，-shortest
实际音频码率：约 104 kbit/s（成片检查值）</pre><p><code>+faststart</code> 将 MP4 播放索引放到文件前部，便于开始播放。<code>-shortest</code> 使输出在较短的音视频流结束时停止。</p></section>
<section id="storyboard"><h2>05 · 完整分镜、解说与英文字幕</h2><p class="caption">起止时间四舍五入到整秒，仅用于阅读；SRT 与生成时间轴保留毫秒精度。</p><div class="table-wrap"><table><thead><tr><th>序号</th><th>时间</th><th>标题、中文解说与英文字幕</th></tr></thead><tbody>__ROWS__</tbody></table></div></section>
<section id="verification"><h2>06 · 验证结果与实际限制</h2><ul><li>生成包含单圈模型、三圈环流和全球风带的检查拼图，检查画面排版及箭头方向。</li><li>程序检查全部 19 组双语字幕，均不超过各语言预留的两行范围。</li><li>读取成片流信息：时长 193.65 秒，1280 × 720，20 fps，H.264 视频与 AAC 音频。</li><li>FFmpeg 全片解码检查返回 0，未报告解码错误。</li><li>最终 MP4 大小为 4,541,817 字节，约 4.33 MiB。</li></ul><p class="note">上述检查证明文件可解码、字幕尺寸符合预留区域，并核对了关键示意图；不代表完成逐句人工听审、所有浏览器兼容性测试或课堂学习效果评估。“想三秒”是解说内容，脚本没有为小测验单独设置三秒静默倒计时，段后静音仍为 0.8 秒。</p><h3>成片校验值</h3><p class="hash">SHA-256：__HASH__</p></section>
<section id="files"><h2>07 · 文件位置与复现方法</h2><p>当前项目根目录：<code>C:\\MyProjects\\TempProject (OpenAI)</code>。生成文件名与输出文件夹均使用英文。</p><div class="table-wrap"><table><thead><tr><th>相对于项目根目录的路径</th><th>用途</th></tr></thead><tbody><tr><td><code>atmospheric_circulation_bilingual_animation.mp4</code></td><td>最终视频，按用户要求移至根目录。</td></tr><tr><td><code>atmospheric_circulation_report.html</code></td><td>本中文独立报告，内嵌成片、预览和源码快照。</td></tr><tr><td><code>make_animation.py</code></td><td>动画生成源代码。</td></tr><tr><td><code>atmospheric_circulation/bilingual_subtitles.srt</code></td><td>独立双语字幕。</td></tr><tr><td><code>atmospheric_circulation/storyboard_and_narration.json</code></td><td>分镜、解说、字幕和各段时长。</td></tr><tr><td><code>atmospheric_circulation/narration_and_music.wav</code></td><td>混合后的解说与配乐。</td></tr><tr><td><code>atmospheric_circulation/preview.png</code><br><code>atmospheric_circulation/review_contact_sheet.png</code></td><td>预览图与分镜检查拼图。</td></tr><tr><td><code>atmospheric_circulation/voice_00…18.mp3 / .wav</code></td><td>逐段 TTS 语音及其 PCM 中间文件。</td></tr><tr><td><code>.anim-deps/</code></td><td>项目内安装的 edge-tts 与 imageio-ffmpeg 等依赖。</td></tr></tbody></table></div>
<h3>复现步骤</h3><ol><li>准备 Python、Pillow、NumPy、edge-tts 和 imageio-ffmpeg；原脚本从项目的 <code>.anim-deps</code> 加载额外依赖。</li><li>保留 Windows 字体路径 <code>C:/Windows/Fonts/msyh.ttc</code>，或在其他系统上将其替换为可用的中文字体文件。</li><li>运行 <code>python make_animation.py --preview</code> 生成检查图，或运行 <code>python make_animation.py</code> 生成完整视频。</li><li>当前脚本仍将新渲染的 MP4 写入 <code>atmospheric_circulation/</code>。要复现当前交付位置，生成后再把该 MP4 移到项目根目录；先确认目标文件不存在，避免覆盖现有成片。</li></ol><p>生成器会覆盖输出目录中的同名渲染结果，但会复用已存在的 TTS MP3。如果修改了解说，应先备份或更新对应的语音缓存，以免使用旧语音。</p>
<details><summary>查看动画生成脚本快照</summary><pre>__SOURCE__</pre></details></section>
<footer>报告依据本项目实际文件生成。内嵌视频使 HTML 体积增大，但便于独立保存、离线阅读与播放。</footer>
</main></body></html>'''
report = report.replace('__PREVIEW__',data_uri(assets/'preview.png','image/png')).replace('__VIDEO__',data_uri(video,'video/mp4')).replace('__ROWS__',''.join(rows)).replace('__HASH__',digest).replace('__SOURCE__',esc(source))
path = root/'atmospheric_circulation_report.html'
path.write_text(report,encoding='utf-8')
from html.parser import HTMLParser
class Check(HTMLParser):
    def __init__(self): super().__init__(); self.ids=set(); self.targets=[]; self.video=None
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs: self.ids.add(attrs['id'])
        if tag=='a': self.targets.append(attrs.get('href',''))
        if tag=='source': self.video=attrs.get('src')
c=Check();c.feed(path.read_text(encoding='utf-8'))
assert all(x.startswith('#') and x[1:] in c.ids for x in c.targets)
assert hashlib.sha256(base64.b64decode(c.video.split(',',1)[1])).hexdigest()==digest
assert len(rows)==19 and '__ROWS__' not in report
print('Standalone report verified: 19 scenes, valid navigation, embedded video checksum matches.')
print('Report size:',path.stat().st_size,'bytes')
