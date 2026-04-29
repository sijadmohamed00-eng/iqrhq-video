# 🎬 IQRHQ Video Generation System

> يولد فيديوهات إعلانية قصيرة بالعراقي — يشتغل مجاناً من GitHub Actions بدون أي سيرفر.

---

## ⚡ طريقة الاستخدام

### 1. أضف الـ API Keys كـ Secrets

اذهب لـ **Settings → Secrets and variables → Actions → New repository secret** وأضف:

| Secret | القيمة |
|--------|--------|
| `OPENAI_API_KEY` | مفتاح OpenAI |
| `ELEVENLABS_API_KEY` | مفتاح ElevenLabs |
| `ELEVENLABS_VOICE_ID` | `pNInz6obpgDQGcFmaJgB` (أو صوت ثاني) |
| `ELEVENLABS_VOICE_ARABIC_F` | `EXAVITQu4vr4xnSDxMaL` (صوت أنثى — اختياري) |

### 2. شغّل الـ Workflow

- اذهب لـ **Actions → Generate IQRHQ Video**
- اضغط **Run workflow**
- اكتب الموضوع بالعربي واختار الزاوية
- اضغط **Run workflow** (الأخضر)

### 3. حمّل الفيديو

بعد ~2-3 دقائق، اذهب للـ run واضغط على **Artifacts** وحمّل الملف.

---

## 🎨 الزوايا الثلاث

| رقم | الزاوية | متى تستخدمها |
|-----|---------|--------------|
| 1 | الألم العاطفي | تعب صاحب المطعم وإرهاقه |
| 2 | الخسارة المالية | الهدر والفلوس اللي تروح |
| 3 | الحل والأمل | كيف IQRHQ يحل المشكلة |

---

## 📂 هيكل المشروع

```
iqrhq-video-system/
├── .github/
│   └── workflows/
│       └── generate-video.yml    ← الـ workflow الرئيسي
├── modules/
│   ├── script.js                 ← توليد السكريبت (GPT-4o)
│   ├── voice.js                  ← توليد الصوت (ElevenLabs / OpenAI TTS)
│   ├── video.js                  ← تجميع الفيديو (FFmpeg)
│   ├── subtitles.js              ← ملف الترجمة (.ass)
│   └── logger.js                 ← لوغر بسيط
├── scripts/
│   └── generate.js               ← نقطة الدخول الرئيسية
├── assets/
│   ├── videos/                   ← ضع هنا كليبات .mp4 (اختياري)
│   ├── music/                    ← ضع هنا موسيقى .mp3 (اختياري)
│   └── logo/
│       └── iqr_logo.png          ← شعار IQRHQ (اختياري)
├── requests/
│   └── pending.json              ← قائمة انتظار الطلبات
└── output/                       ← الفيديوهات (لا تُرفع على GitHub)
```

---

## 🖼️ إضافة كليبات خلفية

ضع ملفات `.mp4` في `assets/videos/` وارفعها على GitHub.

النظام يختار كليبات عشوائية ويحوّلها لـ 1080×1920 (عمودي).

بدون كليبات → يولد خلفية سوداء بألوان IQRHQ تلقائياً.

---

## 🎵 إضافة موسيقى

ضع ملفات `.mp3` في `assets/music/` وارفعها على GitHub.

النظام يخفف الموسيقى لـ 12% ويحافظ على الصوت واضح.

---

## 📊 مواصفات الفيديو

| خاصية | القيمة |
|--------|--------|
| الدقة | 1080 × 1920 (9:16 عمودي) |
| المدة | 15–30 ثانية |
| الصيغة | MP4 (H.264 + AAC) |
| الترجمة | ASS محروقة، خط Cairo، مركزية |
| الألوان | أسود `#060400` + ذهبي `#C8720A` + أخضر `#52B788` |

---

## ✅ حدود الاستخدام المجاني

GitHub Actions يعطيك **2000 دقيقة/شهر** مجاناً.
كل فيديو يأخذ ~2-3 دقائق = **~600-1000 فيديو بالشهر مجاناً**.
