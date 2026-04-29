/**
 * modules/subtitles.js
 *
 * Generates .ass subtitle file with brand styling:
 * - Bold Cairo font, centered, white text with black stroke
 * - Evenly distributed timing across audio duration
 * - IQRHQ brand colors: amber gold + green for CTA
 */

import fs from 'fs';
import { logger } from './logger.js';

// Brand colors in ASS hex format = &H00BBGGRR
const COLORS = {
  white:  '&H00FFFFFF',
  amber:  '&H000A72C8',   // #C8720A in BGR
  green:  '&H0088B752',   // #52B788 in BGR
  black:  '&H00000000',
  shadow: '&H80000000',   // semi-transparent black
};

/**
 * Build an .ass subtitle file from script lines + audio duration.
 * @param {string[]} lines        - subtitle lines from script object
 * @param {number}   totalDuration - total audio duration in seconds
 * @param {string}   outputPath   - where to write .ass file
 * @returns {string} outputPath
 */
export function buildSubtitleFile(lines, totalDuration, outputPath) {
  logger.info(`Building subtitles: ${lines.length} lines over ${totalDuration}s`);

  const timings  = distributeTimings(lines, totalDuration);
  const assContent = buildASSFile(lines, timings);
  fs.writeFileSync(outputPath, assContent, 'utf8');

  logger.info(`Subtitles saved: ${outputPath}`);
  return outputPath;
}

// ── Timing Distribution ───────────────────────────────────────────────────────

function distributeTimings(lines, totalDuration) {
  const totalChars = lines.reduce((sum, l) => sum + l.length, 0);
  const startOffset = 0.3;
  const available   = totalDuration - startOffset - 0.2;

  let cursor = startOffset;
  return lines.map((line) => {
    const ratio    = line.length / totalChars;
    const duration = Math.max(1.2, available * ratio);
    const start    = cursor;
    const end      = Math.min(cursor + duration, totalDuration - 0.1);
    cursor = end + 0.05;
    return { start, end };
  });
}

// ── ASS File Builder ──────────────────────────────────────────────────────────

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
    const endStr   = formatTime(end);

    // Last line gets CTA style (green)
    const style = i === lines.length - 1 ? 'CTA' : 'Main';

    // Fade-in/fade-out animation
    const fadeTag = '{\\fad(120,80)}';

    // Highlight brand name in amber
    const processedLine = line
      .replace(/IQRHQ/g,        `{\\c${COLORS.amber}}IQRHQ{\\c${COLORS.white}}`)
      .replace(/info@iqrhq\.me/g, `{\\c${COLORS.green}}info@iqrhq.me{\\c${COLORS.white}}`);

    return `Dialogue: 0,${startStr},${endStr},${style},,0,0,0,,${fadeTag}${processedLine}`;
  }).join('\n');

  return header + events;
}

// ── Time Formatters ───────────────────────────────────────────────────────────

// ASS format: H:MM:SS.cs
function formatTime(seconds) {
  const h   = Math.floor(seconds / 3600);
  const m   = Math.floor((seconds % 3600) / 60);
  const s   = seconds % 60;
  const cs  = Math.round((s % 1) * 100);
  const sInt = Math.floor(s);
  return `${h}:${String(m).padStart(2, '0')}:${String(sInt).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// SRT format: HH:MM:SS,mmm  (exported for optional use)
export function buildSRTFile(lines, totalDuration, outputPath) {
  const timings = distributeTimings(lines, totalDuration);
  const content = lines.map((line, i) => {
    const { start, end } = timings[i];
    return `${i + 1}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${line}\n`;
  }).join('\n');
  fs.writeFileSync(outputPath, content, 'utf8');
  return outputPath;
}

function formatSRTTime(seconds) {
  const h   = Math.floor(seconds / 3600);
  const m   = Math.floor((seconds % 3600) / 60);
  const s   = seconds % 60;
  const ms  = Math.round((s % 1) * 1000);
  const sInt = Math.floor(s);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sInt).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
