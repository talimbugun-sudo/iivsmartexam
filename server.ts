import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '4mb' }));

const PORT = Number(process.env.PORT) || 3000;

interface AnalyzeRequestBody {
  scope?: 'overall' | 'group' | 'student' | 'subject';
  targetName?: string;
  statsPayload?: {
    attemptsCount: number;
    studentsCount: number;
    groupsCount: number;
    subjectsCount: number;
    averagePercentage: number;
    growthDelta?: number;
    groupsBreakdown?: Array<{ name: string; avgPercentage: number; attemptsCount: number; studentsCount: number }>;
    subjectsBreakdown?: Array<{ name: string; avgPercentage: number; attemptsCount: number }>;
    studentsBreakdown?: Array<{
      fullName: string;
      groupName: string;
      avgPercentage: number;
      growthDelta: number;
      attemptsCount: number;
      weakestSubject?: string;
      strongestSubject?: string;
    }>;
    recentAttempts?: Array<{
      studentName: string;
      subjectName: string;
      testTitle: string;
      percentage: number;
      examType: string;
      submittedAt: string;
    }>;
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'oraliq-nazorat-api' });
});

app.post('/api/auth/verify-admin-pin', (req, res) => {
  const { pin } = (req.body || {}) as { pin?: string };
  const expectedPin = process.env.ADMIN_ACCESS_PIN || '30032002';
  if (typeof pin === 'string' && pin.trim() === expectedPin) {
    res.json({ ok: true });
    return;
  }
  res.status(401).json({ ok: false, error: 'Maxfiy parol noto‘g‘ri! Qayta tekshirib kiriting.' });
});

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiErrorDetails(err: unknown): { code?: number; status?: string; rawMessage: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || 'Noma’lum xatolik');
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { code?: number; message?: string; status?: string };
    };
    if (parsed?.error) {
      return {
        code: parsed.error.code,
        status: parsed.error.status,
        rawMessage: parsed.error.message || rawMessage,
      };
    }
  } catch {
    // Message is not raw JSON; inspect substring / properties
  }
  const errObj = err as { status?: number | string; code?: number };
  return {
    code: typeof errObj?.code === 'number' ? errObj.code : typeof errObj?.status === 'number' ? errObj.status : undefined,
    status: typeof errObj?.status === 'string' ? errObj.status : undefined,
    rawMessage,
  };
}

function toUserFriendlyGeminiError(err: unknown): { httpStatus: number; message: string; code: string } {
  const details = parseGeminiErrorDetails(err);
  const lower = details.rawMessage.toLowerCase();

  if (
    details.code === 403 ||
    details.status === 'PERMISSION_DENIED' ||
    lower.includes('free tier is not available') ||
    lower.includes('permission_denied')
  ) {
    return {
      httpStatus: 403,
      code: 'GEMINI_BILLING_OR_PERMISSION_REQUIRED',
      message:
        'Gemini AI xizmati ushbu loyihada bepul tarifda mavjud emas yoki API kalit ruxsati cheklangan. Davom etish uchun AI Studio’da billing (pullik tarif) yoqilgan API kalitni tanlang yoki Settings > Secrets bo‘limidan GEMINI_API_KEY ni yangilang.',
    };
  }

  if (details.code === 400 && (lower.includes('api_key_invalid') || lower.includes('api key'))) {
    return {
      httpStatus: 400,
      code: 'GEMINI_API_KEY_INVALID',
      message:
        'GEMINI_API_KEY noto‘g‘ri yoki yaroqsiz. Iltimos, Settings > Secrets bo‘limidan API kalitni tekshiring.',
    };
  }

  if (details.code === 429 || details.status === 'RESOURCE_EXHAUSTED' || lower.includes('quota')) {
    return {
      httpStatus: 429,
      code: 'GEMINI_QUOTA_EXCEEDED',
      message:
        'Gemini API so‘rovlar limiti (kvota) tugadi. Birozdan so‘ng qayta urinib ko‘ring yoki Settings > Secrets bo‘limidan billing yoqilgan API kalitni tanlang.',
    };
  }

  if (details.code === 404 || details.status === 'NOT_FOUND') {
    return {
      httpStatus: 404,
      code: 'GEMINI_MODEL_NOT_FOUND',
      message: 'Tanlangan Gemini AI modeli topilmadi yoki qo‘llab-quvvatlanmaydi.',
    };
  }

  return {
    httpStatus: 500,
    code: 'GEMINI_INTERNAL_ERROR',
    message: details.rawMessage || 'AI tahlil xizmatida kutilmagan xatolik yuz berdi.',
  };
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const details = parseGeminiErrorDetails(err);
      const isTransient = details.code === 500 || details.code === 503 || details.code === 504;
      if (!isTransient || attempt === maxAttempts - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const body = req.body as AnalyzeRequestBody;
    const scope = body.scope || 'overall';
    const targetName = body.targetName || 'Umumiy platforma';
    const stats = body.statsPayload;

    if (!stats || !stats.attemptsCount || stats.attemptsCount <= 0) {
      res.status(200).json({
        noData: true,
        message:
          'Tahlil qilish uchun bazada topshirilgan test natijalari mavjud emas. Haqiqiy ma’lumotlar yo‘q bo‘lgani sababli AI taxminiy xulosa chiqarmaydi.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'GEMINI_API_KEY_MISSING',
        error: 'GEMINI_API_KEY server muhitida sozlanmagan. Iltimos, Settings > Secrets bo‘limidan kalitni tekshiring.',
      });
      return;
    }

    const promptText = [
      `Tahlil ko‘lami: ${scope} (${targetName})`,
      'Quyida ma’lumotlar bazasidan olingan HAQIQIY statistika keltirilgan:',
      JSON.stringify(stats, null, 2),
      '',
      'Vazifa:',
      '1. Yuqoridagi raqamlarga qat’iy tayangan holda o‘zlashtirish holatini tahlil qil.',
      '2. O‘sish va pasayish tendensiyalarini aniq foizlar bilan ko‘rsat.',
      '3. Zaif fanlar, pasaygan o‘quvchilar yoki kuchli guruhlarni faktlar bilan ajrat.',
      '4. O‘qituvchi va administratsiya uchun aniq, amaliy pedagogik tavsiyalar ber.',
      'MUHIM: Faqat berilgan JSON ma’lumotlaridan foydalan. Bazada yo‘q ism, fan, guruh yoki raqamni aslo o‘ylab topma.',
    ].join('\n');

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction:
            'Sen O‘zbekistondagi zamonaviy ta’lim muassasasining bosh akademik tahlilchisisiz. Barcha javoblarni faqat adabiy o‘zbek tilida, aniq, rasmiy va pedagogik jihatdan foydali qilib yoz. Bazadagi haqiqiy raqamlardan chetga chiqma.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Umumiy tahliliy xulosa (3-5 jumla, aniq raqamlarga asoslangan).',
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Kuchli tomonlar va ijobiy o‘sish ko‘rsatkichlari.',
              },
              weaknesses: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Zaif fanlar, pasayish kuzatilgan yo‘nalishlar yoki xavf guruhlari.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'O‘qituvchi va rahbariyat uchun aniq amaliy tavsiyalar.',
              },
            },
            required: ['summary', 'strengths', 'weaknesses', 'recommendations'],
          },
        },
      }),
    );

    const rawText = (response.text || '{}').trim();
    const parsed = JSON.parse(rawText);

    res.json({
      noData: false,
      report: {
        summary: String(parsed.summary || ''),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
      },
    });
  } catch (err) {
    console.error('Gemini AI analysis error:', err);
    const friendly = toUserFriendlyGeminiError(err);
    res.status(friendly.httpStatus).json({ error: friendly.message, code: friendly.code });
  }
});

interface StudyPlanRequestBody {
  subjectName?: string;
  testTitle?: string;
  score?: number;
  maxScore?: number;
  percentage?: number;
  wrongQuestions?: Array<{
    questionNumber: number;
    text: string;
    studentAnswer: string;
    correctAnswer: string;
  }>;
}

app.post('/api/ai/study-plan', async (req, res) => {
  try {
    const body = req.body as StudyPlanRequestBody;
    const wrongQuestions = Array.isArray(body.wrongQuestions) ? body.wrongQuestions : [];
    const subjectName = String(body.subjectName || 'Fan');
    const testTitle = String(body.testTitle || 'Test');
    const score = Number(body.score || 0);
    const maxScore = Number(body.maxScore || 0);
    const percentage = Number(body.percentage || 0);

    if (wrongQuestions.length === 0) {
      res.json({
        allCorrect: true,
        summary: `${subjectName} fanidan «${testTitle}» testida barcha savollarga to‘g‘ri javob berdingiz (${score}/${maxScore} ball, ${percentage}%).`,
        topics: [],
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'GEMINI_API_KEY_MISSING',
        error: 'GEMINI_API_KEY server muhitida sozlanmagan. Mavzu tavsiyalarini olish uchun Settings > Secrets bo‘limidan API kalitni tekshiring.',
      });
      return;
    }

    const promptText = [
      `Fan: ${subjectName}`,
      `Test nomi: ${testTitle}`,
      `O‘quvchi natijasi: ${score}/${maxScore} ball (${percentage}%)`,
      '',
      'O‘quvchi xato qilgan savollar ro‘yxati:',
      JSON.stringify(wrongQuestions, null, 2),
      '',
      'Vazifa:',
      '1. O‘quvchi xato qilgan har bir savol yoki o‘xshash savollar guruhi qaysi aniq o‘quv mavzusiga tegishli ekanini aniqla.',
      '2. O‘quvchiga qaysi mavzularni qayta o‘qishi va nimaga e’tibor qaratishi kerakligini sodda, tushunarli o‘zbek tilida tushuntir.',
      '3. Faqat yuqoridagi xato savollarga tayan, boshqa mavzularni o‘ylab topma.',
    ].join('\n');

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction:
            'Sen o‘quvchilarga test xatolarini tahlil qilib, aynan qaysi mavzularni o‘qish kerakligini ko‘rsatadigan tajribali o‘qituvchi-mentorsan. Barcha javoblarni adabiy va tushunarli o‘zbek tilida yoz.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'O‘quvchi uchun qisqa xulosa (2-3 jumla): umumiy ball va asosiy e’tibor qaratiladigan yo‘nalish.',
              },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: {
                      type: Type.STRING,
                      description: 'Qayta o‘qish tavsiya etiladigan aniq mavzu nomi.',
                    },
                    questionNumbers: {
                      type: Type.STRING,
                      description: 'Qaysi savol raqamlariga tegishli ekani (masalan: "2, 5-savollar").',
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'Nima sababdan bu mavzuda xato ketgani va tushuncha izohi.',
                    },
                    advice: {
                      type: Type.STRING,
                      description: 'Mavzuni o‘zlashtirish uchun aniq amaliy maslahat.',
                    },
                  },
                  required: ['topic', 'questionNumbers', 'reason', 'advice'],
                },
                description: 'O‘qish kerak bo‘lgan mavzular ro‘yxati.',
              },
            },
            required: ['summary', 'topics'],
          },
        },
      }),
    );

    const rawText = (response.text || '{}').trim();
    const parsed = JSON.parse(rawText);

    res.json({
      allCorrect: false,
      summary: String(parsed.summary || ''),
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.map((t: Record<string, unknown>) => ({
            topic: String(t.topic || ''),
            questionNumbers: String(t.questionNumbers || ''),
            reason: String(t.reason || ''),
            advice: String(t.advice || ''),
          }))
        : [],
    });
  } catch (err) {
    console.error('Gemini study-plan error:', err);
    const friendly = toUserFriendlyGeminiError(err);
    res.status(friendly.httpStatus).json({ error: friendly.message, code: friendly.code });
  }
});

async function startServer() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORALIQ NAZORAT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
