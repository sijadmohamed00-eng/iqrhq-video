/**
 * modules/video.js — IQRHQ Professional Animated Background
 * Colors: Deep Navy #0A1628 + White #FFFFFF + Gold #C8A84B
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { buildSubtitleFile } from './subtitles.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export async function buildVideo({ script, audioPath, audioDuration, outputPath, tempDir, addMusic = true }) {
  logger.info(`Building professional video. Duration: ${audioDuration}s`);
  const duration = Math.min(Math.max(audioDuration + 0.5, 15), 35);

  const subtitlePath = path.join(tempDir, 'subs.ass');
  buildSubtitleFile(script.subtitleLines, audioDuration, subtitlePath);

  const bgPath = path.join(tempDir, 'background.mp4');
  await generateProfessionalBackground(duration, bgPath);

  const gradedPath = path.join(tempDir, 'graded.mp4');
  await burnSubtitles(bgPath, subtitlePath, gradedPath);

  await mixAudio({ videoPath: gradedPath, voicePath: audioPath, duration, outputPath, addMusic });
  logger.info(`Video ready: ${outputPath}`);
}

async function generateProfessionalBackground(duration, outputPath) {
  logger.info('Generating IQRHQ branded background...');
  const W = 1080, H = 1920, fps = 30;

  await runFFmpeg([
    '-f', 'lavfi', '-i', `color=c=0x0A1628:size=${W}x${H}:rate=${fps}:duration=${duration}`,
    '-f', 'lavfi', '-i', `color=c=0xC8A84B:size=${W}x6:rate=${fps}:duration=${duration}`,
    '-f', 'lavfi', '-i', `color=c=0xC8A84B:size=${W}x6:rate=${fps}:duration=${duration}`,
    '-f', 'lavfi', '-i', `color=c=0x1E4080:size=6x${H}:rate=${fps}:duration=${duration}`,
    '-f', 'lavfi', '-i', `color=c=0x1E4080:size=6x${H}:rate=${fps}:duration=${duration}`,
    '-filter_complex', [
      '[0][1]overlay=0:0[v1]',
      `[v1][2]overlay=0:${H - 6}[v2]`,
      '[v2][3]overlay=0:0[v3]',
      `[v3][4]overlay=${W - 6}:0[vout]`,
    ].join(';'),
    '-map', '[vout]',
    '-t', String(duration),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-an', '-y', outputPath,
  ]);
}

async function burnSubtitles(inputPath, subtitlePath, outputPath) {
  const escaped = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
  await runFFmpeg([
    '-i', inputPath,
    '-vf', `ass='${escaped}'`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-an', '-y', outputPath,
  ]);
}

async function mixAudio({ videoPath, voicePath, duration, outputPath, addMusic }) {
  const musicDir = path.join(ROOT, 'assets', 'music');
  const musicFiles = fs.existsSync(musicDir)
    ? fs.readdirSync(musicDir).filter(f => f.match(/\.(mp3|wav|m4a)$/i))
    : [];

  if (addMusic && musicFiles.length > 0) {
    const musicPath = path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)]);
    await runFFmpeg([
      '-i', videoPath, '-i', voicePath, '-i', musicPath,
      '-t', String(duration),
      '-filter_complex', [
        '[1:a]loudnorm=I=-14:TP=-1:LRA=9[voice]',
        `[2:a]aloop=loop=-1:size=2e+09,atrim=0:${duration},volume=0.10,afade=t=out:st=${duration - 2}:d=2[music]`,
        '[voice][music]amix=inputs=2:duration=first[audio]',
      ].join(';'),
      '-map', '0:v', '-map', '[audio]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart', '-y', outputPath,
    ]);
  } else {
    await runFFmpeg([
      '-i', videoPath, '-i', voicePath,
      '-t', String(duration),
      '-filter_complex', '[1:a]loudnorm=I=-14:TP=-1:LRA=9[audio]',
      '-map', '0:v', '-map', '[audio]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart', '-y', outputPath,
    ]);
  }
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const bin = process.env.FFMPEG_PATH || 'ffmpeg';
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) return resolve();
      reject(new Error(`FFmpeg exit ${code}:\n${stderr.split('\n').slice(-5).join('\n')}`));
    });
    proc.on('error', err => reject(new Error(`FFmpeg spawn: ${err.message}`)));
  });
}

export { runFFmpeg };
