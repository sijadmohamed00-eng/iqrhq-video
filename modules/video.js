/**
 * modules/video.js
 *
 * Core video rendering pipeline using FFmpeg.
 *
 * Pipeline:
 *  1. Select & loop background clips  →  bg_looped.mp4
 *  2. Color grade + logo watermark + burn subtitles  →  graded.mp4
 *  3. Mix voiceover + background music  →  final MP4
 *
 * If no background clips exist, generates a branded dark animated background.
 */

import { execSync, spawn } from 'child_process';
import path  from 'path';
import fs    from 'fs';
import { fileURLToPath } from 'url';
import { buildSubtitleFile } from './subtitles.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

/**
 * Build the final MP4 video.
 * @param {object}  opts
 * @param {object}  opts.script        - Script object (contains subtitleLines etc.)
 * @param {string}  opts.audioPath     - Path to voiceover MP3
 * @param {number}  opts.audioDuration - Duration in seconds
 * @param {string}  opts.outputPath    - Final MP4 output path
 * @param {string}  opts.tempDir       - Working directory for temp files
 * @param {boolean} opts.addMusic      - Mix background music
 */
export async function buildVideo({ script, audioPath, audioDuration, outputPath, tempDir, addMusic = true }) {
  logger.info(`Building video. Duration target: ${audioDuration}s`);

  // Clamp to safe range (15–35s)
  const targetDuration = Math.min(Math.max(audioDuration + 0.5, 15), 35);

  // ── Step 1: Subtitles ────────────────────────────────────────────────────
  const subtitlePath = path.join(tempDir, 'subs.ass');
  buildSubtitleFile(script.subtitleLines, audioDuration, subtitlePath);

  // ── Step 2: Background ───────────────────────────────────────────────────
  const loopedClip = path.join(tempDir, 'bg_looped.mp4');
  const clips = selectBackgroundClips(targetDuration);
  await prepareBackground(clips, targetDuration, loopedClip, tempDir);

  // ── Step 3: Grade + watermark + burn subtitles ───────────────────────────
  const gradedPath = path.join(tempDir, 'graded.mp4');
  await applyVisualEffects(loopedClip, subtitlePath, gradedPath);

  // ── Step 4: Mix audio and render ─────────────────────────────────────────
  await mixAndRender({ videoPath: gradedPath, voicePath: audioPath, addMusic, duration: targetDuration, outputPath });

  logger.info(`✅ Final video: ${outputPath}`);
}

// ── Background Clip Selection ─────────────────────────────────────────────────

function selectBackgroundClips(targetDuration) {
  const videosDir = path.join(ASSETS, 'videos');
  if (!fs.existsSync(videosDir)) return [];

  const allClips = fs.readdirSync(videosDir)
    .filter((f) => ['.mp4', '.mov', '.webm'].includes(path.extname(f).toLowerCase()))
    .map((f) => path.join(videosDir, f));

  if (allClips.length === 0) return [];

  const shuffled = allClips.sort(() => Math.random() - 0.5);
  const selected = [];
  let totalEstimated = 0;

  for (const clip of shuffled) {
    selected.push(clip);
    totalEstimated += getClipDuration(clip);
    if (totalEstimated >= targetDuration) break;
  }

  while (totalEstimated < targetDuration) {
    selected.push(shuffled[0]);
    totalEstimated += getClipDuration(shuffled[0]);
  }

  return selected;
}

function getClipDuration(clipPath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${clipPath}"`,
      { encoding: 'utf8' }
    ).trim();
    return parseFloat(out) || 5;
  } catch {
    return 5;
  }
}

// ── Background Preparation ────────────────────────────────────────────────────

async function prepareBackground(clips, targetDuration, outputPath, tempDir) {
  if (clips.length === 0) {
    await generateBrandedBackground(targetDuration, outputPath);
    return;
  }

  if (clips.length === 1) {
    await runFFmpeg([
      '-stream_loop', '-1',
      '-i', clips[0],
      '-t', String(targetDuration),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-an', '-y', outputPath,
    ]);
    return;
  }

  // Multiple clips: normalize and concatenate
  const listPath  = path.join(tempDir, 'concat.txt');
  const normalized = [];

  for (let i = 0; i < clips.length; i++) {
    const normPath = path.join(tempDir, `norm_${i}.mp4`);
    await runFFmpeg([
      '-i', clips[i],
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-an', '-y', normPath,
    ]);
    normalized.push(normPath);
  }

  fs.writeFileSync(listPath, normalized.map((p) => `file '${p}'`).join('\n'));

  await runFFmpeg([
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-t', String(targetDuration),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-an', '-y', outputPath,
  ]);
}

// ── Branded Placeholder Background (no clips) ─────────────────────────────────

async function generateBrandedBackground(duration, outputPath) {
  logger.info('Generating branded dark background (no video clips available)');

  // Deep black (#060400) with subtle amber animated overlay via FFmpeg lavfi
  await runFFmpeg([
    '-f', 'lavfi',
    '-i', `color=c=0x060400:size=1080x1920:rate=30:duration=${duration}`,
    '-f', 'lavfi',
    '-i', `life=s=1080x1920:mold=10:r=30:ratio=0.1:death_color=#C8720A:life_color=#C8720A30:size=1080x1920`,
    '-t', String(duration),
    '-filter_complex',
    '[0:v]format=yuv420p[base];[1:v]scale=1080:1920,format=yuva420p,colorchannelmixer=aa=0.06[overlay];[base][overlay]overlay=0:0[out]',
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-an', '-y', outputPath,
  ]);
}

// ── Visual Effects: Color Grade + Logo + Subtitles ───────────────────────────

async function applyVisualEffects(inputPath, subtitlePath, outputPath) {
  const logoPath = path.join(ASSETS, 'logo', 'iqr_logo.png');
  const hasLogo  = fs.existsSync(logoPath);

  // Escape subtitle path for FFmpeg
  const escapedSubs = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');

  let filterComplex, mapArgs;

  if (hasLogo) {
    filterComplex = [
      `[0:v]curves=preset=strong_contrast,eq=brightness=-0.03:contrast=1.1:saturation=1.05,` +
      `colorbalance=rs=0.05:gs=-0.02:bs=-0.05[graded]`,
      `[graded]ass='${escapedSubs}'[subbed]`,
      `[1:v]scale=180:-1,format=rgba,colorchannelmixer=aa=0.75[logo]`,
      `[subbed][logo]overlay=W-w-30:30[out]`,
    ].join(';');

    mapArgs = ['-i', inputPath, '-i', logoPath, '-filter_complex', filterComplex, '-map', '[out]'];
  } else {
    filterComplex = [
      `[0:v]curves=preset=strong_contrast,eq=brightness=-0.03:contrast=1.1:saturation=1.05,` +
      `colorbalance=rs=0.05:gs=-0.02:bs=-0.05[graded]`,
      `[graded]ass='${escapedSubs}'[out]`,
    ].join(';');

    mapArgs = ['-i', inputPath, '-filter_complex', filterComplex, '-map', '[out]'];
  }

  await runFFmpeg([
    ...mapArgs,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-an', '-y', outputPath,
  ]);
}

// ── Audio Mix + Final Render ──────────────────────────────────────────────────

async function mixAndRender({ videoPath, voicePath, addMusic, duration, outputPath }) {
  const musicDir   = path.join(ASSETS, 'music');
  const musicFiles = fs.existsSync(musicDir)
    ? fs.readdirSync(musicDir).filter((f) => f.match(/\.(mp3|wav|m4a)$/i))
    : [];

  const hasMusic = addMusic && musicFiles.length > 0;

  if (hasMusic) {
    const musicPath = path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)]);
    logger.info(`Mixing with music: ${path.basename(musicPath)}`);

    await runFFmpeg([
      '-i', videoPath,
      '-i', voicePath,
      '-i', musicPath,
      '-t', String(duration),
      '-filter_complex', [
        '[1:a]loudnorm=I=-14:TP=-1:LRA=9,volume=1.0[voice]',
        `[2:a]aloop=loop=-1:size=2e+09,atrim=0:${duration},volume=0.12,afade=t=out:st=${duration - 2}:d=2[music]`,
        '[voice][music]amix=inputs=2:duration=first:dropout_transition=2[audio]',
      ].join(';'),
      '-map', '0:v', '-map', '[audio]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart',
      '-y', outputPath,
    ]);
  } else {
    logger.info('Rendering without background music');

    await runFFmpeg([
      '-i', videoPath,
      '-i', voicePath,
      '-t', String(duration),
      '-filter_complex', '[1:a]loudnorm=I=-14:TP=-1:LRA=9[audio]',
      '-map', '0:v', '-map', '[audio]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart',
      '-y', outputPath,
    ]);
  }
}

// ── FFmpeg Runner ─────────────────────────────────────────────────────────────

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const bin  = process.env.FFMPEG_PATH || 'ffmpeg';
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) return resolve();
      const errLines = stderr.split('\n').slice(-5).join('\n');
      reject(new Error(`FFmpeg exit ${code}:\n${errLines}`));
    });

    proc.on('error', (err) =>
      reject(new Error(`FFmpeg spawn error: ${err.message}. Is ffmpeg installed?`))
    );
  });
}

export { runFFmpeg };
