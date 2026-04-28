/**
 * scripts/setup.js
 * 
 * Run once: node scripts/setup.js
 * Creates all required directories and validates environment.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('\n🎬 IQRHQ Video System — Setup\n' + '═'.repeat(45));

// ── 1. Create directory structure ────────────────────────────
const dirs = [
  'assets/videos',
  'assets/music',
  'assets/logo',
  'output',
  'temp',
  'scripts',
];

console.log('\n📁 Creating directories...');
for (const dir of dirs) {
  const full = path.join(ROOT, dir);
  fs.mkdirSync(full, { recursive: true });
  console.log(`   ✅ ${dir}`);
}

// ── 2. Check .env ────────────────────────────────────────────
console.log('\n🔑 Checking .env...');
const envPath = path.join(ROOT, '.env');
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(path.join(ROOT, '.env.example'), envPath);
  console.log('   ⚠️  .env created from .env.example — PLEASE FILL IN YOUR API KEYS');
} else {
  console.log('   ✅ .env found');
}

// ── 3. Load .env ─────────────────────────────────────────────
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  envVars[key.trim()] = rest.join('=').trim();
}

// ── 4. Validate API Keys ─────────────────────────────────────
console.log('\n🔐 Validating API keys...');

const openaiKey = envVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
if (openaiKey && openaiKey.startsWith('sk-')) {
  console.log('   ✅ OPENAI_API_KEY — set');
} else {
  console.log('   ❌ OPENAI_API_KEY — missing or invalid (required!)');
}

const elevenKey = envVars.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';
if (elevenKey) {
  console.log('   ✅ ELEVENLABS_API_KEY — set (best Arabic voice)');
} else {
  console.log('   ⚠️  ELEVENLABS_API_KEY — not set (will use OpenAI TTS fallback)');
}

// ── 5. Check FFmpeg ──────────────────────────────────────────
console.log('\n🎞️  Checking FFmpeg...');
try {
  const ffmpegVersion = execSync('ffmpeg -version 2>&1', { encoding: 'utf8' });
  const versionLine = ffmpegVersion.split('\n')[0];
  console.log(`   ✅ FFmpeg found: ${versionLine.slice(0, 60)}`);
} catch {
  console.log('   ❌ FFmpeg NOT found!');
  console.log('      Install instructions:');
  console.log('      macOS:   brew install ffmpeg');
  console.log('      Ubuntu:  sudo apt install ffmpeg');
  console.log('      Windows: https://ffmpeg.org/download.html');
}

// ── 6. Check Node version ────────────────────────────────────
console.log('\n🟢 Checking Node.js...');
const nodeVersion = process.version;
const major = parseInt(nodeVersion.slice(1));
if (major >= 18) {
  console.log(`   ✅ Node.js ${nodeVersion} (>= 18 required)`);
} else {
  console.log(`   ❌ Node.js ${nodeVersion} — need >= 18.0.0`);
}

// ── 7. Check assets ──────────────────────────────────────────
console.log('\n🎬 Checking assets...');
const videosDir = path.join(ROOT, 'assets/videos');
const videoFiles = fs.readdirSync(videosDir).filter(f => f.match(/\.(mp4|mov|webm)$/i));
if (videoFiles.length > 0) {
  console.log(`   ✅ Background videos: ${videoFiles.length} file(s)`);
} else {
  console.log('   ⚠️  No background videos — system will use generated dark background');
  console.log('      Add .mp4 files to assets/videos/ for better results');
  console.log('      Recommended: kitchen clips, food shots, restaurant ambience');
}

const musicDir = path.join(ROOT, 'assets/music');
const musicFiles = fs.readdirSync(musicDir).filter(f => f.match(/\.(mp3|wav|m4a)$/i));
if (musicFiles.length > 0) {
  console.log(`   ✅ Background music: ${musicFiles.length} file(s)`);
} else {
  console.log('   ⚠️  No background music — videos will have voice only');
  console.log('      Add royalty-free .mp3 files to assets/music/');
}

const logoDir = path.join(ROOT, 'assets/logo');
const logoFiles = fs.readdirSync(logoDir).filter(f => f.match(/\.(png|svg)$/i));
if (logoFiles.length > 0) {
  console.log(`   ✅ Logo: ${logoFiles[0]}`);
} else {
  console.log('   ⚠️  No logo found — save your logo as assets/logo/iqr_logo.png');
}

// ── 8. Install dependencies ──────────────────────────────────
console.log('\n📦 Installing npm dependencies...');
try {
  execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  console.log('   ✅ Dependencies installed');
} catch {
  console.log('   ❌ npm install failed — run manually');
}

// ── Summary ──────────────────────────────────────────────────
console.log('\n' + '═'.repeat(45));
console.log('🚀 Setup complete!\n');
console.log('Next steps:');
console.log('  1. Edit .env and add your API keys');
console.log('  2. Add background clips to assets/videos/');
console.log('  3. Add background music to assets/music/');
console.log('  4. Add your logo to assets/logo/iqr_logo.png');
console.log('  5. Run: npm start');
console.log('  6. Test: node scripts/test-pipeline.js\n');
