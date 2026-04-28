/**
 * modules/subtitles.js
 * 
 * Generates .ass subtitle file with modern styling:
 * - Bold, centered, white text with black stroke
 * - Word-by-word timing distributed evenly across audio
 * - IQR brand colors for highlighted words
 */

import fs from 'fs';
import { logger } from './logger.js';

// Brand colors (ASS hex format = &H00BBGGRR)
const COLORS = {
  white:  '&H00FFFFFF',
  amber:  '&H000A72C8',  // #C8720A in BGR
  green:  '&H0088B752',  // #52B788 in BGR
  black:  '&H00000000',
  shadow: '&H80000000',  // semi-transparent black
};

/**
 * Build a .ass subtitle file from script lines + audio duration.
 * @param {string[]} lines         - subtitle lines from script
 * @param {number}   totalDuration - audio duration in seconds
 * @param {string}   outputPath    - where to write .ass file
 * @returns {string} outputPath
 */
export function buildSubtitleFile(lines, totalDuration, outputPath) {
  logger.info(`Building subtitles: ${lines.length} lines over ${totalDuration}s`);

  // Distribute time across lines (weighted by character count)
  const timings = distributeTimings(lines, totalDuration);

  const assContent = buildASSFile(lines, timings);
  fs.writeFileSync(outputPath, assContent, 'utf8');

  logger.info(`Subtitles saved: ${outputPath}`);
  return outputPath;
}

/** ─── Timing Distribution ────────────────────────────────────── */

function distributeTimings(lines, totalDuration) {
  const totalChars = lines.reduce((sum, l) => sum + l.length, 0);
  
  // Reserve 0.3s at start for visual impact before subtitles appear
  const startOffset = 0.3;
  const available = totalDuration - startOffset - 0.2; // 0.2s tail

  let cursor = startOffset;
  return lines.map((line) => {
    const ratio = line.length / totalChars;
    const duration = Math.max(1.2, available * ratio); // min 1.2s per line
    const start = cursor;
    const end = Math.min(cursor + duration, totalDuration - 0.1);
    cursor = end + 0.05; // tiny gap between lines
    return { start, end };
  });
}

/** ─── ASS File Builder ───────────────────────────────────────── */

function buildASSFile(lines, timings) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,Cairo,82,${COLORS.white},${COLORS.amber},${COLORS.black},${COLORS.shadow},1,0,0,0,100,100,0,0,1,4,2,2,60,60,200,1
Style: Highlight,Cairo,82,${COLORS.amber},${COLORS.white},${COLORS.black},${COLORS.shadow},1,0,0,0,100,100,0,0,1,4,2,2,60,60,200,1
Style: CTA,Cairo,88,${COLORS.green},${COLORS.white},${COLORS.black},${COLORS.shadow},-1,0,0,0,100,100,1,0,1,4,3,2,60,60,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = lines.map((line, i) => {
    const { start, end } = timings[i];
    const startStr = formatTime(start);
    const endStr = formatTime(end);
    
    // Last line gets CTA style (green)
    const style = i === lines.length - 1 ? 'CTA' : 'Main';
    
    // Add fade-in/fade-out animation
    const fadeTag = `{\\fad(120,80)}`;
    
    // Highlight IQRHQ brand name in amber
    const processedLine = line
      .replace(/IQRHQ/g, `{\\c${COLORS.amber}}IQRHQ{\\c${COLORS.white}}`)
      .replace(/info@iqrhq\.me/g, `{\\c${COLORS.green}}info@iqrhq.me{\\c${COLORS.white}}`);

    return `Dialogue: 0,${startStr},${endStr},${style},,0,0,0,,${fadeTag}${processedLine}`;
  }).join('\n');

  return header + events;
}

/** ─── SRT Builder (simpler format, use if ASS has issues) ───── */

export function buildSRTFile(lines, totalDuration, outputPath) {
  const timings = distributeTimings(lines, totalDuration);
  
  const content = lines.map((line, i) => {
    const { start, end } = timings[i];
    return `${i + 1}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${line}\n`;
  }).join('\n');

  fs.writeFileSync(outputPath, content, 'utf8');
  return outputPath;
}

/** ─── Time Formatters ────────────────────────────────────────── */

// ASS format: H:MM:SS.cs
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const cs = Math.round((s % 1) * 100);
  const sInt = Math.floor(s);
  return `${h}:${String(m).padStart(2, '0')}:${String(sInt).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// SRT format: HH:MM:SS,mmm
function formatSRTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ms = Math.round((s % 1) * 1000);
  const sInt = Math.floor(s);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sInt).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Build word-level subtitle timing (advanced).
 * Splits each line into words and assigns ~equal time to each.
 */
export function buildWordLevelSubtitles(lines, totalDuration, outputPath) {
  const timings = distributeTimings(lines, totalDuration);
  const allWords = [];

  lines.forEach((line, lineIdx) => {
    const { start, end } = timings[lineIdx];
    const words = line.split(/\s+/).filter(Boolean);
    const wordDuration = (end - start) / words.length;
    words.forEach((word, wordIdx) => {
      allWords.push({
        text: word,
        start: start + wordIdx * wordDuration,
        end: start + (wordIdx + 1) * wordDuration,
      });
    });
  });

  // Build word-level ASS with karaoke highlighting effect
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Cairo,86,${COLORS.white},${COLORS.amber},${COLORS.black},${COLORS.shadow},-1,0,0,0,100,100,2,0,1,4,2,2,60,60,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Group words back into line-size chunks for display
  const WORDS_PER_SCREEN = 4;
  const chunks = [];
  for (let i = 0; i < allWords.length; i += WORDS_PER_SCREEN) {
    const chunk = allWords.slice(i, i + WORDS_PER_SCREEN);
    chunks.push({
      text: chunk.map((w) => w.text).join(' '),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
    });
  }

  const events = chunks.map((chunk) => {
    const s = formatTime(chunk.start);
    const e = formatTime(chunk.end);
    return `Dialogue: 0,${s},${e},Word,,0,0,0,,{\\fad(100,80)}${chunk.text}`;
  }).join('\n');

  fs.writeFileSync(outputPath, header + events, 'utf8');
  return outputPath;
}
