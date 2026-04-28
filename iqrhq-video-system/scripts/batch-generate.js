/**
 * scripts/batch-generate.js
 * 
 * Generate multiple videos from a list of topics.
 * Great for content calendars and campaign bursts.
 * 
 * Usage:
 *   node scripts/batch-generate.js
 *   node scripts/batch-generate.js --concurrency 2
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load .env
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k && v && !process.env[k]) process.env[k] = v;
  }
}

import { generateScript } from '../modules/script.js';
import { generateVoice, getAudioDuration } from '../modules/voice.js';
import { buildVideo } from '../modules/video.js';
import { v4 as uuidv4 } from 'uuid';

// ── Campaign Topics ───────────────────────────────────────────
// Customize this list for your content calendar
const CAMPAIGN_TOPICS = [
  { topic: 'مطعم يخسر فلوس بسبب الهدر', variation: 1 },
  { topic: 'طلبات بطيئة وزبائن زعلانين', variation: 1 },
  { topic: 'موظفين ما يشتغلون بدون صاحب المطعم', variation: 2 },
  { topic: 'مطعم بدون نظام محاسبة واضح', variation: 1 },
  { topic: 'خسارة المواد الخام بدون رقابة', variation: 3 },
  { topic: 'إدارة مطعم من بعيد بدون قلق', variation: 3 },
];

const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '1');

async function generateOne(item, index) {
  const jobId = uuidv4().slice(0, 8);
  const tempDir = path.join(ROOT, 'temp', jobId);
  const outputDir = path.join(ROOT, 'output', 'batch');
  const outputPath = path.join(outputDir, `video_${String(index + 1).padStart(2, '0')}_${jobId}.mp4`);

  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n[${index + 1}/${CAMPAIGN_TOPICS.length}] 🎬 "${item.topic}"`);

  try {
    const script = await generateScript(item.topic, item.variation || 1);
    console.log(`   ✅ Script ready | Hook: "${script.hook}"`);

    const audioPath = path.join(tempDir, 'voice.mp3');
    let duration = await generateVoice(script.fullText, audioPath);
    try { duration = (await getAudioDuration(audioPath)) || duration; } catch {}
    console.log(`   ✅ Voice ready | ${duration.toFixed(1)}s`);

    await buildVideo({ script, audioPath, audioDuration: duration, outputPath, tempDir, addMusic: true });
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`   ✅ Video saved | ${sizeMB}MB → ${path.basename(outputPath)}`);

    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: true, topic: item.topic, outputPath };
  } catch (err) {
    console.error(`   ❌ Failed: ${err.message}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: false, topic: item.topic, error: err.message };
  }
}

async function runBatch() {
  console.log('\n🎬 IQRHQ Batch Video Generator');
  console.log('═'.repeat(50));
  console.log(`📋 Topics: ${CAMPAIGN_TOPICS.length}`);
  console.log(`⚡ Concurrency: ${CONCURRENCY}`);
  console.log('═'.repeat(50));

  const results = [];
  const t0 = Date.now();

  // Process in chunks based on concurrency
  for (let i = 0; i < CAMPAIGN_TOPICS.length; i += CONCURRENCY) {
    const chunk = CAMPAIGN_TOPICS.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map((item, j) => generateOne(item, i + j)));
    results.push(...chunkResults);
  }

  const totalTime = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  const succeeded = results.filter(r => r.success).length;

  console.log('\n' + '═'.repeat(50));
  console.log('📊 BATCH COMPLETE');
  console.log('═'.repeat(50));
  console.log(`✅ Succeeded: ${succeeded}/${results.length}`);
  console.log(`⏱️  Total time: ${totalTime} minutes`);
  console.log(`📁 Output: ${path.join(ROOT, 'output', 'batch')}`);

  if (results.some(r => !r.success)) {
    console.log('\n❌ Failed:');
    results.filter(r => !r.success).forEach(r => console.log(`   • ${r.topic}: ${r.error}`));
  }
}

runBatch().catch(console.error);
