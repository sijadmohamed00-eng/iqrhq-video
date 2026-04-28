# 🎬 IQRHQ Video Generation System

> AI-powered short-form advertising video generator for IQRHQ — Iraq's leading restaurant management brand.

Automatically generates **15–30 second vertical videos** (Instagram Reels / TikTok style) in Iraqi Arabic, complete with voiceover, burnt-in subtitles, branded visuals, and background music.

---

## ⚡ Quick Start

```bash
# 1. Clone / place project files
cd iqrhq-video-system

# 2. Run setup (creates dirs, checks dependencies, installs packages)
node scripts/setup.js

# 3. Fill in your API keys
nano .env

# 4. Start the server
npm start

# 5. Generate your first video
curl -X POST http://localhost:3000/generate/sync \
  -H "Content-Type: application/json" \
  -d '{"topic": "مطعم يخسر فلوس بسبب الهدر"}'
```

---

## 📋 Prerequisites

| Requirement | Version | Install |
|------------|---------|---------|
| **Node.js** | >= 18.0.0 | [nodejs.org](https://nodejs.org) |
| **FFmpeg** | >= 5.0 | See below |
| **OpenAI API Key** | — | [platform.openai.com](https://platform.openai.com/api-keys) |
| **ElevenLabs Key** | Optional | [elevenlabs.io](https://elevenlabs.io) |

### FFmpeg Installation

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt update && sudo apt install -y ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg

# Verify
ffmpeg -version
```

---

## 📂 Project Structure

```
iqrhq-video-system/
├── server.js                    # Express API server
├── package.json
├── .env.example                 # Copy to .env and fill keys
│
├── modules/
│   ├── script.js                # GPT-4o Iraqi Arabic script generator
│   ├── voice.js                 # ElevenLabs / OpenAI TTS voice synthesis
│   ├── video.js                 # FFmpeg video pipeline (main renderer)
│   ├── subtitles.js             # ASS subtitle builder with brand styling
│   ├── runway.js                # Optional: Runway ML AI video clips
│   └── logger.js                # Structured logger
│
├── scripts/
│   ├── setup.js                 # One-time setup checker
│   ├── test-pipeline.js         # Local pipeline test (no server needed)
│   └── batch-generate.js        # Batch generate multiple videos
│
├── assets/
│   ├── videos/                  ← Add .mp4 background clips here
│   ├── music/                   ← Add royalty-free .mp3 music here
│   └── logo/
│       └── iqr_logo.png         ← Your logo (PNG with transparency)
│
├── output/                      ← Generated MP4 files saved here
└── temp/                        ← Working files (auto-cleaned)
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Required
OPENAI_API_KEY=sk-proj-...

# Recommended (best Arabic voice quality)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB

# Optional
RUNWAY_API_KEY=...
PORT=3000
```

---

## 🌐 API Reference

### `POST /generate` — Async Job (recommended)

Start video generation, returns immediately with a job ID.

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "مطعم يخسر فلوس بسبب الهدر",
    "variation": 1,
    "music": true
  }'
```

**Response:**
```json
{
  "jobId": "a3f2...",
  "message": "Video generation started",
  "statusUrl": "/status/a3f2...",
  "pollInterval": "3s"
}
```

---

### `GET /status/:id` — Poll Job Status

```bash
curl http://localhost:3000/status/a3f2...
```

**Response (running):**
```json
{
  "status": "running",
  "step": "voice_generation",
  "progress": 35
}
```

**Response (done):**
```json
{
  "status": "done",
  "progress": 100,
  "videoUrl": "/output/a3f2....mp4",
  "audioDuration": 18.4,
  "script": {
    "hook": "كل يوم تفتح المطعم وكل يوم نفس الخسارة؟",
    "problem": "...",
    "solution": "...",
    "cta": "...",
    "fullText": "...",
    "subtitleLines": ["...", "..."]
  }
}
```

---

### `POST /generate/sync` — Blocking (for testing)

Waits for the full pipeline to complete before responding. Use for testing only.

```bash
curl -X POST http://localhost:3000/generate/sync \
  -H "Content-Type: application/json" \
  -d '{"topic": "موظفين ما يشتغلون بدون صاحب المطعم"}'
```

---

### `GET /video/:id` — Download Video

```bash
curl -OJ http://localhost:3000/video/a3f2...
```

---

### `POST /hooks` — Generate Hook Variations

Get 5 different hook options for A/B testing.

```bash
curl -X POST http://localhost:3000/hooks \
  -H "Content-Type: application/json" \
  -d '{"topic": "هدر المواد الخام"}'
```

**Response:**
```json
{
  "hooks": [
    "ليش نص مواد مطعمك تروح زبالة؟",
    "كل يوم تخسر ومو عارف مين السبب؟",
    "المطبخ يأكل أرباحك وانت نايم",
    "شلون مطاعم ثانية تربح وانت ما تربح؟",
    "مطعمك ينزف فلوس — وانت ما تحس"
  ]
}
```

---

## 🎨 Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `topic` | string | required | Arabic topic for the ad |
| `variation` | 1\|2\|3 | `1` | Script angle (1=emotional, 2=financial, 3=solution) |
| `music` | boolean | `true` | Add background music |
| `voiceId` | string | env default | Override ElevenLabs voice ID |

---

## 🎬 Adding Background Clips

Place `.mp4` files in `assets/videos/`. The system automatically:
- Selects clips randomly per video
- Trims/loops to match audio duration
- Scales to 1080×1920 (vertical)
- Applies brand color grading

**Recommended clip types:**
- Kitchen operations (cooking, plating)
- Restaurant ambiance (busy dining area)
- Staff working (organized, professional)
- Food close-ups (Iraqi cuisine preferred)

**Where to get royalty-free clips:**
- [Pexels](https://pexels.com/videos) — free
- [Pixabay](https://pixabay.com/videos) — free
- [Storyblocks](https://storyblocks.com) — subscription

---

## 🎵 Adding Background Music

Place `.mp3` files in `assets/music/`. The system:
- Picks a random track per video
- Reduces volume to 12% (voice stays dominant)
- Fades out 2 seconds before end

**Recommended music style:** Ambient, cinematic, dark/tense builds

**Royalty-free sources:**
- [Pixabay Music](https://pixabay.com/music) — free
- [Free Music Archive](https://freemusicarchive.org)
- [Mixkit](https://mixkit.co/free-stock-music)

---

## 🖼️ Logo Setup

Save your logo as `assets/logo/iqr_logo.png`:
- Format: PNG with transparent background
- Recommended size: 300×200px minimum
- Will be placed top-right, 75% opacity

---

## 🖥️ CLI Usage (no server)

```bash
# Single video test
node scripts/test-pipeline.js "مطعم يخسر فلوس بسبب الهدر"

# With variation (1=pain, 2=loss, 3=solution)
node scripts/test-pipeline.js "طلبات بطيئة" 2

# Batch generate campaign videos
node scripts/batch-generate.js

# Batch with parallel generation
node scripts/batch-generate.js --concurrency=2
```

---

## 🎞️ Output Specs

| Property | Value |
|----------|-------|
| Resolution | 1080 × 1920 (9:16 vertical) |
| Duration | 15–30 seconds |
| Format | MP4 (H.264 + AAC) |
| Frame rate | 30fps |
| Audio | 192kbps AAC stereo |
| Subtitles | Burnt-in ASS (Cairo font, bold, centered) |

---

## 🔧 Pipeline Overview

```
POST /generate
     │
     ▼
[1] generateScript()          ← GPT-4o → Iraqi Arabic ad script
     │ hook + problem + solution + CTA + subtitleLines
     ▼
[2] generateVoice()           ← ElevenLabs (or OpenAI TTS fallback)
     │ voiceover.mp3
     ▼
[3] buildSubtitleFile()       ← ASS subtitle with brand styling
     │ subs.ass
     ▼
[4] prepareBackground()       ← Select + scale + concat clips
     │ bg_looped.mp4
     ▼
[5] applyVisualEffects()      ← Color grade + watermark + burn subs
     │ graded.mp4
     ▼
[6] mixAndRender()            ← Voice + music mix → final MP4
     │
     ▼
output/{jobId}.mp4   ✅  Ready to post
```

---

## 🚀 Production Deployment

### Node.js + PM2

```bash
npm install -g pm2
pm2 start server.js --name iqrhq-video --instances 2
pm2 save && pm2 startup
```

### Docker

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t iqrhq-video .
docker run -p 3000:3000 --env-file .env \
  -v $(pwd)/assets:/app/assets \
  -v $(pwd)/output:/app/output \
  iqrhq-video
```

---

## ❓ Troubleshooting

**`ffmpeg: command not found`**
→ Install FFmpeg and ensure it's in your PATH.

**OpenAI API error 429 (rate limit)**
→ Add delays between batch requests or upgrade your OpenAI plan.

**ElevenLabs voice sounds robotic**
→ Try `eleven_multilingual_v2` model and increase `stability` to 0.6.

**Video is portrait but subtitles are off-center**
→ Ensure `PlayResX: 1080` and `PlayResY: 1920` match your output resolution.

**No background clips — dark video**
→ Add `.mp4` files to `assets/videos/`. The dark branded background is a fallback.

---

## 📞 Brand Info

- **Company:** IQRHQ — إدارة وتطوير المطاعم
- **Audience:** Restaurant owners across Iraq
- **Brand Colors:** `#060400` (deep black) + `#C8720A` (amber gold) + `#52B788` (green)
- **Contact:** info@iqrhq.me
