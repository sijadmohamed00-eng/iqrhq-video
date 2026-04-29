/**
 * scripts/generate.js
 *
 * Main entry point for GitHub Actions.
 * Reads topic from:  1) TOPIC env var  2) requests/pending.json  3) default demo topic
 *
 * Usage:
 *   TOPIC="مطعم يخسر فلوس" VARIATION=1 node scripts/generate.js
 */

import path from 'path';
import fs   from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import { generateScript } from '../modules/script.js';
import { generateVoice, getAudioDuration } from '../modules/voice.js';
import { buildVideo } from '../modules/video.js';
import { logger } from '../modules/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Resolve topic ─────────────────────────────────────────────────────────────

function resolveTopic() {
  // 1. Environment variable (set by GitHub Actions workflow_dispatch input)
  if (process.env.TOPIC && process.env.TOPIC.trim()) {
    return { topic: process.env.TOPIC.trim(), variation: parseInt(process.env.VARIATION || '1') };
  }

  // 2. requests/pending.json (for automated queue)
  const pendingPath = path.join(ROOT, 'requests', 'pending.json');
  if (fs.existsSync(pendingPath)) {
    try {
      const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
      if (Array.isArray(pending) && pending.length > 0) {
        const next = pending[0];
        // Remove the processed request
        fs.writeFileSync(pendingPath, JSON.stringify(pending.slice(1), null, 2));
        return { topic: next.topic, variation: next.variation || 1 };
      }
    } catch (e) {
      logger.warn(`Could not parse pending.json: ${e.message}`);
    }
  }

  // 3. Default demo topic
  const demos = [
    'مطعم يخسر فلوس بسبب الهدر',
    'موظفين ما يشتغلون بدون صاحب المطعم',
    'طلبات بطيئة وزبائن زعلانين',
    'مطعم بدون نظام يخسر بدون ما يحس',
  ];
  const topic = demos[Math.floor(Math.random() * demos.length)];
  logger.info(`No topic provided — using demo: "${topic}"`);
  return { topic, variation: 1 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { topic, variation } = resolveTopic();
  const jobId   = uuidv4().slice(0, 8);
  const tempDir = path.join(ROOT, 'temp', jobId);
  const outputDir = path.join(ROOT, 'output');

  fs.mkdirSync(tempDir,   { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  // Sanitize topic for filename
  const safeTitle = topic
    .replace(/[^\u0600-\u06FF\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);

  const outputPath = path.join(outputDir, `${safeTitle}_${jobId}.mp4`);

  console.log('\n🎬 IQRHQ Video Pipeline — GitHub Actions');
  console.log('═'.repeat(52));
  console.log(`📌 Topic:     ${topic}`);
  console.log(`🔢 Variation: ${variation}`);
  console.log(`🆔 Job ID:    ${jobId}`);
  console.log('═'.repeat(52) + '\n');

  const t0 = Date.now();

  try {
    // ── Step 1: Script ──────────────────────────────────────────────────────
    console.log('📝 Step 1/3 — Generating script...');
    const t1 = Date.now();
    const script = await generateScript(topic, variation);
    console.log(`   ✅ Done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    console.log(`\n   🎣 Hook:    ${script.hook}`);
    console.log(`   😤 Problem: ${script.problem}`);
    console.log(`   💡 Bridge:  ${script.bridge || '—'}`);
    console.log(`   🔧 Solution:${script.solution}`);
    console.log(`   📢 CTA:     ${script.cta}`);
    console.log(`\n   📄 Full text:\n   "${script.fullText}"`);
    console.log('\n   📌 Subtitle lines:');
    script.subtitleLines.forEach((l, i) => console.log(`      ${i + 1}. ${l}`));

    // ── Step 2: Voice ───────────────────────────────────────────────────────
    console.log('\n🎙️  Step 2/3 — Generating voiceover...');
    const t2 = Date.now();
    const audioPath = path.join(tempDir, 'voiceover.mp3');
    let audioDuration = await generateVoice(script.fullText, audioPath);

    // Get precise duration via ffprobe if available
    try {
      const precise = await getAudioDuration(audioPath);
      if (precise > 0) audioDuration = precise;
    } catch {}

    const audioSize = (fs.statSync(audioPath).size / 1024).toFixed(1);
    console.log(`   ✅ Done in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
    console.log(`   📊 Audio: ${audioDuration.toFixed(1)}s  |  ${audioSize} KB`);

    // Also save audio separately as artifact
    fs.copyFileSync(audioPath, path.join(outputDir, `${safeTitle}_${jobId}.mp3`));

    // ── Step 3: Video ───────────────────────────────────────────────────────
    console.log('\n🎞️  Step 3/3 — Building video...');
    const t3 = Date.now();
    await buildVideo({ script, audioPath, audioDuration, outputPath, tempDir, addMusic: true });
    console.log(`   ✅ Done in ${((Date.now() - t3) / 1000).toFixed(1)}s`);

    // ── Save script JSON ────────────────────────────────────────────────────
    const scriptPath = path.join(outputDir, `${safeTitle}_${jobId}_script.json`);
    fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf8');

    // ── Summary ─────────────────────────────────────────────────────────────
    const videoSize = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    const totalTime = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('\n' + '═'.repeat(52));
    console.log('🎉 VIDEO READY!');
    console.log('═'.repeat(52));
    console.log(`📁 MP4:       output/${path.basename(outputPath)}`);
    console.log(`🎵 MP3:       output/${safeTitle}_${jobId}.mp3`);
    console.log(`📋 Script:    output/${safeTitle}_${jobId}_script.json`);
    console.log(`📊 File size: ${videoSize} MB`);
    console.log(`⏱️  Duration:  ${audioDuration.toFixed(1)}s`);
    console.log(`⚡ Total time: ${totalTime}s`);
    console.log('\n✅ Download from the GitHub Actions artifacts tab!\n');

    // GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `video_file=${path.basename(outputPath)}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `duration=${audioDuration.toFixed(1)}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `job_id=${jobId}\n`);
    }

  } catch (err) {
    console.error('\n❌ Pipeline failed:', err.message);
    if (process.env.LOG_LEVEL === 'debug') console.error(err.stack);
    process.exit(1);
  } finally {
    // Cleanup temp directory
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main();
