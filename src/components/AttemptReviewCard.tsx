import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  BookOpenCheck,
  Sparkles,
  AlertCircle,
  Clock,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import type { Attempt, Question } from '../types';

interface StudyTopicRecommendation {
  topic: string;
  questionNumbers: string;
  reason: string;
  advice: string;
}

interface StudyPlanResult {
  allCorrect: boolean;
  summary: string;
  topics: StudyTopicRecommendation[];
}

interface AttemptReviewCardProps {
  attempt: Attempt;
  questions: Question[];
  limitNotice?: string | null;
  onExit: () => void;
}

export function AttemptReviewCard({
  attempt,
  questions,
  limitNotice,
  onExit,
}: AttemptReviewCardProps) {
  const orderedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.order - b.order),
    [questions],
  );

  const gradedRows = useMemo(() => {
    return orderedQuestions.map((q, idx) => {
      const ans = attempt.answers.find((a) => a.questionId === q.id);
      const selectedIndex = ans?.selectedIndex ?? -1;
      const correctIndex = ans?.correctIndex ?? q.correctIndex;
      const isCorrect = ans ? ans.isCorrect : selectedIndex === correctIndex;
      const earnedPoints = ans ? ans.earnedPoints : isCorrect ? q.points : 0;

      return {
        questionNumber: idx + 1,
        question: q,
        selectedIndex,
        correctIndex,
        isCorrect,
        earnedPoints,
        studentAnswerText:
          selectedIndex >= 0 && q.options[selectedIndex]
            ? q.options[selectedIndex]
            : 'Javob belgilanmagan',
        correctAnswerText: q.options[correctIndex] || '—',
      };
    });
  }, [orderedQuestions, attempt.answers]);

  const wrongRows = useMemo(() => gradedRows.filter((r) => !r.isCorrect), [gradedRows]);
  const correctRows = useMemo(() => gradedRows.filter((r) => r.isCorrect), [gradedRows]);

  const [filterTab, setFilterTab] = useState<'wrong' | 'all' | 'correct'>(() =>
    wrongRows.length > 0 ? 'wrong' : 'all',
  );
  const [studyPlan, setStudyPlan] = useState<StudyPlanResult | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);

  // Sync default filter tab if questions arrive after mount
  useEffect(() => {
    if (wrongRows.length > 0) {
      setFilterTab('wrong');
    } else {
      setFilterTab('all');
    }
  }, [wrongRows.length]);

  const fetchStudyPlan = useCallback(async () => {
    if (orderedQuestions.length === 0) return;

    if (wrongRows.length === 0) {
      setStudyPlan({
        allCorrect: true,
        summary: `${attempt.subjectName} fanidan «${attempt.testTitle}» testining barcha savollariga to‘g‘ri javob berdingiz (${attempt.score}/${attempt.maxScore} ball, ${attempt.percentage}%).`,
        topics: [],
      });
      setStudyError(null);
      return;
    }

    setStudyLoading(true);
    setStudyError(null);
    try {
      const res = await fetch('/api/ai/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: attempt.subjectName,
          testTitle: attempt.testTitle,
          score: attempt.score,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          wrongQuestions: wrongRows.map((r) => ({
            questionNumber: r.questionNumber,
            text: r.question.text,
            studentAnswer: r.studentAnswerText,
            correctAnswer: r.correctAnswerText,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Mavzu tavsiyasini yuklashda xatolik.');
      }
      setStudyPlan(data as StudyPlanResult);
    } catch (err) {
      setStudyError(err instanceof Error ? err.message : 'Mavzularni aniqlashda xatolik.');
    } finally {
      setStudyLoading(false);
    }
  }, [attempt, orderedQuestions.length, wrongRows]);

  useEffect(() => {
    fetchStudyPlan();
  }, [fetchStudyPlan]);

  const visibleRows =
    filterTab === 'wrong' ? wrongRows : filterTab === 'correct' ? correctRows : gradedRows;

  const spentMin = Math.floor((attempt.durationSpentSeconds || 0) / 60);
  const spentSec = (attempt.durationSpentSeconds || 0) % 60;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {limitNotice && (
        <div className="surface-card rounded-2xl p-4 border-amber-200 bg-amber-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-950">Urinish limiti tugagan — saqlangan natija</p>
              <p className="text-xs text-amber-800 mt-0.5">{limitNotice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-xs font-semibold text-amber-950 hover:bg-amber-100/60 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Orqaga
          </button>
        </div>
      )}

      {/* Midnight Navy Hero Score Summary */}
      <div className="navy-architect-grid text-white rounded-2xl p-6 sm:p-8 shadow-[0_20px_48px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-blue-300 mb-1">
              {attempt.subjectName} · {attempt.attemptNumber}-urinish natijasi
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              {attempt.testTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {attempt.studentName} · {attempt.groupName}
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-xs font-semibold text-white cursor-pointer self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Kabinetga qaytish
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10">
            <p className="text-xs text-blue-200/80 mb-1">To‘plangan ball</p>
            <p className="font-mono-num text-2xl sm:text-3xl font-extrabold text-white">
              {attempt.score}
              <span className="text-base font-semibold text-slate-400">/{attempt.maxScore}</span>
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10">
            <p className="text-xs text-blue-200/80 mb-1">O‘zlashtirish</p>
            <p className="font-mono-num text-2xl sm:text-3xl font-extrabold text-sky-400">
              {attempt.percentage}%
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10">
            <p className="text-xs text-blue-200/80 mb-1">To‘g‘ri / Xato</p>
            <p className="font-mono-num text-2xl sm:text-3xl font-extrabold">
              <span className="text-emerald-400">{correctRows.length}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className={wrongRows.length > 0 ? 'text-red-400' : 'text-slate-300'}>
                {wrongRows.length}
              </span>
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10">
            <p className="text-xs text-blue-200/80 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Sarflangan vaqt
            </p>
            <p className="font-mono-num text-2xl sm:text-3xl font-extrabold text-white">
              {spentMin}d {spentSec}s
            </p>
          </div>
        </div>
      </div>

      {/* Study Topics Recommendation Panel ("Qaysi mavzuni o'qish kerak?") */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <BookOpenCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base text-[#09142B]">
                Qaysi mavzularni qayta o‘qish kerak?
              </h3>
              <p className="text-xs text-slate-500">
                Xato qilingan savollar asosida shaxsiy o‘quv tavsiyalari
              </p>
            </div>
          </div>

          {wrongRows.length > 0 && (
            <button
              type="button"
              onClick={fetchStudyPlan}
              disabled={studyLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DCE5F2] bg-white hover:bg-slate-50 text-xs font-semibold text-[#09142B] cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              {studyLoading ? 'Tahlil qilinmoqda...' : 'Tavsiyani yangilash'}
            </button>
          )}
        </div>

        <div className="p-6">
          {studyLoading && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <Sparkles className="w-4 h-4" />
                Xato savollar tahlil qilinib, o‘qishingiz kerak bo‘lgan mavzular aniqlanmoqda...
              </div>
              <div className="h-16 rounded-xl bg-[#F8FAFD] border border-[#DCE5F2]" />
              <div className="h-16 rounded-xl bg-[#F8FAFD] border border-[#DCE5F2]" />
            </div>
          )}

          {!studyLoading && studyError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700 flex items-center justify-between gap-3">
              <span>{studyError}</span>
              <button
                type="button"
                onClick={fetchStudyPlan}
                className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-red-700 cursor-pointer shrink-0"
              >
                Qayta urinish
              </button>
            </div>
          )}

          {!studyLoading && !studyError && studyPlan && (
            <div className="space-y-4">
              <p className="text-sm text-[#09142B] leading-relaxed font-medium">
                {studyPlan.summary}
              </p>

              {studyPlan.topics.length > 0 && (
                <div className="divide-y divide-[#DCE5F2] border border-[#DCE5F2] rounded-2xl overflow-hidden bg-[#F8FAFD]">
                  {studyPlan.topics.map((item, i) => (
                    <div key={i} className="p-4 sm:p-5 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-display font-bold text-sm text-[#09142B]">
                          {i + 1}. {item.topic}
                        </h4>
                        <span className="font-mono-num text-xs font-semibold text-blue-700">
                          {item.questionNumbers}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong className="text-slate-800">Nima uchun:</strong> {item.reason}
                      </p>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        <strong className="text-emerald-900">Nima qilish kerak:</strong> {item.advice}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Question-by-Question Error & Correct Answer Breakdown */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD] flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold text-sm sm:text-base text-[#09142B]">
            Savollar va to‘g‘ri javoblar tahlili
          </h3>

          <div className="flex items-center gap-1 p-1 bg-[#EEF3F9] border border-[#DCE5F2] rounded-xl">
            <button
              type="button"
              onClick={() => setFilterTab('wrong')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterTab === 'wrong' ? 'bg-red-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Xatolar ({wrongRows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterTab === 'all' ? 'bg-[#061024] text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Barchasi ({gradedRows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('correct')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterTab === 'correct'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              To‘g‘rilar ({correctRows.length})
            </button>
          </div>
        </div>

        {visibleRows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <div key={row.question.id} className="p-5 sm:p-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {row.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-display font-semibold text-sm sm:text-base text-[#09142B]">
                        {row.questionNumber}. {row.question.text}
                      </p>
                      {row.question.imageUrl && (
                        <img
                          src={row.question.imageUrl}
                          alt="Savol rasmi"
                          referrerPolicy="no-referrer"
                          className="h-32 rounded-xl border border-[#DCE5F2] object-contain bg-[#F8FAFD] mt-2"
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-mono-num text-xs font-bold shrink-0 ${
                      row.isCorrect ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {row.isCorrect ? `+${row.earnedPoints}` : '0'} / {row.question.points} ball
                  </span>
                </div>

                <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div
                    className={`p-3 rounded-xl border ${
                      row.isCorrect
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-red-50/70 border-red-200 text-red-900'
                    }`}
                  >
                    <p className="text-[11px] font-semibold opacity-75 mb-0.5">Sizning javobingiz:</p>
                    <p className="font-semibold">{row.studentAnswerText}</p>
                  </div>

                  {!row.isCorrect && (
                    <div className="p-3 rounded-xl border bg-emerald-50/80 border-emerald-200 text-emerald-900">
                      <p className="text-[11px] font-semibold opacity-75 mb-0.5">To‘g‘ri javob:</p>
                      <p className="font-semibold">{row.correctAnswerText}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-12 text-center">
            {filterTab === 'wrong'
              ? 'Ajoyib! Ushbu testda xato qilingan savollar yo‘q.'
              : 'Bu bo‘limda savollar topilmadi.'}
          </p>
        )}
      </div>
    </div>
  );
}
