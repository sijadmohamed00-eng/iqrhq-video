import path from 'path';
import fs   from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { generateScript } from '../modules/script.js';
import { generateVoice, getAudioDuration } from '../modules/voice.js';
import { buildVideo } from '../modules/video.js';
import { logger } from '../modules/logger.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var ROOT = path.join(__dirname, '..');

function resolveTopic() {
  if (process.env.TOPIC && process.env.TOPIC.trim()) {
    return { topic: process.env.TOPIC.trim(), variation: parseInt(process.env.VARIATION || '1') };
  }
  var demos = [
    'مطعم يخسر فلوس بسبب الهدر',
    'موظفين ما يشتغلون بدون صاحب المطعم',
    'طلبات بطيئة وزبائن زعلانين',
  ];
  var topic = demos[Math.floor(Math.random() * demos.length)];
  logger.info('No topic — using demo: "' + topic + '"');
  return { topic: topic, variation: 1 };
}

async function main() {
  var resolved  = resolveTopic();
  var topic     = resolved.topic;
  var variation = resolved.variation;
  var jobId     = uuidv4().slice(0, 8);
  var tempDir   = path.join(ROOT, 'temp', jobId);
  var outputDir = path.join(ROOT, 'output');

  fs.mkdirSync(tempDir,   { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  var safeTitle = topic
    .replace(/[^\u0600-\u06FF\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);

  var outputPath = path.join(outputDir, safeTitle + '_' + jobId + '.mp4');

  console.log('\n=== IQRHQ Video Pipeline ===');
  console.log('Topic:     ' + topic);
  console.log('Variation: ' + variation);
  console.log('Job ID:    ' + jobId);
  console.log('===========================\n');

  var t0 = Date.now();

  try {
    console.log('Step 1/3 — Generating script...');
    var script = await generateScript(topic, variation);
    console.log('Hook:     ' + script.hook);
    console.log('Full:     ' + script.fullText);

    console.log('\nStep 2/3 — Generating voice...');
    var audioPath = path.join(tempDir, 'voice.mp3');
    var audioDuration = await generateVoice(script.fullText, audioPath);
    try {
      var precise = await getAudioDuration(audioPath);
      if (precise > 0) audioDuration = precise;
    } catch (e) {}

    fs.copyFileSync(audioPath, path.join(outputDir, safeTitle + '_' + jobId + '.mp3'));
    console.log('Duration: ' + audioDuration.toFixed(1) + 's');

    console.log('\nStep 3/3 — Building video...');
    await buildVideo({
      script: script,
      audioPath: audioPath,
      audioDuration: audioDuration,
      outputPath: outputPath,
      tempDir: tempDir,
      addMusic: true,
    });

    var scriptPath = path.join(outputDir, safeTitle + '_' + jobId + '_script.json');
    fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf8');

    var videoSize = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    var totalTime = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('\n=== DONE ===');
    console.log('MP4:  output/' + path.basename(outputPath));
    console.log('Size: ' + videoSize + ' MB');
    console.log('Time: ' + totalTime + 's');

    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, 'job_id=' + jobId + '\n');
      fs.appendFileSync(process.env.GITHUB_OUTPUT, 'duration=' + audioDuration.toFixed(1) + '\n');
    }

  } catch (err) {
    console.error('Pipeline failed:', err.message);
    process.exit(1);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
