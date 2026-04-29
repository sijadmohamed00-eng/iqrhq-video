/**
 * modules/script.js — Groq version (free)
 */

import { logger } from './logger.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const BRAND_CONTEXT = `
أنت كاتب إعلانات محترف متخصص في المحتوى العراقي على السوشيال ميديا.
تكتب إعلانات لشركة IQRHQ — الشركة الرائدة في إدارة وتطوير المطاعم في العراق.
الرسالة: "مطعمك يستحق نظاماً يشتغل بدونك كل ثانية"
الخدمات: تشخيص مجاني، بناء الأنظمة SOPs، تدريب الفريق، لوحة KPI
البريد: info@iqrhq.me — الجمهور: أصحاب المطاعم في العراق
اللهجة: عراقية شعبية ١٠٠٪ (گ ڤ چ) — سريع، مثير، يضرب على الوجع
المدة: ١٥–٢٠ ثانية — ما تذكر أرقام مالية محددة
`.trim();

const HOOK_TEMPLATES = [
  'ليش مطعمك يخسر وانت ما تدري؟',
  'كل يوم تفتح المطعم وكل يوم نفس المشكلة؟',
  'مطعم بدون نظام = ماكينة تحرق فلوس',
  'متى آخر مرة طلعت من مطعمك بدون صداع؟',
  'الهدر اللي داخل مطبخك يأكل أرباحك كل يوم',
];

async function groqChat(messages, temperature = 0.85) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export async function generateScript(topic, variation = 1) {
  logger.info(`Generating script for: "${topic}" (variation ${variation})`);

  const hints = {
    1: 'زاوية: الألم العاطفي — التعب والإرهاق',
    2: 'زاوية: الخسارة المالية والهدر',
    3: 'زاوية: الحل والأمل مع IQRHQ',
  };

  const hook = HOOK_TEMPLATES[Math.floor(Math.random() * HOOK_TEMPLATES.length)];

  const prompt = `${BRAND_CONTEXT}

الموضوع: "${topic}"
${hints[variation] || hints[1]}
الهوك المقترح: "${hook}"

رد بـ JSON فقط بدون أي نص خارجه:
{
  "hook": "جملة واحدة ٣ ثواني توقف السكرول",
  "problem": "جملتين عن المشكلة",
  "bridge": "جملة انتقال لـ IQRHQ",
  "solution": "جملتين عن الحل",
  "cta": "جملة واحدة CTA",
  "fullText": "النص الكامل للتسجيل الصوتي متصل",
  "subtitleLines": ["سطر ١", "سطر ٢", "سطر ٣", "سطر ٤", "سطر ٥"],
  "estimatedDurationSeconds": 18,
  "emotionalTone": "frustrated"
}`;

  const raw = await groqChat([{ role: 'user', content: prompt }]);
  const clean = raw.replace(/```json|```/g, '').trim();

  let script;
  try {
    script = JSON.parse(clean);
  } catch {
    throw new Error(`JSON parse failed: ${raw.slice(0, 200)}`);
  }

  for (const f of ['hook','problem','solution','cta','fullText','subtitleLines']) {
    if (!script[f]) throw new Error(`Missing field: ${f}`);
  }

  if (!Array.isArray(script.subtitleLines)) {
    script.subtitleLines = script.fullText.split('—').map(s => s.trim()).filter(Boolean);
  }

  script.topic = topic;
  script.variation = variation;
  script.generatedAt = new Date().toISOString();

  logger.info(`Script ready ~${script.estimatedDurationSeconds}s`);
  return script;
}

export async function generateHooks(topic) {
  const prompt = `${BRAND_CONTEXT}
الموضوع: "${topic}"
اكتب ٥ هوكات عراقية قصيرة. رد بـ JSON فقط: { "hooks": ["١","٢","٣","٤","٥"] }`;

  const raw = await groqChat([{ role: 'user', content: prompt }], 0.9);
  const { hooks } = JSON.parse(raw.replace(/```json|```/g, '').trim());
  return hooks;
}
