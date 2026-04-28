/**
 * IQRHQ Video Generation System
 * Main Express Server
 * 
 * POST /generate  →  Full video pipeline
 * GET  /status/:id → Job status
 * GET  /video/:id  → Download output video
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { generateScript } from './modules/script.js';
import { generateVoice } from './modules/voice.js';
import { buildVideo } from './modules/video.js';
import { logger } from './modules/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// In-memory job store (use Redis in production)
const jobs = {};

// Serve output videos
app.use('/output', express.static(path.join(__dirname, 'output')));

/**
 * POST /generate
 * Body: { topic, variation?, voiceId?, music? }
 */
app.post('/generate', async (req, res) => {
  const { topic, variation = 1, voiceId, music = true } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'topic is required (Arabic text)' });
  }

  const jobId = uuidv4();
  jobs[jobId] = { status: 'queued', createdAt: new Date().toISOString() };

  // Respond immediately with job ID
  res.status(202).json({
    jobId,
    message: 'Video generation started',
    statusUrl: `/status/${jobId}`,
    pollInterval: '3s',
  });

  // Run pipeline asynchronously
  runPipeline(jobId, topic.trim(), { variation, voiceId, music }).catch((err) => {
    logger.error(`Pipeline failed for job ${jobId}:`, err.message);
    jobs[jobId] = { status: 'failed', error: err.message };
  });
});

/**
 * GET /generate/sync  (blocking — use only for testing)
 */
app.post('/generate/sync', async (req, res) => {
  const { topic, variation = 1, voiceId, music = true } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });

  const jobId = uuidv4();
  try {
    const result = await runPipeline(jobId, topic.trim(), { variation, voiceId, music });
    return res.json({ jobId, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /status/:id
 */
app.get('/status/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/**
 * GET /video/:id  — alias to download
 */
app.get('/video/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== 'done') {
    return res.status(404).json({ error: 'Video not ready' });
  }
  res.download(job.videoPath);
});

/**
 * GET /hooks  — list available hooks for a topic
 */
app.post('/hooks', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  const { generateHooks } = await import('./modules/script.js');
  const hooks = await generateHooks(topic);
  res.json({ hooks });
});

/** ─── Core Pipeline ──────────────────────────────────────────── */

async function runPipeline(jobId, topic, options = {}) {
  const { variation, voiceId, music } = options;
  const tempDir = path.join(__dirname, 'temp', jobId);
  fs.mkdirSync(tempDir, { recursive: true });

  const updateJob = (patch) => {
    jobs[jobId] = { ...jobs[jobId], ...patch };
    logger.info(`[${jobId}] ${patch.status || ''} ${patch.step || ''}`);
  };

  try {
    // ── Step 1: Generate Script ────────────────────────────────
    updateJob({ status: 'running', step: 'script_generation', progress: 10 });
    const script = await generateScript(topic, variation);
    updateJob({ script, step: 'script_done', progress: 25 });

    // ── Step 2: Generate Voice ─────────────────────────────────
    updateJob({ step: 'voice_generation', progress: 30 });
    const audioPath = path.join(tempDir, 'voiceover.mp3');
    const audioDuration = await generateVoice(script.fullText, audioPath, voiceId);
    updateJob({ step: 'voice_done', progress: 55 });

    // ── Step 3: Build Video ────────────────────────────────────
    updateJob({ step: 'video_building', progress: 60 });
    const outputPath = path.join(__dirname, 'output', `${jobId}.mp4`);
    await buildVideo({
      script,
      audioPath,
      audioDuration,
      outputPath,
      tempDir,
      addMusic: music,
    });

    // ── Done ───────────────────────────────────────────────────
    updateJob({
      status: 'done',
      step: 'complete',
      progress: 100,
      videoPath: outputPath,
      videoUrl: `/output/${jobId}.mp4`,
      script: script,
      audioDuration,
      completedAt: new Date().toISOString(),
    });

    return jobs[jobId];

  } catch (err) {
    // Cleanup temp on failure
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
}

/** ─── Start Server ───────────────────────────────────────────── */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🎬 IQRHQ Video System running on http://localhost:${PORT}`);
  logger.info(`   POST /generate     → Start async job`);
  logger.info(`   POST /generate/sync → Blocking (for testing)`);
  logger.info(`   GET  /status/:id   → Poll job status`);
  logger.info(`   GET  /video/:id    → Download video`);
});
