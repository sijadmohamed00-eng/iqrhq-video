import fs from 'fs';
import { logger } from './logger.js';

var C = {
  white:  '&H00FFFFFF',
  gold:   '&H004BA8C8',
  black:  '&H00000000',
  shadow: '&HAA000000',
};

export function buildSubtitleFile(lines, totalDuration, outputPath) {
  logger.info('Building subtitles: ' + lines.length + ' lines, ' + totalDuration + 's');
  var timings = distributeTimings(lines, totalDuration);
  var content = buildASS(lines, timings);
  fs.writeFileSync(outputPath, content, 'utf8');
  return outputPath;
}

function distributeTimings(lines, total) {
  var totalChars = lines.reduce(function(s, l) { return s + l.length; }, 0);
  var start = 0.4;
  var available = total - start - 0.3;
  var cursor = start;
  return lines.map(function(line) {
    var dur = Math.max(1.5, available * (line.length / totalChars));
    var s = cursor;
    var e = Math.min(cursor + dur, total - 0.1);
    cursor = e + 0.05;
    return { start: s, end: e };
  });
}

function buildASS(lines, timings) {
  var styleMain = 'Style: Main,Cairo,88,' + C.white + ',' + C.gold + ',' + C.black + ',' + C.shadow + ',1,0,0,0,100,100,2,0,1,3,4,2,80,80,220,1';
  var styleCTA  = 'Style: CTA,Cairo,96,'  + C.gold  + ',' + C.white + ',' + C.black + ',' + C.shadow + ',-1,0,0,0,100,100,2,0,1,3,5,2,80,80,220,1';

  var header = '[Script Info]\n'
    + 'ScriptType: v4.00+\n'
    + 'PlayResX: 1080\n'
    + 'PlayResY: 1920\n'
    + 'ScaledBorderAndShadow: yes\n'
    + '\n'
    + '[V4+ Styles]\n'
    + 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
    + styleMain + '\n'
    + styleCTA  + '\n'
    + '\n'
    + '[Events]\n'
    + 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';

  var events = lines.map(function(line, i) {
    var timing = timings[i];
    var isLast = i === lines.length - 1;
    var style = isLast ? 'CTA' : 'Main';
    var fade = '{\\fad(150,100)}';
    var processed = line
      .replace(/IQRHQ/g,        '{\\c' + C.gold  + '}IQRHQ{\\c'         + C.white + '}')
      .replace(/info@iqrhq\.me/g,'{\\c' + C.gold  + '}info@iqrhq.me{\\c' + C.white + '}');
    return 'Dialogue: 0,' + toTime(timing.start) + ',' + toTime(timing.end) + ',' + style + ',,0,0,0,,' + fade + processed;
  }).join('\n');

  return header + events;
}

function toTime(s) {
  var h  = Math.floor(s / 3600);
  var m  = Math.floor((s % 3600) / 60);
  var sc = s % 60;
  var cs = Math.round((sc % 1) * 100);
  return h + ':' + pad2(m) + ':' + pad2(Math.floor(sc)) + '.' + pad2(cs);
}

function pad2(n) { return String(n).padStart(2, '0'); }

export function buildSRTFile(lines, totalDuration, outputPath) {
  var timings = distributeTimings(lines, totalDuration);
  var content = lines.map(function(line, i) {
    var timing = timings[i];
    return (i + 1) + '\n' + toSRT(timing.start) + ' --> ' + toSRT(timing.end) + '\n' + line + '\n';
  }).join('\n');
  fs.writeFileSync(outputPath, content, 'utf8');
  return outputPath;
}

function toSRT(s) {
  var h  = Math.floor(s / 3600);
  var m  = Math.floor((s % 3600) / 60);
  var sc = s % 60;
  var ms = Math.round((sc % 1) * 1000);
  return pad2(h) + ':' + pad2(m) + ':' + pad2(Math.floor(sc)) + ',' + String(ms).padStart(3, '0');
}
