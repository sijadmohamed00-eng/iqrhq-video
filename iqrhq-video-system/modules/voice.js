/**
 * modules/voice.js
 * 
 * Converts Arabic script to realistic voice using ElevenLabs.
 * Falls back to OpenAI TTS if ElevenLabs key not set.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import OpenAI from 'openai';
import { logger } from './logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ElevenLabs Arabic-capable voices
// Replace these IDs with actual ElevenLabs voice IDs from your account
const ELEVENLABS_VOICES = {
  default: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam
  male_arabic: process.env.ELEVENLABS_VOICE_ARABIC || 'pNInz6obpgDQGcFmaJgB',
  female_arabic: process.env.ELEVENLABS_VOICE_ARABIC_F || 'EXAVITQu4vr4xnSDxMaL',
};

/**
 * Generate voice audio from text.
 * @param {string} text  - Arabic text to speak
 * @param {string} outputPath - Where to save MP3
 * @param {string|null} voiceId - Override voice ID
 * @returns {number} duration in seconds (estimated)
 */
export async function generateVoice(text, outputPath, voiceId = null) {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (elevenLabsKey) {
    logger.info('Using ElevenLabs for voice generation');
    return await elevenLabsTTS(text, outputPath, voiceId || ELEVENLABS_VOICES.default, elevenLabsKey);
  } else {
    logger.info('ElevenLabs key not set — falling back to OpenAI TTS');
    return await openaiTTS(text, outputPath);
  }
}

/** ─── ElevenLabs ─────────────────────────────────────────────── */

async function elevenLabsTTS(text, outputPath, voiceId, apiKey) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const body = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.45,        // Slightly varied — more expressive
      similarity_boost: 0.82,
      style: 0.35,            // Some style exaggeration for ads
      use_speaker_boost: true,
    },
  });

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(url, options, (res) => {
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
        const duration = estimateDuration(text);
        logger.info(`Voice saved: ${outputPath} (~${duration}s)`);
        resolve(duration);
      });
      fileStream.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** ─── OpenAI TTS Fallback ────────────────────────────────────── */

async function openaiTTS(text, outputPath) {
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: process.env.OPENAI_TTS_VOICE || 'onyx', // Onyx has deepest voice — closest to Arabic broadcaster
    input: text,
    speed: 1.05, // Slightly faster for ad style
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  const duration = estimateDuration(text);
  logger.info(`Voice saved (OpenAI TTS): ${outputPath} (~${duration}s)`);
  return duration;
}

/** ─── Utility ────────────────────────────────────────────────── */

/**
 * Rough duration estimate: Arabic speech ~120–140 words/min at ad pace.
 * Arabic "word" on average = 4 chars.
 */
function estimateDuration(text) {
  const wordCount = text.split(/\s+/).length;
  const wpm = 130; // words per minute — ad pace Arabic
  return Math.ceil((wordCount / wpm) * 60);
}

/**
 * Get precise audio duration using ffprobe.
 * Call this AFTER ffmpeg is installed and audio is saved.
 */
export async function getAudioDuration(audioPath) {
  const { execSync } = await import('child_process');
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
      { encoding: 'utf8' }
    ).trim();
    return parseFloat(out);
  } catch {
    return estimateDuration(''); // fallback
  }
}
