import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { buildSubtitleFile } from './subtitles.js';
import { logger } from './logger.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var ROOT = path.join(__dirname, '..');

export function buildVideo(opts) {
  var script       = opts.script;
  var audioPath    = opts.audioPath;
  var audioDuration= opts.audioDuration;
  var outputPath   = opts.outputPath;
  var tempDir      = opts.tempDir;
  var addMusic     = opts.addMusic !== false;

  logger.info('Building video. Duration: ' + audioDuration + 's');
  var duration = Math.min(Math.max(audioDuration + 0.5, 15), 35);

  var subtitlePath = path.join(tempDir, 'subs.ass');
  buildSubtitleFile(script.subtitleLines, audioDuration, subtitlePath);

  var bgPath = path.join(tempDir, 'background.mp4');
  var gradedPath = path.join(tempDir, 'graded.mp4');

  return generateBackground(duration, bgPath)
    .then(function() { return burnSubtitles(bgPath, subtitlePath, gradedPath); })
    .then(function() { return mixAudio(gradedPath, audioPath, duration, outputPath, addMusic); })
    .then(function() { logger.info('Video ready: ' + outputPath); });
}

function generateBackground(duration, outputPath) {
  logger.info('Generating IQRHQ branded background...');
  var W = 1080, H = 1920, fps = 30;

  return runFFmpeg([
    '-f', 'lavfi', '-i', 'color=c=0x0A1628:size=' + W + 'x' + H + ':rate=' + fps + ':duration=' + duration,
    '-f', 'lavfi', '-i', 'color=c=0xC8A84B:size=' + W + 'x6:rate=' + fps + ':duration=' + duration,
    '-f', 'lavfi', '-i', 'color=c=0xC8A84B:size=' + W + 'x6:rate=' + fps + ':duration=' + duration,
    '-f', 'lavfi', '-i', 'color=c=0x1E4080:size=6x' + H + ':rate=' + fps + ':duration=' + duration,
    '-f', 'lavfi', '-i', 'color=c=0x1E4080:size=6x' + H + ':rate=' + fps + ':duration=' + duration,
    '-filter_complex',
      '[0][1]overlay=0:0[v1];'
      + '[v1][2]overlay=0:' + (H - 6) + '[v2];'
      + '[v2][3]overlay=0:0[v3];'
      + '[v3][4]overlay:' + (W - 6) + ':0[vout]',
    '-map', '[vout]',
    '-t', String(duration),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-an', '-y', outputPath,
  ]);
}

function burnSubtitles(inputPath, subtitlePath, outputPath) {
  var escaped = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
  return runFFmpeg([
    '-i', inputPath,
    '-vf', "ass='" + escaped + "'",
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-an', '-y', outputPath,
  ]);
}

function mixAudio(videoPath, voicePath, duration, outputPath, addMusic) {
  var musicDir = path.join(ROOT, 'assets', 'music');
  var musicFiles = fs.existsSync(musicDir)
    ? fs.readdirSync(musicDir).filter(function(f) { return /\.(mp3|wav|m4a)$/i.test(f); })
    : [];

  if (addMusic && musicFiles.length > 0) {
    var musicPath = path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)]);
    return runFFmpeg([
      '-i', videoPath, '-i', voicePath, '-i', musicPath,
      '-t', String(duration),
      '-filter_complex',
        '[1:a]loudnorm=I=-14:TP=-1:LRA=9[voice];'
        + '[2:a]aloop=loop=-1:size=2e+09,atrim=0:' + duration + ',volume=0.10,afade=t=out:st=' + (duration - 2) + ':d=2[music];'
        + '[voice][music]amix=inputs=2:duration=first[audio]',
      '-map', '0:v', '-map', '[audio]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart', '-y', outputPath,
    ]);
  }

  return runFFmpeg([
    '-i', videoPath, '-i', voicePath,
    '-t', String(duration),
    '-filter_complex', '[1:a]loudnorm=I=-14:TP=-1:LRA=9[audio]',
    '-map', '0:v', '-map', '[audio]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', '-y', outputPath,
  ]);
}

function runFFmpeg(args) {
  return new Promise(function(resolve, reject) {
    var bin = process.env.FFMPEG_PATH || 'ffmpeg';
    var proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    var stderr = '';
    proc.stderr.on('data', function(d) { stderr += d.toString(); });
    proc.on('close', function(code) {
      if (code === 0) return resolve();
      reject(new Error('FFmpeg exit ' + code + ':\n' + stderr.split('\n').slice(-5).join('\n')));
    });
    proc.on('error', function(err) { reject(new Error('FFmpeg spawn: ' + err.message)); });
  });
}

export { runFFmpeg };
