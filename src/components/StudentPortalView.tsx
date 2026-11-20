import React, { useEffect, useMemo, useState } from 'react';
import { UserCheck, Play, TrendingUp, Award, BookOpen, LogOut, Eye } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { PENDING_STUDENT_ENTRY_KEY, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { computeStudentSummaries, formatExamTypeUz, formatUzDate } from '../lib/analytics';
import type { Attempt, Question, TestExam } from '../types';
import { AttemptReviewCard } from './AttemptReviewCard';
import { Avatar } from './Avatar';
import { ExamRunner } from './ExamRunner';
import { useToast } from './ToastProvider';

export function StudentPortalView() {
  const {
    profile,
    linkedStudentId,
    setLinkedStudentId,
    enterStudentByNameAndGroup,
    pendingExamTestId,
    clearPendingExamTest,
  } = useAuth();
  const { students, groups, tests, attempts, loading, fetchTestQuestions } = useData();
  const { showToast } = useToast();

  const [fullNameInput, setFullNameInput] = useState(profile?.displayName || '');
  const [groupInput, setGroupInput] = useState('');
  const [entering, setEntering] = useState(false);
  const [runningTest, setRunningTest] = useState<TestExam | null>(null);
  const [reviewingAttempt, setReviewingAttempt] = useState<{
    attempt: Attempt;
    questions: Question[];
  } | null>(null);

  // Auto-complete student entry if user entered Name & Group on LoginScreen before Google popup
  useEffect(() => {
    if (loading || linkedStudentId || groups.length === 0) return;
    const raw = sessionStorage.getItem(PENDING_STUDENT_ENTRY_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { fullName?: string; groupName?: string };
      sessionStorage.removeItem(PENDING_STUDENT_ENTRY_KEY);
      if (parsed.fullName && parsed.groupName) {
        setFullNameInput(parsed.fullName);
        setGroupInput(parsed.groupName);
        enterStudentByNameAndGroup(parsed.fullName, parsed.groupName, groups, students).then(
          (res) => {
            if (res.ok) {
              showToast('O‘quvchi kabineti ochildi.', 'success');
            } else if (res.error) {
              showToast(res.error, 'error');
            }
          },
        );
      }
    } catch {
      sessionStorage.removeItem(PENDING_STUDENT_ENTRY_KEY);
    }
  }, [loading, linkedStudentId, groups, students, enterStudentByNameAndGroup, showToast]);

  const activeStudent = useMemo(
    () => students.find((s) => s.id === linkedStudentId) || null,
    [students, linkedStudentId],
  );

  // Immediately launch the exam selected on LoginScreen ("shu bilan imtihon boshlansin")
  useEffect(() => {
    if (!pendingExamTestId || !activeStudent || tests.length === 0) return;
    const targetTest = tests.find((t) => t.id === pendingExamTestId);
    if (targetTest) {
      setRunningTest(targetTest);
      clearPendingExamTest();
    }
  }, [pendingExamTestId, activeStudent, tests, clearPendingExamTest]);

  const studentSummary = useMemo(() => {
    if (!activeStudent) return null;
    const all = computeStudentSummaries([activeStudent], attempts);
    return all[0] || null;
  }, [activeStudent, attempts]);

  const availableTests = useMemo(() => {
    if (!activeStudent) return [];
    const attemptedIds = new Set(
      attempts.filter((a) => a.studentId === activeStudent.id).map((a) => a.testId),
    );
    return tests.filter(
      (t) =>
        (t.status === 'active' && t.groupIds.includes(activeStudent.groupId)) ||
        attemptedIds.has(t.id),
    );
  }, [tests, activeStudent, attempts]);

  const handleStudentEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntering(true);
    const res = await enterStudentByNameAndGroup(fullNameInput, groupInput, groups, students);
    setEntering(false);
    if (res.ok) {
      showToast('O‘quvchi kabineti ochildi.', 'success');
    } else {
      showToast(res.error || 'Kirishda xatolik.', 'error');
    }
  };

  const openAttemptReview = async (attempt: Attempt) => {
    try {
      const qs = await fetchTestQuestions(attempt.testId);
      setReviewingAttempt({ attempt, questions: qs });
    } catch {
      showToast('Test savollarini yuklashda xatolik.', 'error');
    }
  };

  if (runningTest && activeStudent) {
    return (
      <ExamRunner
        test={runningTest}
        student={activeStudent}
        onExit={() => setRunningTest(null)}
      />
    );
  }

  if (reviewingAttempt) {
    return (
      <AttemptReviewCard
        attempt={reviewingAttempt.attempt}
        questions={reviewingAttempt.questions}
        onExit={() => setReviewingAttempt(null)}
      />
    );
  }

  if (!activeStudent) {
    return (
      <div className="max-w-lg mx-auto surface-card rounded-3xl overflow-hidden shadow-xl">
        <div className="navy-architect-grid text-white p-6 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">O‘quvchi kabinetiga kirish</h2>
            <p className="text-xs text-blue-200/80">
              Login va parolsiz — shunchaki ism familiyangiz va guruhingizni kiriting
            </p>
          </div>
        </div>
        <div className="p-7 space-y-6">
          <form onSubmit={handleStudentEntry} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ism va familiya (F.I.Sh.) *
              </label>
              <input
                type="text"
                required
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value)}
                placeholder="Masalan: Aziza Rustamova"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Guruh *</label>
              <input
                type="text"
                required
                list="oraliq_groups_datalist"
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                placeholder="Guruh nomini yozing yoki tanlang (masalan: 10-A)"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <datalist id="oraliq_groups_datalist">
                {groups.map((g) => (
                  <option key={g.id} value={g.name} />
                ))}
              </datalist>
              {groups.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGroupInput(g.name)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                        groupInput.trim().toLowerCase() === g.name.toLowerCase()
                          ? 'bg-[#0B1528] text-white border-[#0B1528]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={entering}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium cursor-pointer"
            >
              {entering ? 'Kirilmoqda...' : 'Kabinetga kirish'}
            </button>
          </form>

          {profile?.role === 'super_admin' && students.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Super Admin tezkor sinovi (istalgan o‘quvchini tanlash):
              </p>
              <div className="flex flex-wrap gap-2">
                {students.slice(0, 6).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setLinkedStudentId(st.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    {st.fullName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const chartData =
    studentSummary?.history.map((a, idx) => ({
      label: `#${idx + 1} ${a.subjectName.slice(0, 8)}`,
      percentage: a.percentage,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Student Profile Header */}
      <div className="navy-architect-grid text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div className="flex items-center gap-4">
          <Avatar src={activeStudent.photoUrl} name={activeStudent.fullName} size="lg" className="border-white/25" />
          <div>
            <h2 className="font-display text-xl font-bold">{activeStudent.fullName}</h2>
            <p className="text-xs text-blue-200/85 mt-0.5">{activeStudent.groupName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLinkedStudentId(null)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-xs font-semibold text-white cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Boshqa o‘quvchi bo‘lib kirish
        </button>
      </div>

      {/* Personal Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">O‘rtacha natijam</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <p className="font-mono-num text-2xl font-extrabold text-[#09142B]">
            {studentSummary?.avgPercentage ?? 0}%
          </p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Topshirilgan testlar</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <p className="font-mono-num text-2xl font-extrabold text-[#09142B]">
            {studentSummary?.attemptsCount ?? 0}
          </p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-500 block mb-2">Eng yuqori natija</span>
          <p className="font-mono-num text-2xl font-extrabold text-emerald-700">
            {studentSummary?.highestPercentage ?? 0}%
          </p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">O‘sish ko‘rsatkichi</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-mono-num text-2xl font-extrabold text-[#09142B]">
            {(studentSummary?.growthDelta ?? 0) > 0
              ? `+${studentSummary?.growthDelta}%`
              : `${studentSummary?.growthDelta ?? 0}%`}
          </p>
        </div>
      </div>

      {/* Assigned Tests */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD]">
          <h3 className="font-display font-bold text-base text-[#09142B]">
            Mening faol testlarim ({availableTests.length})
          </h3>
        </div>
        {availableTests.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {availableTests.map((t) => {
              const studentTestAttempts = attempts
                .filter((a) => a.testId === t.id && a.studentId === activeStudent.id)
                .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
              const takenCount = studentTestAttempts.length;
              const limitReached = takenCount >= t.maxAttempts;
              const latestAttempt = studentTestAttempts[0];

              return (
                <div key={t.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="font-display font-semibold text-sm text-[#09142B]">{t.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.subjectName} · {formatExamTypeUz(t.examType)} · {t.questionCount} savol · {t.durationMinutes} daqiqa · Urinish: {takenCount}/{t.maxAttempts}
                      {latestAttempt && (
                        <> · Oxirgi natija: <strong className="font-mono-num text-[#09142B]">{latestAttempt.score}/{latestAttempt.maxScore} ball ({latestAttempt.percentage}%)</strong></>
                      )}
                    </p>
                  </div>
                  {limitReached && latestAttempt ? (
                    <button
                      type="button"
                      onClick={() => setRunningTest(t)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#061024] hover:bg-[#0D1E40] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-300" />
                      Natija va xatolarni ko‘rish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRunningTest(t)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Testni boshlash
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-10 text-center">
            Guruhingiz uchun hozircha faol testlar tayinlanmagan.
          </p>
        )}
      </div>

      {/* Growth Chart & History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card rounded-2xl p-6">
          <h3 className="font-display font-bold text-sm text-[#09142B] mb-4">Shaxsiy o‘sish grafigi</h3>
          {chartData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip formatter={(v: unknown) => [`${v}%`, 'Natija']} />
                  <Line type="monotone" dataKey="percentage" stroke="#2563EB" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-16 text-center">Hali natijalar yo‘q.</p>
          )}
        </div>

        <div className="surface-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD]">
            <h3 className="font-display font-bold text-sm text-[#09142B]">
              Topshirilgan testlar tarixi (xatolar va mavzular uchun bosing)
            </h3>
          </div>
          {studentSummary && studentSummary.history.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {[...studentSummary.history].reverse().map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openAttemptReview(a)}
                  className="w-full px-6 py-3.5 flex items-center justify-between gap-3 text-sm hover:bg-blue-50/40 transition-colors text-left cursor-pointer"
                >
                  <div>
                    <p className="font-semibold text-[#09142B]">{a.testTitle}</p>
                    <p className="text-xs text-slate-500">
                      {a.subjectName} · {formatUzDate(a.submittedAt)} · Tahlilni ko‘rish
                    </p>
                  </div>
                  <span className="font-mono-num font-bold text-[#09142B] shrink-0">
                    {a.percentage}% ({a.score}/{a.maxScore})
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-16 text-center">Tarix bo‘sh.</p>
          )}
        </div>
      </div>
    </div>
  );
}
