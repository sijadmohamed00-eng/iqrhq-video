/**
 * modules/voice.js — ElevenLabs only (no OpenAI dependency)
 */

import fs   from 'fs';
import https from 'https';
import { logger } from './logger.js';

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

export async function generateVoice(text, outputPath) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');

  logger.info('Generating voice via ElevenLabs...');

  const body = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.82,
      style: 0.35,
      use_speaker_boost: true,
    },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${VOICE_ID}`,
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', d => err += d);
        res.on('end', () => reject(new Error(`ElevenLabs error ${res.statusCode}: ${err}`)));
        return;
      }
      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const dur = estimateDuration(text);
        logger.info(`Voice saved: ${outputPath} (~${dur}s)`);
        resolve(dur);
      });
      file.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function getAudioDuration(audioPath) {
  const { execSync } = await import('child_process');
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
      { encoding: 'utf8' }
    ).trim();
    return parseFloat(out);
  } catch {
    return 18;
  }
}

function estimateDuration(text) {
  const words = text.split(/\s+/).length;
  return Math.ceil((words / 130) * 60);
}
