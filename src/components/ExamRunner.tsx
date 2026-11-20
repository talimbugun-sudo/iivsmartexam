import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, AlertTriangle, ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, makeSafeId, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { Attempt, GradedAnswer, Question, Student, TestExam } from '../types';
import { AttemptReviewCard } from './AttemptReviewCard';
import { useToast } from './ToastProvider';

interface ShuffledOption {
  label: string;
  originalIndex: number;
}

interface PreparedQuestion {
  question: Question;
  options: ShuffledOption[];
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface ExamRunnerProps {
  test: TestExam;
  student: Student;
  onExit: () => void;
}

export function ExamRunner({ test, student, onExit }: ExamRunnerProps) {
  const { firebaseUser } = useAuth();
  const { fetchTestQuestions, attempts } = useData();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rawQuestions, setRawQuestions] = useState<Question[]>([]);
  const [prepared, setPrepared] = useState<PreparedQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  // Map of questionId -> originalOptionIndex
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(test.durationMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [finishedAttempt, setFinishedAttempt] = useState<Attempt | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const remainingRef = useRef(remainingSeconds);
  remainingRef.current = remainingSeconds;
  const startedAtRef = useRef<number>(Date.now());
  const sessionId = `${test.id}_${student.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  const priorAttempts = useMemo(
    () =>
      attempts
        .filter((a) => a.testId === test.id && a.studentId === student.id)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()),
    [attempts, test.id, student.id],
  );
  const priorAttemptsRef = useRef(priorAttempts);
  priorAttemptsRef.current = priorAttempts;

  const hasSubmittedRef = useRef(false);

  // Initialize exam ONCE per sessionId (do not re-run when priorAttempts updates after submission!)
  useEffect(() => {
    let active = true;
    hasSubmittedRef.current = false;

    async function init() {
      if (!firebaseUser) return;
      setLoading(true);
      setBlockedReason(null);
      setLimitNotice(null);
      setFinishedAttempt(null);

      try {
        const qs = await fetchTestQuestions(test.id);
        if (!active) return;

        if (qs.length === 0) {
          setBlockedReason('Ushbu testda hali savollar mavjud emas.');
          setLoading(false);
          return;
        }

        setRawQuestions(qs);

        const existingPrior = priorAttemptsRef.current;
        if (existingPrior.length >= test.maxAttempts) {
          if (existingPrior[0]) {
            setLimitNotice(
              `Ushbu testni topshirish limiti (${test.maxAttempts} marta) tugagan. Siz avval ${existingPrior.length} marta topshirgansiz — quyida oxirgi natijangiz, xatolar va tavsiya etilgan mavzular ko‘rsatilgan.`,
            );
            setFinishedAttempt(existingPrior[0]);
          } else {
            setBlockedReason(
              `Ushbu testni topshirish limiti (${test.maxAttempts} marta) tugagan.`,
            );
          }
          setLoading(false);
          return;
        }

        const orderedQs = test.shuffleQuestions ? shuffleArray(qs) : qs;
        const prep: PreparedQuestion[] = orderedQs.map((q) => {
          const opts: ShuffledOption[] = q.options.map((label, idx) => ({
            label,
            originalIndex: idx,
          }));
          return {
            question: q,
            options: test.shuffleOptions ? shuffleArray(opts) : opts,
          };
        });

        let initialAnswers: Record<string, number> = {};
        let initialRemaining = test.durationMinutes * 60;

        // Check existing live_session to resume auto-saved answers if not finished
        const liveRef = doc(db, 'live_sessions', sessionId);
        try {
          const liveSnap = await getDoc(liveRef);
          if (liveSnap.exists()) {
            const d = liveSnap.data();
            if (d.status !== 'finished') {
              if (d.draftAnswers && typeof d.draftAnswers === 'object') {
                initialAnswers = d.draftAnswers as Record<string, number>;
              }
              if (typeof d.remainingSeconds === 'number' && d.remainingSeconds > 0) {
                initialRemaining = d.remainingSeconds;
              }
            }
          }
        } catch {
          // ignore read error if creating fresh
        }

        if (!active) return;
        setPrepared(prep);
        setAnswers(initialAnswers);
        setRemainingSeconds(initialRemaining);
        startedAtRef.current = Date.now();

        // Mark session as 'working' (or 'entered') in Firestore for Live Monitoring
        await setDoc(liveRef, {
          testId: test.id,
          studentId: student.id,
          studentName: student.fullName,
          ...(student.photoUrl ? { studentPhotoUrl: student.photoUrl } : {}),
          groupId: student.groupId,
          groupName: student.groupName,
          studentUid: firebaseUser.uid,
          status: Object.keys(initialAnswers).length > 0 ? 'working' : 'entered',
          answeredCount: Object.keys(initialAnswers).length,
          totalQuestions: prep.length,
          remainingSeconds: initialRemaining,
          draftAnswers: initialAnswers,
          isDemo: Boolean(test.isDemo),
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Exam init error:', err);
        if (active) setBlockedReason('Testni yuklashda xatolik yuz berdi.');
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [firebaseUser, test, student, sessionId, fetchTestQuestions]);

  const syncLiveSession = useCallback(
    async (
      nextAnswers: Record<string, number>,
      nextRemaining: number,
      nextStatus: 'entered' | 'working' | 'finished',
      scoreInfo?: { score: number; percentage: number },
    ) => {
      if (!firebaseUser || prepared.length === 0 || hasSubmittedRef.current) return;
      const liveRef = doc(db, 'live_sessions', sessionId);
      try {
        await setDoc(
          liveRef,
          {
            testId: test.id,
            studentId: student.id,
            studentName: student.fullName,
            ...(student.photoUrl ? { studentPhotoUrl: student.photoUrl } : {}),
            groupId: student.groupId,
            groupName: student.groupName,
            studentUid: firebaseUser.uid,
            status: nextStatus,
            answeredCount: Object.keys(nextAnswers).length,
            totalQuestions: prepared.length,
            remainingSeconds: Math.max(0, Math.round(nextRemaining)),
            draftAnswers: nextAnswers,
            ...(scoreInfo ? { score: scoreInfo.score, percentage: scoreInfo.percentage } : {}),
            isDemo: Boolean(test.isDemo),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.warn('Auto-save sync error:', err);
      }
    },
    [firebaseUser, prepared.length, sessionId, test, student],
  );

  const handleSubmitExam = useCallback(
    async (autoTimedOut = false) => {
      if (!firebaseUser || submitting || hasSubmittedRef.current || prepared.length === 0) return;
      setSubmitting(true);
      hasSubmittedRef.current = true;

      const finalAnswers = answersRef.current;
      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;

      const gradedAnswers: GradedAnswer[] = prepared.map(({ question }) => {
        const selectedIndex = finalAnswers[question.id] ?? -1;
        const isCorrect = selectedIndex === question.correctIndex;
        const earnedPoints = isCorrect ? question.points : 0;
        totalScore += earnedPoints;
        maxScore += question.points;
        if (isCorrect) correctCount += 1;

        return {
          questionId: question.id,
          selectedIndex,
          correctIndex: question.correctIndex,
          isCorrect,
          earnedPoints,
          maxPoints: question.points,
        };
      });

      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const spent = Math.max(1, test.durationMinutes * 60 - remainingRef.current);
      const attemptId = makeSafeId('att');
      const nextAttemptNumber = priorAttemptsRef.current.length + 1;

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'attempts', attemptId), {
          testId: test.id,
          testTitle: test.title,
          subjectId: test.subjectId,
          subjectName: test.subjectName,
          groupId: student.groupId,
          groupName: student.groupName,
          examType: test.examType,
          studentId: student.id,
          studentName: student.fullName,
          ...(student.photoUrl ? { studentPhotoUrl: student.photoUrl } : {}),
          studentUid: firebaseUser.uid,
          score: totalScore,
          maxScore,
          percentage,
          correctCount,
          totalQuestions: prepared.length,
          attemptNumber: nextAttemptNumber,
          durationSpentSeconds: spent,
          answers: gradedAnswers,
          status: 'completed',
          isDemo: Boolean(test.isDemo),
          submittedAt: serverTimestamp(),
        });

        batch.set(
          doc(db, 'live_sessions', sessionId),
          {
            testId: test.id,
            studentId: student.id,
            studentName: student.fullName,
            ...(student.photoUrl ? { studentPhotoUrl: student.photoUrl } : {}),
            groupId: student.groupId,
            groupName: student.groupName,
            studentUid: firebaseUser.uid,
            status: 'finished',
            answeredCount: Object.keys(finalAnswers).length,
            totalQuestions: prepared.length,
            remainingSeconds: Math.max(0, remainingRef.current),
            draftAnswers: finalAnswers,
            score: totalScore,
            percentage,
            isDemo: Boolean(test.isDemo),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await batch.commit();

        setFinishedAttempt({
          id: attemptId,
          testId: test.id,
          testTitle: test.title,
          subjectId: test.subjectId,
          subjectName: test.subjectName,
          groupId: student.groupId,
          groupName: student.groupName,
          examType: test.examType,
          studentId: student.id,
          studentName: student.fullName,
          studentPhotoUrl: student.photoUrl,
          studentUid: firebaseUser.uid,
          score: totalScore,
          maxScore,
          percentage,
          correctCount,
          totalQuestions: prepared.length,
          attemptNumber: nextAttemptNumber,
          durationSpentSeconds: spent,
          answers: gradedAnswers,
          status: 'completed',
          isDemo: Boolean(test.isDemo),
          submittedAt: new Date(),
        });

        showToast(
          autoTimedOut
            ? 'Ajratilgan vaqt tugadi. Test avtomatik yakunlandi!'
            : 'Test muvaffaqiyatli topshirildi va baholandi!',
          'success',
        );
      } catch (err) {
        hasSubmittedRef.current = false;
        handleFirestoreError(err, OperationType.WRITE, `attempts/${attemptId}`);
      } finally {
        setSubmitting(false);
      }
    },
    [firebaseUser, submitting, prepared, test, student, sessionId, showToast],
  );

  // Countdown timer + periodic heartbeat sync
  useEffect(() => {
    if (loading || blockedReason || finishedAttempt || prepared.length === 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam(true);
          return 0;
        }
        const next = prev - 1;
        if (next % 10 === 0) {
          syncLiveSession(
            answersRef.current,
            next,
            Object.keys(answersRef.current).length > 0 ? 'working' : 'entered',
          );
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, blockedReason, finishedAttempt, prepared.length, handleSubmitExam, syncLiveSession]);

  const handleSelectOption = (questionId: string, originalOptionIndex: number) => {
    const next = { ...answers, [questionId]: originalOptionIndex };
    setAnswers(next);
    syncLiveSession(next, remainingSeconds, 'working');
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="surface-card rounded-2xl p-12 text-center max-w-2xl mx-auto">
        <p className="text-sm font-medium text-slate-600">Test savollari yuklanmoqda...</p>
      </div>
    );
  }

  if (finishedAttempt) {
    return (
      <AttemptReviewCard
        attempt={finishedAttempt}
        questions={rawQuestions}
        limitNotice={limitNotice}
        onExit={onExit}
      />
    );
  }

  if (blockedReason) {
    return (
      <div className="surface-card rounded-2xl p-8 max-w-xl mx-auto text-center">
        <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
        <h3 className="font-display text-lg font-bold text-[#09142B] mb-2">Testga kirish cheklangan</h3>
        <p className="text-sm text-slate-600 mb-6">{blockedReason}</p>
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-2 rounded-xl bg-[#061024] text-white text-sm font-semibold cursor-pointer"
        >
          Orqaga qaytish
        </button>
      </div>
    );
  }

  const currentItem = prepared[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const isLowTime = remainingSeconds <= 60;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Exam Control Bar */}
      <div className="navy-architect-grid text-white rounded-2xl p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div className="min-w-0">
          <p className="text-xs text-blue-200/85 truncate">
            {student.fullName} · {student.groupName} · {test.subjectName}
          </p>
          <h2 className="font-display font-bold text-base sm:text-lg truncate">{test.title}</h2>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl ${isLowTime ? 'bg-red-600' : 'bg-white/10 border border-white/15'}`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono-num text-base font-bold">{formatTimer(remainingSeconds)}</span>
          </div>
          <button
            type="button"
            onClick={() => handleSubmitExam(false)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Yuborilmoqda...' : 'Testni yakunlash'}
          </button>
        </div>
      </div>

      {/* Question Navigator Strip */}
      <div className="surface-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {prepared.map((item, idx) => {
            const isAnswered = answers[item.question.id] !== undefined;
            const isActive = idx === currentIdx;
            return (
              <button
                key={item.question.id}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`w-9 h-9 rounded-xl font-mono-num text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#061024] text-white'
                    : isAnswered
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-[#F8FAFD] text-slate-600 border border-[#DCE5F2] hover:bg-slate-100'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 font-mono-num">
          Javob berilgan: {answeredCount} / {prepared.length} (Avtomatik saqlanmoqda)
        </p>
      </div>

      {/* Question Card */}
      {currentItem && (
        <div className="surface-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <span className="font-mono-num text-xs font-semibold text-blue-700">
              Savol {currentIdx + 1} / {prepared.length}
            </span>
            <span className="font-mono-num text-xs font-semibold text-slate-500">
              {currentItem.question.points} ball
            </span>
          </div>

          <h3 className="font-display text-lg font-semibold text-[#09142B] leading-relaxed">
            {currentItem.question.text}
          </h3>

          {currentItem.question.imageUrl && (
            <div className="rounded-2xl border border-[#DCE5F2] overflow-hidden bg-[#F8FAFD] max-w-xl">
              <img
                src={currentItem.question.imageUrl}
                alt="Savol rasmi"
                referrerPolicy="no-referrer"
                className="w-full max-h-80 object-contain"
              />
            </div>
          )}

          <div className="space-y-3">
            {currentItem.options.map((opt, optIdx) => {
              const selected = answers[currentItem.question.id] === opt.originalIndex;
              const letter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || String(optIdx + 1);
              return (
                <button
                  key={opt.originalIndex}
                  type="button"
                  onClick={() => handleSelectOption(currentItem.question.id, opt.originalIndex)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                    selected
                      ? 'border-blue-600 bg-blue-50/70 text-[#09142B] ring-1 ring-blue-600/20'
                      : 'border-[#DCE5F2] hover:border-blue-300 hover:bg-[#F8FAFD] text-slate-800'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl font-mono-num text-xs font-bold flex items-center justify-center shrink-0 ${
                      selected ? 'bg-blue-600 text-white' : 'bg-[#EEF3F9] text-slate-700'
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#DCE5F2] text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Oldingi
            </button>
            {currentIdx < prepared.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.min(prepared.length - 1, i + 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#061024] text-white text-xs font-semibold hover:bg-[#0D1E40] cursor-pointer"
              >
                Keyingi
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmitExam(false)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Yakunlash va topshirish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
