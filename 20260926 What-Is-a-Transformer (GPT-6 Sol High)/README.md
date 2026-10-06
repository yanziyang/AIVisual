# What Is a Transformer?

A complete narrated video generated with JavaScript, plus an offline video player and attention playground.

## Watch

Open `what-is-a-transformer-video.html` in a browser for the video, chapters, original prompt, implementation notes, and attention playground. You can also open `What-Is-a-Transformer.mp4` in a video player. The page works offline except for external reference links. If a browser restricts local caption files, embedded captions remain visible.

Supporting files listed below are in the `transformer-video` subfolder. The combined video and documentation page is `what-is-a-transformer-video.html` in the workspace root.

## Files

- `scenes.json`: editable narration and scene descriptions
- `visuals.js`: original Canvas diagrams and deterministic animation
- `prepare.js`: creates speech, timeline, subtitles, and transcript
- `render.js`: renders frames and encodes the MP4 with FFmpeg
- `index.html`: companion player with chapter navigation and an interactive attention calculator
- `verify.js`: math, layout, and encoding checks
- `captions.srt` / `captions.vtt`: subtitle tracks; sentence timings are estimated within individually timed narration segments
- `transcript.md`: full transcript and sources

## Reproduce on Windows

Requires Node.js and Windows System.Speech with the Microsoft Zira Desktop voice. The JavaScript renderer is portable; replace the speech preparation step if using another operating system.

```powershell
cd transformer-video
npm install --no-audit --no-fund
# If npm blocks the FFmpeg download script:
node node_modules/ffmpeg-static/install.js
node prepare.js
node render.js
node verify.js
```

Rerun preparation after editing narration. FFmpeg-static downloads its encoder. No account, API key, stock images, or remote speech service is required. For an HTTP preview, run `node serve.js` and open `http://127.0.0.1:4173`.

## Educational choices

The numerical example uses query `[1,0]`, keys `[[2,0],[0,2],[1,1]]`, and identical values to keep arithmetic manageable. These are invented examples, not measured model activations. Rounded weights are `[0.576,0.140,0.284]`, giving output approximately `[1.436,0.564]`.

The tour distinguishes encoder and decoder attention, explains causal masking and shifted targets, and distinguishes attention weights from vocabulary probabilities. It covers the original additive positional encoding and notes that normalization and positional designs vary.

All visuals are original. Narration is synthesized using the installed system voice. The references appear in the transcript and companion player.
