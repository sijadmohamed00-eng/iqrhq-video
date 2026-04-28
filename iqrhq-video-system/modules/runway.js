/**
 * modules/runway.js
 * 
 * Optional: Generate cinematic video clips using Runway ML Gen-3 API.
 * Falls back gracefully if RUNWAY_API_KEY not set.
 * 
 * Usage: import { generateRunwayClip } from './runway.js';
 */

import fs from 'fs';
import https from 'https';
import { logger } from './logger.js';

const RUNWAY_API_URL = process.env.RUNWAY_API_URL || 'https://api.runwayml.com/v1';

/**
 * Generate a short video clip via Runway ML.
 * @param {string} prompt   - Scene description in English (Runway works best with English)
 * @param {string} savePath - Where to save the downloaded .mp4
 * @param {number} duration - 5 or 10 seconds
 * @returns {string} savePath
 */
export async function generateRunwayClip(prompt, savePath, duration = 5) {
  const apiKey = process.env.RUNWAY_API_KEY;

  if (!apiKey) {
    logger.warn('RUNWAY_API_KEY not set — skipping AI clip generation');
    return null;
  }

  logger.info(`Generating Runway clip: "${prompt.slice(0, 60)}..."`);

  // ── Step 1: Create generation task ───────────────────────
  const taskId = await createTask(prompt, duration, apiKey);
  logger.info(`Runway task created: ${taskId}`);

  // ── Step 2: Poll until complete ───────────────────────────
  const videoUrl = await pollTask(taskId, apiKey);
  logger.info(`Runway clip ready: ${videoUrl}`);

  // ── Step 3: Download ──────────────────────────────────────
  await downloadFile(videoUrl, savePath);
  logger.info(`Runway clip saved: ${savePath}`);

  return savePath;
}

/** ─── Runway API Calls ───────────────────────────────────────── */

async function createTask(prompt, duration, apiKey) {
  // Translate restaurant-relevant prompts to cinematic English
  const cinematicPrompt = enhancePrompt(prompt);

  const body = JSON.stringify({
    model: 'gen3a_turbo',
    promptText: cinematicPrompt,
    duration,
    ratio: '720:1280', // Vertical 9:16
    watermark: false,
  });

  return new Promise((resolve, reject) => {
    const url = new URL('/v1/image_to_video', RUNWAY_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.id) reject(new Error(`Runway error: ${data}`));
          else resolve(json.id);
        } catch (e) {
          reject(new Error(`Runway parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function pollTask(taskId, apiKey, maxWait = 120) {
  const startTime = Date.now();

  while ((Date.now() - startTime) / 1000 < maxWait) {
    await sleep(3000);

    const status = await getTaskStatus(taskId, apiKey);

    if (status.status === 'SUCCEEDED') {
      return status.output?.[0];
    }

    if (status.status === 'FAILED') {
      throw new Error(`Runway task failed: ${JSON.stringify(status.failure)}`);
    }

    logger.debug(`Runway task ${taskId}: ${status.status} (${status.progress || 0}%)`);
  }

  throw new Error(`Runway task timed out after ${maxWait}s`);
}

function getTaskStatus(taskId, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(RUNWAY_API_URL).hostname,
      path: `/v1/tasks/${taskId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse error: ${data}`)); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, savePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(savePath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

/** ─── Prompt Enhancement ────────────────────────────────────── */

// Map Arabic restaurant topics to cinematic English prompts
const PROMPT_LIBRARY = {
  waste: 'Close-up cinematic shot of restaurant kitchen, food waste, chef looking frustrated, dramatic moody lighting, dark background, 4K',
  orders: 'Busy restaurant kitchen, orders piling up, stressed staff, fast-paced, cinematic, warm amber lighting',
  profit: 'Empty restaurant with few customers, owner looking worried at register, moody dark atmosphere, cinematic',
  training: 'Professional restaurant manager training staff, organized kitchen, clean bright environment, confident team',
  system: 'Modern restaurant dashboard on tablet, organized kitchen behind, professional atmosphere, brand amber tones',
  success: 'Happy restaurant owner looking at phone with good results, profitable busy restaurant, warm lighting',
};

function enhancePrompt(prompt) {
  const lower = prompt.toLowerCase();

  if (lower.includes('waste') || lower.includes('هدر')) return PROMPT_LIBRARY.waste;
  if (lower.includes('order') || lower.includes('طلب')) return PROMPT_LIBRARY.orders;
  if (lower.includes('profit') || lower.includes('ربح') || lower.includes('خسار')) return PROMPT_LIBRARY.profit;
  if (lower.includes('train') || lower.includes('تدريب')) return PROMPT_LIBRARY.training;
  if (lower.includes('system') || lower.includes('نظام')) return PROMPT_LIBRARY.system;
  if (lower.includes('success') || lower.includes('نجاح')) return PROMPT_LIBRARY.success;

  return `Professional restaurant scene, cinematic dark moody lighting, Iraqi cuisine restaurant, amber warm tones, 4K vertical video`;
}

/** ─── Batch Clip Generation ─────────────────────────────────── */

/**
 * Generate multiple clips for a video project.
 * @param {string[]} scenes  - Array of scene descriptions
 * @param {string}   tempDir - Directory to save clips
 * @returns {string[]} Array of saved clip paths
 */
export async function generateBatchClips(scenes, tempDir) {
  const results = [];

  for (let i = 0; i < scenes.length; i++) {
    const clipPath = `${tempDir}/runway_clip_${i}.mp4`;
    try {
      const saved = await generateRunwayClip(scenes[i], clipPath, 5);
      if (saved) results.push(saved);
    } catch (err) {
      logger.warn(`Runway clip ${i} failed: ${err.message} — skipping`);
    }
  }

  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
