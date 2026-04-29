/**

- modules/subtitles.js — IQRHQ Professional Style
- White bold text, navy shadow, gold CTA
- Font: Cairo (Arabic support)
  */

import fs from ‘fs’;
import { logger } from ‘./logger.js’;

// ASS colors = &H00BBGGRR
const C = {
white:  ‘&H00FFFFFF’,
gold:   ‘&H004BA8C8’,  // #C8A84B in BGR
navy:   ‘&H00281A0A’,  // dark shadow
black:  ‘&H00000000’,
shadow: ‘&HAA000000’,
};

export function buildSubtitleFile(lines, totalDuration, outputPath) {
logger.info(`Building subtitles: ${lines.length} lines, ${totalDuration}s`);

const timings = distributeTimings(lines, totalDuration);
const content = buildASS(lines, timings);
fs.writeFileSync(outputPath, content, ‘utf8’);
return outputPath;
}

function distributeTimings(lines, total) {
const totalChars = lines.reduce((s, l) => s + l.length, 0);
const start = 0.4;
const available = total - start - 0.3;
let cursor = start;

return lines.map(line => {
const dur = Math.max(1.5, available * (line.length / totalChars));
const s = cursor;
const e = Math.min(cursor + dur, total - 0.1);
cursor = e + 0.05;
return { start: s, end: e };
});
}

function buildASS(lines, timings) {
const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,Cairo,88,${C.white},${C.gold},${C.black},${C.shadow},1,0,0,0,100,100,2,0,1,3,4,2,80,80,220,1
Style: CTA,Cairo,96,${C.gold},${C.white},${C.black},${C.shadow},-1,0,0,0,100,100,2,0,1,3,5,2,80,80,220,1
Style: Small,Cairo,68,${C.white},${C.gold},${C.black},${C.shadow},0,0,0,0,100,100,1,0,1,2,3,2,80,80,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const events = lines.map((line, i) => {
const { start, end } = timings[i];
const isLast = i === lines.length - 1;
const isFirst = i === 0;

```
const style = isLast ? 'CTA' : isFirst ? 'Main' : 'Main';
const fade = '{\\fad(150,100)}';

// Highlight IQRHQ in gold
const processed = line
  .replace(/IQRHQ/g, `{\\c${C.gold}}IQRHQ{\\c${C.white}}`)
  .replace(/info@iqrhq\.me/g, `{\\c${C.gold}}info@iqrhq.me{\\c${C.white}}`);

return `Dialogue: 0,${t(start)},${t(end)},${style},,0,0,0,,${fade}${processed}`;
```

}).join(’\n’);

return header + events;
}

function t(s) {
const h = Math.floor(s / 3600);
const m = Math.floor((s % 3600) / 60);
const sec = s % 60;
const cs = Math.round((sec % 1) * 100);
return `${h}:${String(m).padStart(2,'0')}:${String(Math.floor(sec)).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

export function buildSRTFile(lines, totalDuration, outputPath) {
const timings = distributeTimings(lines, totalDuration);
const content = lines.map((line, i) => {
const { start, end } = timings[i];
return `${i + 1}\n${srt(start)} --> ${srt(end)}\n${line}\n`;
}).join(’\n’);
fs.writeFileSync(outputPath, content, ‘utf8’);
return outputPath;
}

function srt(s) {
const h = Math.floor(s / 3600);
const m = Math.floor((s % 3600) / 60);
const sec = s % 60;
const ms = Math.round((sec % 1) * 1000);
return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(Math.floor(sec)).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}