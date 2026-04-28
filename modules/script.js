/**
 * modules/script.js
 * 
 * Generates short-form ad scripts in Iraqi Arabic dialect.
 * Each script has: hook, problem, solution, CTA, and subtitle cues.
 */

import OpenAI from 'openai';
import { logger } from './logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Brand Context injected into every prompt ────────────────────
const BRAND_CONTEXT = `
أنت كاتب إعلانات محترف متخصص في المحتوى العراقي على السوشيال ميديا.
تكتب إعلانات لشركة IQRHQ — الشركة الرائدة في إدارة وتطوير المطاعم في العراق.

معلومات أساسية عن IQRHQ:
- الاسم: IQ = العراق، RHQ = Restaurant Headquarters
- الرسالة الرئيسية: "مطعمك يستحق نظاماً يشتغل بدونك كل ثانية"
- الخدمات: تشخيص المطاعم، بناء الأنظمة (SOPs)، تدريب الفريق، لوحة KPI، تحسين تجربة الزبون، افتتاح مطاعم جديدة
- التشخيص الأول: مجاني تماماً
- البريد: info@iqrhq.me
- الجمهور: أصحاب المطاعم في العراق — من بغداد وكل المحافظات
- الأسلوب: واقعي، مباشر، بالعراقي الصريح — مو لغة رسمية ومو تقارير

قواعد الكتابة:
- اللهجة: عراقية شعبية ١٠٠٪ (گ = ك، ڤ = ف، چ = ج)
- الأسلوب: سريع، مثير، يضرب على الوجع
- الهوك: أول ٣ ثواني لازم تخلي الواحد يوقف السكرول
- المدة الكلية: ١٥–٢٠ ثانية نص مقروء بصوت عالي
- ما تذكر أرقام ربح أو نسب مئوية محددة — بس وصف عاطفي وواقعي
`.trim();

// ── Hook Templates (randomized) ────────────────────────────────
const HOOK_TEMPLATES = [
  'ليش مطعمك يخسر وانت ما تدري؟',
  'كل يوم تفتح المطعم وكل يوم نفس المشكلة؟',
  'صاحب المطعم اللي ما عنده نظام — يشتغل مجاناً!',
  'لو مطعمك يمشي بيك انت شخصياً — المشكلة مو الموظفين',
  'الهدر اللي داخل مطبخك يأكل أرباحك كل يوم',
  'متى آخر مرة طلعت من مطعمك بدون صداع؟',
  'مطعم بدون نظام = ماكينة تحرق فلوس',
  'شلون مطاعم ثانية تربح وانت تخسر؟',
];

/**
 * Generate a complete ad script for a given topic.
 * @param {string} topic  - Arabic topic string
 * @param {number} variation - 1, 2, or 3 for different angle
 * @returns {ScriptObject}
 */
export async function generateScript(topic, variation = 1) {
  logger.info(`Generating script for: "${topic}" (variation ${variation})`);

  const variationHints = {
    1: 'زاوية: الألم العاطفي لصاحب المطعم — التعب والإرهاق',
    2: 'زاوية: الخسارة المالية والهدر — الفلوس اللي تمشي بدون ما تحس',
    3: 'زاوية: الحل والأمل — كيف IQRHQ يغير الوضع',
  };

  const hint = variationHints[variation] || variationHints[1];
  const hook = HOOK_TEMPLATES[Math.floor(Math.random() * HOOK_TEMPLATES.length)];

  const prompt = `
${BRAND_CONTEXT}

الموضوع المطلوب: "${topic}"
الزاوية: ${hint}
الهوك المقترح (يمكن تعديله): "${hook}"

اكتب سكريبت إعلان فيديو قصير بالعراقي لـ IQRHQ.

المطلوب بالضبط — رد بـ JSON فقط بهذا الشكل:
{
  "hook": "جملة واحدة تستمر ٣ ثواني — توقف السكرول",
  "problem": "توصيف المشكلة بجملتين — يحسس الواحد إنهم يعرفونه",
  "bridge": "جملة انتقال لـ IQRHQ — طبيعية مو إعلانية",
  "solution": "شو يسوي IQRHQ — جملتين بالأكثر، واضحة وعملية",
  "cta": "دعوة للتصرف — جملة واحدة قوية",
  "fullText": "النص الكامل مرتب للتسجيل الصوتي — فقرة واحدة متصلة",
  "subtitleLines": [
    "سطر ١ — كلمات قليلة تظهر مع الصوت",
    "سطر ٢",
    "سطر ٣",
    "سطر ٤",
    "سطر ٥"
  ],
  "estimatedDurationSeconds": 18,
  "emotionalTone": "frustrated|urgent|hopeful|empowering"
}

تأكد:
- fullText مكتوب كأنك تحچي — مو كأنك تكتب مقال
- subtitleLines: كل سطر ٢–٥ كلمات بالأكثر
- مجموع النص الكامل يُقرأ خلال ١٥–٢٢ ثانية
- ما تذكر أرقام مالية محددة أو نسب
- لا تكتب أي شيء خارج الـ JSON
`.trim();

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.85,
    max_tokens: 800,
  });

  const raw = response.choices[0].message.content;
  let script;
  try {
    script = JSON.parse(raw);
  } catch {
    throw new Error(`Script JSON parse failed: ${raw.slice(0, 200)}`);
  }

  // Validate required fields
  const required = ['hook', 'problem', 'solution', 'cta', 'fullText', 'subtitleLines'];
  for (const field of required) {
    if (!script[field]) throw new Error(`Script missing field: ${field}`);
  }

  // Ensure subtitleLines is array
  if (!Array.isArray(script.subtitleLines)) {
    script.subtitleLines = script.fullText.split('—').map((s) => s.trim()).filter(Boolean);
  }

  script.topic = topic;
  script.variation = variation;
  script.generatedAt = new Date().toISOString();

  logger.info(`Script ready. Estimated duration: ${script.estimatedDurationSeconds}s`);
  return script;
}

/**
 * Generate 3 hook variations for a topic (for A/B testing).
 * @param {string} topic
 * @returns {string[]}
 */
export async function generateHooks(topic) {
  const prompt = `
${BRAND_CONTEXT}

الموضوع: "${topic}"

اكتب ٥ هوكات مختلفة بالعراقي لفيديو إعلاني قصير — كل هوك جملة واحدة ٢–٤ ثواني.
الهوك لازم يوقف السكرول ويحچي بالوجع مباشرةً.

رد بـ JSON فقط:
{ "hooks": ["هوك ١", "هوك ٢", "هوك ٣", "هوك ٤", "هوك ٥"] }
`.trim();

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.9,
    max_tokens: 300,
  });

  const { hooks } = JSON.parse(res.choices[0].message.content);
  return hooks;
}
