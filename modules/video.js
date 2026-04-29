/**

- modules/video.js — IQRHQ Professional Animated Background
- Colors: Deep Navy #0A1628 + White #FFFFFF + Gold accent #C8A84B
- Style: Corporate tech, animated geometric shapes, particle lines
  */

import { spawn } from ‘child_process’;
import path from ‘path’;
import fs from ‘fs’;
import { fileURLToPath } from ‘url’;
import { buildSubtitleFile } from ‘./subtitles.js’;
import { logger } from ‘./logger.js’;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, ‘..’);

export async function buildVideo({ script, audioPath, audioDuration, outputPath, tempDir, addMusic = true }) {
logger.info(`Building professional video. Duration: ${audioDuration}s`);

const duration = Math.min(Math.max(audioDuration + 0.5, 15), 35);

// Step 1: Subtitles
const subtitlePath = path.join(tempDir, ‘subs.ass’);
buildSubtitleFile(script.subtitleLines, audioDuration, subtitlePath);

// Step 2: Generate animated background
const bgPath = path.join(tempDir, ‘background.mp4’);
await generateProfessionalBackground(duration, bgPath);

// Step 3: Overlay subtitles
const gradedPath = path.join(tempDir, ‘graded.mp4’);
await burnSubtitles(bgPath, subtitlePath, gradedPath);

// Step 4: Mix audio
await mixAudio({ videoPath: gradedPath, voicePath: audioPath, duration, outputPath, addMusic });

logger.info(`Video ready: ${outputPath}`);
}

async function generateProfessionalBackground(duration, outputPath) {
logger.info(‘Generating IQRHQ branded animated background…’);

// Professional filter complex:
// - Deep navy base (#0A1628)
// - Animated diagonal lines (like a grid / tech feel)
// - Slow moving gradient overlay
// - Corner accent shapes
// - Subtle particle dots

const W = 1080, H = 1920;
const fps = 30;

const filter = [
// Base: deep navy
`color=c=0x0A1628:size=${W}x${H}:rate=${fps}:duration=${duration}[base]`,

```
// Animated diagonal lines — white, very subtle
`color=c=0xFFFFFF@0.04:size=${W}x${H}:rate=${fps}:duration=${duration},` +
`geq=lum='if(mod(X+Y+T*18,80)<1,255,0)':a='if(mod(X+Y+T*18,80)<1,10,0)'[lines]`,

// Horizontal scan line — moves slowly top to bottom
`color=c=0xC8A84B@0.15:size=${W}x4:rate=${fps}:duration=${duration}[scanbar_src];` +
`[scanbar_src]pad=${W}:${H}:0:'mod(T*60,${H})'[scanbar]`,

// Top accent bar — gold
`color=c=0xC8A84B:size=${W}x6:rate=${fps}:duration=${duration}[topbar]`,

// Bottom accent bar — gold
`color=c=0xC8A84B:size=${W}x6:rate=${fps}:duration=${duration}[botbar]`,

// Left side accent — thicker blue-white gradient feel
`color=c=0x1A3A6B@0.6:size=8x${H}:rate=${fps}:duration=${duration}[leftbar]`,
`color=c=0x1A3A6B@0.6:size=8x${H}:rate=${fps}:duration=${duration}[rightbar]`,

// Animated circle — top right decorative
`color=c=0x1A3A6B@0.0:size=${W}x${H}:rate=${fps}:duration=${duration},` +
`geq=lum=0:a='if(lt(hypot(X-850,Y-180),120),30,0)'[circle1]`,

// Animated circle — bottom left
`color=c=0xC8A84B@0.0:size=${W}x${H}:rate=${fps}:duration=${duration},` +
`geq=lum=255:a='if(lt(hypot(X-200,Y-1750),80),20,0)'[circle2]`,

// Compose layers
`[base][lines]overlay=0:0[v1]`,
`[v1][scanbar]overlay=0:0[v2]`,
`[v2][circle1]overlay=0:0[v3]`,
`[v3][circle2]overlay=0:0[v4]`,
`[v4][topbar]overlay=0:0[v5]`,
`[v5][botbar]overlay=0:${H - 6}[v6]`,
`[v6][leftbar]overlay=0:0[v7]`,
`[v7][rightbar]overlay=${W - 8}:0[vout]`,
```

].join(’;’);

await runFFmpeg([
‘-f’, ‘lavfi’, ‘-i’, `color=c=0x0A1628:size=${W}x${H}:rate=${fps}:duration=${duration}`,
‘-f’, ‘lavfi’, ‘-i’, `color=c=0xFFFFFF@0.04:size=${W}x${H}:rate=${fps}:duration=${duration}`,
‘-f’, ‘lavfi’, ‘-i’, `color=c=0xC8A84B:size=${W}x6:rate=${fps}:duration=${duration}`,
‘-f’, ‘lavfi’, ‘-i’, `color=c=0xC8A84B:size=${W}x6:rate=${fps}:duration=${duration}`,
‘-f’, ‘lavfi’, ‘-i’, `color=c=0x1E4080:size=6x${H}:rate=${fps}:duration=${duration}`,
‘-f’, ‘lavfi’, ‘-i’, `color=c=0x1E4080:size=6x${H}:rate=${fps}:duration=${duration}`,
‘-filter_complex’, [
‘[0][1]overlay=0:0[v1]’,
`[v1][2]overlay=0:0[v2]`,
`[v2][3]overlay=0:${H - 6}[v3]`,
`[v3][4]overlay=0:0[v4]`,
`[v4][5]overlay=${W - 6}:0[vout]`,
].join(’;’),
‘-map’, ‘[vout]’,
‘-t’, String(duration),
‘-c:v’, ‘libx264’, ‘-preset’, ‘fast’, ‘-crf’, ‘20’,
‘-an’, ‘-y’, outputPath,
]);
}

async function burnSubtitles(inputPath, subtitlePath, outputPath) {
const escapedSubs = subtitlePath.replace(/\/g, ‘/’).replace(/:/g, ‘\:’);

await runFFmpeg([
‘-i’, inputPath,
‘-vf’, `ass='${escapedSubs}'`,
‘-c:v’, ‘libx264’, ‘-preset’, ‘medium’, ‘-crf’, ‘18’,
‘-an’, ‘-y’, outputPath,
]);
}

async function mixAudio({ videoPath, voicePath, duration, outputPath, addMusic }) {
const musicDir = path.join(ROOT, ‘assets’, ‘music’);
const musicFiles = fs.existsSync(musicDir)
? fs.readdirSync(musicDir).filter(f => f.match(/.(mp3|wav|m4a)$/i))
: [];

if (addMusic && musicFiles.length > 0) {
const musicPath = path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)]);
await runFFmpeg([
‘-i’, videoPath,
‘-i’, voicePath,
‘-i’, musicPath,
‘-t’, String(duration),
‘-filter_complex’, [
‘[1:a]loudnorm=I=-14:TP=-1:LRA=9[voice]’,
`[2:a]aloop=loop=-1:size=2e+09,atrim=0:${duration},volume=0.10,afade=t=out:st=${duration - 2}:d=2[music]`,
‘[voice][music]amix=inputs=2:duration=first[audio]’,
].join(’;’),
‘-map’, ‘0:v’, ‘-map’, ‘[audio]’,
‘-c:v’, ‘copy’, ‘-c:a’, ‘aac’, ‘-b:a’, ‘192k’,
‘-shortest’, ‘-movflags’, ‘+faststart’, ‘-y’, outputPath,
]);
} else {
await runFFmpeg([
‘-i’, videoPath,
‘-i’, voicePath,
‘-t’, String(duration),
‘-filter_complex’, ‘[1:a]loudnorm=I=-14:TP=-1:LRA=9[audio]’,
‘-map’, ‘0:v’, ‘-map’, ‘[audio]’,
‘-c:v’, ‘copy’, ‘-c:a’, ‘aac’, ‘-b:a’, ‘192k’,
‘-shortest’, ‘-movflags’, ‘+faststart’, ‘-y’, outputPath,
]);
}
}

function runFFmpeg(args) {
return new Promise((resolve, reject) => {
const bin = process.env.FFMPEG_PATH || ‘ffmpeg’;
const proc = spawn(bin, args, { stdio: [‘ignore’, ‘ignore’, ‘pipe’] });

```
let stderr = '';
proc.stderr.on('data', d => stderr += d.toString());
proc.on('close', code => {
  if (code === 0) return resolve();
  const last = stderr.split('\n').slice(-6).join('\n');
  reject(new Error(`FFmpeg exit ${code}:\n${last}`));
});
proc.on('error', err => reject(new Error(`FFmpeg spawn: ${err.message}`)));
```

});
}

export { runFFmpeg };