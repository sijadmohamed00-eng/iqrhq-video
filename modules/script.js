import { logger } from './logger.js';

var GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
var GROQ_MODEL   = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

var BRAND = 'انت كاتب اعلانات عراقي محترف. تكتب لشركة IQRHQ لادارة المطاعم في العراق.'
  + ' الرسالة: مطعمك يستحق نظاماً يشتغل بدونك كل ثانية.'
  + ' الخدمات: تشخيص مجاني، SOPs، تدريب، KPI. البريد: info@iqrhq.me.'
  + ' اللهجة عراقية شعبية 100%. سريع ومثير. المدة 15-20 ثانية. ما تذكر ارقام مالية محددة.';

var HOOKS = [
  'ليش مطعمك يخسر وانت ما تدري؟',
  'كل يوم تفتح المطعم وكل يوم نفس المشكلة؟',
  'مطعم بدون نظام = ماكينة تحرق فلوس',
  'متى اخر مرة طلعت من مطعمك بدون صداع؟',
  'الهدر اللي داخل مطبخك ياكل ارباحك كل يوم',
];

function groqChat(messages, temperature) {
  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  return fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: messages,
      temperature: temperature || 0.85,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  }).then(function(res) {
    if (!res.ok) {
      return res.text().then(function(err) {
        throw new Error('Groq API error ' + res.status + ': ' + err);
      });
    }
    return res.json();
  }).then(function(data) {
    return data.choices[0].message.content;
  });
}

export function generateScript(topic, variation) {
  variation = variation || 1;
  logger.info('Generating script for: "' + topic + '" (variation ' + variation + ')');

  var hints = {
    1: 'زاوية: الالم العاطفي - التعب والارهاق',
    2: 'زاوية: الخسارة المالية والهدر',
    3: 'زاوية: الحل والامل مع IQRHQ',
  };

  var hook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  var hint = hints[variation] || hints[1];

  var prompt = BRAND + '\n\n'
    + 'الموضوع: "' + topic + '"\n'
    + hint + '\n'
    + 'الهوك المقترح: "' + hook + '"\n\n'
    + 'رد بـ JSON فقط بدون اي نص خارجه:\n'
    + '{\n'
    + '  "hook": "جملة واحدة 3 ثواني",\n'
    + '  "problem": "جملتين عن المشكلة",\n'
    + '  "bridge": "جملة انتقال لـ IQRHQ",\n'
    + '  "solution": "جملتين عن الحل",\n'
    + '  "cta": "جملة CTA واحدة",\n'
    + '  "fullText": "النص الكامل للتسجيل",\n'
    + '  "subtitleLines": ["سطر 1","سطر 2","سطر 3","سطر 4","سطر 5"],\n'
    + '  "estimatedDurationSeconds": 18,\n'
    + '  "emotionalTone": "frustrated"\n'
    + '}';

  return groqChat([{ role: 'user', content: prompt }]).then(function(raw) {
    var clean = raw.replace(/```json|```/g, '').trim();
    var script;
    try {
      script = JSON.parse(clean);
    } catch (e) {
      throw new Error('JSON parse failed: ' + raw.slice(0, 200));
    }

    var required = ['hook', 'problem', 'solution', 'cta', 'fullText', 'subtitleLines'];
    required.forEach(function(f) {
      if (!script[f]) throw new Error('Missing field: ' + f);
    });

    if (!Array.isArray(script.subtitleLines)) {
      script.subtitleLines = script.fullText.split('—').map(function(s) { return s.trim(); }).filter(Boolean);
    }

    script.topic = topic;
    script.variation = variation;
    script.generatedAt = new Date().toISOString();
    logger.info('Script ready ~' + script.estimatedDurationSeconds + 's');
    return script;
  });
}

export function generateHooks(topic) {
  var prompt = BRAND + '\nالموضوع: "' + topic + '"\n'
    + 'اكتب 5 هوكات عراقية قصيرة. رد بـ JSON فقط: { "hooks": ["1","2","3","4","5"] }';
  return groqChat([{ role: 'user', content: prompt }], 0.9).then(function(raw) {
    var data = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return data.hooks;
  });
}
