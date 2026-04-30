import fs   from 'fs';
import https from 'https';
import { logger } from './logger.js';

var VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

export function generateVoice(text, outputPath) {
  var apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
  logger.info('Generating voice via ElevenLabs...');

  var body = JSON.stringify({
    text: text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.82,
      style: 0.35,
      use_speaker_boost: true,
    },
  });

  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/text-to-speech/' + VOICE_ID,
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    var req = https.request(options, function(res) {
      if (res.statusCode !== 200) {
        var err = '';
        res.on('data', function(d) { err += d; });
        res.on('end', function() { reject(new Error('ElevenLabs error ' + res.statusCode + ': ' + err)); });
        return;
      }
      var file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on('finish', function() {
        file.close();
        var dur = estimateDuration(text);
        logger.info('Voice saved: ' + outputPath + ' (~' + dur + 's)');
        resolve(dur);
      });
      file.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function getAudioDuration(audioPath) {
  return import('child_process').then(function(cp) {
    try {
      var out = cp.execSync(
        'ffprobe -v error -show_entries format=duration -of csv=p=0 "' + audioPath + '"',
        { encoding: 'utf8' }
      ).trim();
      return parseFloat(out);
    } catch (e) {
      return 18;
    }
  });
}

function estimateDuration(text) {
  var words = text.split(/\s+/).length;
  return Math.ceil((words / 130) * 60);
}
