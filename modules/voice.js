/**
 * modules/voice.js
 *
 * Converts Arabic script to realistic voice.
 * Primary:  ElevenLabs (eleven_multilingual_v2 — best Arabic quality)
 * Fallback: OpenAI TTS (onyx voice)
 */

import fs   from 'fs';
import https from 'https';
import OpenAI from 'openai';
import { logger } from './logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ElevenLabs voice IDs
const VOICES = {
  default:        process.env.ELEVENLABS_VOICE_ID       || 'pNInz6obpgDQGcFmaJgB',
  male_arabic:    process.env.ELEVENLABS_VOICE_ARABIC   || 'pNInz6obpgDQGcFmaJgB',
  female_arabic:  process.env.ELEVENLABS_VOICE_ARABIC_F || 'EXAVITQu4vr4xnSDxMaL',
};

/**
 * Generate voice audio from Arabic text.
 * @param {string}      text        - Arabic text to speak
 * @param {string}      outputPath  - Where to save MP3
 * @param {string|null} voiceId     - Override voice ID (optional)
 * @returns {number} estimated duration in seconds
 */
export async function generateVoice(text, outputPath, voiceId = null) {
  const elevenKey = process.env.ELEVENLABS_API_KEY;

  if (elevenKey) {
    logger.info('Using ElevenLabs for voice generation');
    return elevenLabsTTS(text, outputPath, voiceId || VOICES.default, elevenKey);
  }

  logger.info('ElevenLabs key not set — falling back to OpenAI TTS');
  return openaiTTS(text, outputPath);
}

// ── ElevenLabs ────────────────────────────────────────────────────────────────

async function elevenLabsTTS(text, outputPath, voiceId, apiKey) {
  const body = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability:        0.45,
      similarity_boost: 0.82,
      style:            0.35,
      use_speaker_boost: true,
    },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      path:     `/v1/text-to-speech/${voiceId}`,
      method:   'POST',
      headers:  {
        'xi-api-key':     apiKey,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', (d) => (errData += d));
        res.on('end', () =>
          reject(new Error(`ElevenLabs error ${res.statusCode}: ${errData}`))
        );
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        const dur = estimateDuration(text);
        logger.info(`Voice saved: ${outputPath} (~${dur}s)`);
        resolve(dur);
      });
      fileStream.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── OpenAI TTS fallback ───────────────────────────────────────────────────────

async function openaiTTS(text, outputPath) {
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: process.env.OPENAI_TTS_VOICE || 'onyx',
    input: text,
    speed: 1.05,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  const dur = estimateDuration(text);
  logger.info(`Voice saved (OpenAI TTS): ${outputPath} (~${dur}s)`);
  return dur;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Arabic speech ~130 words/min at ad pace */
function estimateDuration(text) {
  const words = text.split(/\s+/).length;
  return Math.ceil((words / 130) * 60);
}

/** Get precise audio duration via ffprobe (requires FFmpeg installed) */
export async function getAudioDuration(audioPath) {
  const { execSync } = await import('child_process');
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
      { encoding: 'utf8' }
    ).trim();
    return parseFloat(out);
  } catch {
    return estimateDuration('');
  }
}
