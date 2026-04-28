/**
 * scripts/test-pipeline.js
 * 
 * Run the full pipeline end-to-end without starting the server.
 * Usage: node scripts/test-pipeline.js [topic]
 * 
 * Examples:
 *   node scripts/test-pipeline.js
 *   node scripts/test-pipeline.js "مطعم يخسر فلوس بسبب الهدر"
 *   node scripts/test-pipeline.js "طلبات بطيئة وزبائن زعلانين" 2
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load .env manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}

import { generateScript } from '../modules/script.js';
import { generateVoice, getAudioDuration } from '../modules/voice.js';
import { buildVideo } from '../modules/video.js';
import { logger } from '../modules/logger.js';
import { v4 as uuidv4 } from 'uuid';

const topic = process.argv[2] || 'مطعم يخسر فلوس بسبب الهدر';
const variation = parseInt(process.argv[3] || '1');

const jobId = uuidv4().slice(0, 8);
const tempDir = path.join(ROOT, 'temp', jobId);
const outputPath = path.join(ROOT, 'output', `test_${jobId}.mp4`);

fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });

console.log('\n🎬 IQRHQ Video Pipeline Test');
console.log('═'.repeat(50));
console.log(`📌 Topic:     ${topic}`);
console.log(`🔢 Variation: ${variation}`);
console.log(`🆔 Job ID:    ${jobId}`);
console.log('═'.repeat(50) + '\n');

async function run() {
  const t0 = Date.now();

  try {
    // ── Step 1: Script ───────────────────────────────────────
    console.log('📝 Step 1/3 — Generating script...');
    const t1 = Date.now();
    const script = await generateScript(topic, variation);
    console.log(`   ✅ Done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    console.log('\n── Generated Script ───────────────────────────────');
    console.log(`🎣 Hook:      ${script.hook}`);
    console.log(`😤 Problem:   ${script.problem}`);
    console.log(`💡 Solution:  ${script.solution}`);
    console.log(`📢 CTA:       ${script.cta}`);
    console.log(`⏱️  Duration:  ~${script.estimatedDurationSeconds}s`);
    console.log(`😤 Tone:      ${script.emotionalTone}`);
    console.log('\n📄 Full Text:');
    console.log(`   "${script.fullText}"`);
    console.log('\n📌 Subtitle Lines:');
    script.subtitleLines.forEach((l, i) => console.log(`   ${i + 1}. ${l}`));
    console.log('───────────────────────────────────────────────────\n');

    // ── Step 2: Voice ────────────────────────────────────────
    console.log('🎙️  Step 2/3 — Generating voiceover...');
    const t2 = Date.now();
    const audioPath = path.join(tempDir, 'voiceover.mp3');
    let audioDuration = await generateVoice(script.fullText, audioPath);

    // Get precise duration via ffprobe
    try {
      const precise = await getAudioDuration(audioPath);
      if (precise > 0) audioDuration = precise;
    } catch {}

    const audioSize = (fs.statSync(audioPath).size / 1024).toFixed(1);
    console.log(`   ✅ Done in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
    console.log(`   📊 Audio: ${audioDuration.toFixed(1)}s, ${audioSize}KB`);

    // ── Step 3: Video ────────────────────────────────────────
    console.log('\n🎞️  Step 3/3 — Building video...');
    const t3 = Date.now();
    await buildVideo({
      script,
      audioPath,
      audioDuration,
      outputPath,
      tempDir,
      addMusic: true,
    });
    console.log(`   ✅ Done in ${((Date.now() - t3) / 1000).toFixed(1)}s`);

    // ── Results ──────────────────────────────────────────────
    const videoSize = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    const totalTime = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('\n' + '═'.repeat(50));
    console.log('🎉 VIDEO READY!');
    console.log('═'.repeat(50));
    console.log(`📁 Output:    ${outputPath}`);
    console.log(`📊 File size: ${videoSize} MB`);
    console.log(`⏱️  Duration:  ${audioDuration.toFixed(1)}s`);
    console.log(`⚡ Total time: ${totalTime}s`);
    console.log('\n✅ Ready to post on Instagram Reels / TikTok!\n');

    // Cleanup temp
    fs.rmSync(tempDir, { recursive: true, force: true });

  } catch (err) {
    console.error('\n❌ Pipeline failed:', err.message);
    if (process.env.LOG_LEVEL === 'debug') console.error(err);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }
}

run();
