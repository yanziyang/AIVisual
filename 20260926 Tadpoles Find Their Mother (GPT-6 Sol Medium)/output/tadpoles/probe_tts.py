import sys,asyncio
sys.path.insert(0,'animation_deps')
import edge_tts
async def main():
 await edge_tts.Communicate('春天来了，小蝌蚪醒了。妈妈，你在哪里？','zh-CN-XiaoxiaoNeural',rate='-8%').save('output/tadpoles/probe.mp3')
 print('TTS_OK')
asyncio.run(main())
