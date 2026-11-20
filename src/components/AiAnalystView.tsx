import { useMemo, useState } from 'react';
import { BrainCircuit, Sparkles, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  computeGroupSummaries,
  computeGrowthDelta,
  computeStudentSummaries,
  computeSubjectSummaries,
  formatUzDate,
} from '../lib/analytics';
import { useToast } from './ToastProvider';

export function AiAnalystView() {
  const { students, groups, subjects, attempts, aiReports, saveAiReport, dataFilterMode } = useData();
  const { showToast } = useToast();

  const [scope, setScope] = useState<'overall' | 'group' | 'student' | 'subject'>('overall');
  const [targetId, setTargetId] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [latestResult, setLatestResult] = useState<{
    targetName: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } | null>(null);
  const [noDataMsg, setNoDataMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const studentSummaries = useMemo(() => computeStudentSummaries(students, attempts), [students, attempts]);
  const groupSummaries = useMemo(() => computeGroupSummaries(groups, students, attempts), [groups, students, attempts]);
  const subjectSummaries = useMemo(() => computeSubjectSummaries(subjects, attempts), [subjects, attempts]);

  const handleAnalyze = async () => {
    setNoDataMsg(null);
    setErrorMsg(null);
    setAnalyzing(true);

    try {
      let targetName = 'Umumiy ta’lim muassasasi';
      let scopedAttempts = attempts;

      if (scope === 'group') {
        const g = groups.find((x) => x.id === targetId) || groups[0];
        if (!g) {
          setNoDataMsg('Tahlil uchun guruh tanlanmadi.');
          setAnalyzing(false);
          return;
        }
        targetName = `Guruh: ${g.name}`;
        scopedAttempts = attempts.filter((a) => a.groupId === g.id);
      } else if (scope === 'student') {
        const st = students.find((x) => x.id === targetId) || students[0];
        if (!st) {
          setNoDataMsg('Tahlil uchun o‘quvchi tanlanmadi.');
          setAnalyzing(false);
          return;
        }
        targetName = `O‘quvchi: ${st.fullName} (${st.groupName})`;
        scopedAttempts = attempts.filter((a) => a.studentId === st.id);
      } else if (scope === 'subject') {
        const sub = subjects.find((x) => x.id === targetId) || subjects[0];
        if (!sub) {
          setNoDataMsg('Tahlil uchun fan tanlanmadi.');
          setAnalyzing(false);
          return;
        }
        targetName = `Fan: ${sub.name}`;
        scopedAttempts = attempts.filter((a) => a.subjectId === sub.id);
      }

      if (scopedAttempts.length === 0) {
        setNoDataMsg(
          `«${targetName}» bo‘yicha bazada topshirilgan test natijalari mavjud emas. Ma’lumot yo‘q bo‘lgani sababli Gemini AI xulosa to‘qib chiqarmaydi.`,
        );
        setAnalyzing(false);
        return;
      }

      const sortedAsc = [...scopedAttempts].sort(
        (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
      );
      const avgPct = Number(
        (scopedAttempts.reduce((sum, a) => sum + a.percentage, 0) / scopedAttempts.length).toFixed(1),
      );

      const statsPayload = {
        attemptsCount: scopedAttempts.length,
        studentsCount: students.length,
        groupsCount: groups.length,
        subjectsCount: subjects.length,
        averagePercentage: avgPct,
        growthDelta: computeGrowthDelta(sortedAsc),
        groupsBreakdown: groupSummaries.map((g) => ({
          name: g.group.name,
          avgPercentage: g.avgPercentage,
          attemptsCount: g.attemptsCount,
          studentsCount: g.studentsCount,
        })),
        subjectsBreakdown: subjectSummaries.map((s) => ({
          name: s.subject.name,
          avgPercentage: s.avgPercentage,
          attemptsCount: s.attemptsCount,
        })),
        studentsBreakdown: studentSummaries
          .filter((s) => s.attemptsCount > 0)
          .slice(0, 25)
          .map((s) => ({
            fullName: s.student.fullName,
            groupName: s.student.groupName,
            avgPercentage: s.avgPercentage,
            growthDelta: s.growthDelta,
            attemptsCount: s.attemptsCount,
            weakestSubject: s.weakestSubject,
            strongestSubject: s.strongestSubject,
          })),
        recentAttempts: scopedAttempts.slice(0, 15).map((a) => ({
          studentName: a.studentName,
          subjectName: a.subjectName,
          testTitle: a.testTitle,
          percentage: a.percentage,
          examType: a.examType,
          submittedAt: formatUzDate(a.submittedAt),
        })),
      };

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, targetName, statsPayload }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI serveridan xatolik qaytdi.');
      }

      if (data.noData) {
        setNoDataMsg(data.message);
        return;
      }

      const report = {
        targetName,
        summary: data.report.summary,
        strengths: data.report.strengths,
        weaknesses: data.report.weaknesses,
        recommendations: data.report.recommendations,
      };
      setLatestResult(report);

      await saveAiReport({
        scope,
        targetId: targetId || undefined,
        targetName,
        summary: report.summary,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        recommendations: report.recommendations,
        isDemo: dataFilterMode === 'demo' || scopedAttempts.every((a) => a.isDemo),
      });

      showToast('Gemini AI tahlili muvaffaqiyatli yaratildi va saqlandi.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI tahlil qilishda xatolik.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="navy-architect-grid text-white rounded-2xl p-6 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5 shadow-[0_18px_42px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
            <BrainCircuit className="w-4 h-4" />
            <span>Gemini AI Akademik Tahlilchi</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold">
            Bazadagi haqiqiy natijalar asosida chuqur tahlil
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            AI faqat bazadagi haqiqiy test natijalariga tayanadi: o‘sish va pasayishni, zaif fanlarni hamda o‘qituvchiga amaliy tavsiyalarni shakllantiradi.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 shrink-0">
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">Tahlil ko‘lami</label>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as 'overall' | 'group' | 'student' | 'subject');
                setTargetId('');
              }}
              className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white"
            >
              <option value="overall">Umumiy muassasa</option>
              <option value="group">Guruh bo‘yicha</option>
              <option value="student">Individual o‘quvchi</option>
              <option value="subject">Fan bo‘yicha</option>
            </select>
          </div>

          {scope === 'group' && (
            <div>
              <label className="block text-[11px] text-slate-300 mb-1">Guruh</label>
              <select
                value={targetId || groups[0]?.id || ''}
                onChange={(e) => setTargetId(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'student' && (
            <div>
              <label className="block text-[11px] text-slate-300 mb-1">O‘quvchi</label>
              <select
                value={targetId || students[0]?.id || ''}
                onChange={(e) => setTargetId(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'subject' && (
            <div>
              <label className="block text-[11px] text-slate-300 mb-1">Fan</label>
              <select
                value={targetId || subjects[0]?.id || ''}
                onChange={(e) => setTargetId(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            {analyzing ? 'Tahlil qilinmoqda...' : 'AI Tahlil yaratish'}
          </button>
        </div>
      </div>

      {/* No Data Warning */}
      {noDataMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm">{noDataMsg}</p>
        </div>
      )}

      {/* API / Permission Error Banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3 text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Latest Report */}
      {latestResult && (
        <div className="surface-card rounded-2xl p-6 space-y-6">
          <div>
            <p className="text-xs font-medium text-blue-700 mb-1">Yangi AI Xulosasi</p>
            <h3 className="font-display text-lg font-bold text-slate-900">{latestResult.targetName}</h3>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{latestResult.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-display font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Kuchli tomonlar va o‘sish
              </div>
              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                {latestResult.strengths.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-700 font-display font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Zaif fanlar va pasayishlar
              </div>
              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                {latestResult.weaknesses.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-700 font-display font-semibold text-sm">
                <Lightbulb className="w-4 h-4" />
                O‘qituvchiga tavsiyalar
              </div>
              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                {latestResult.recommendations.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Saved AI Reports History */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD]">
          <h3 className="font-display font-bold text-sm text-[#09142B]">
            Saqlangan AI hisobotlari ({aiReports.length})
          </h3>
        </div>
        {aiReports.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {aiReports.map((rep) => (
              <div key={rep.id} className="p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display font-bold text-sm text-slate-900">{rep.targetName}</h4>
                  <span className="font-mono-num text-xs text-slate-500">{formatUzDate(rep.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{rep.summary}</p>
                {rep.recommendations.length > 0 && (
                  <p className="text-xs text-blue-700">
                    Asosiy tavsiya: {rep.recommendations[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-12 text-center">
            Hali saqlangan AI hisobotlari yo‘q. Yuqoridagi tugma orqali birinchi tahlilni yarating.
          </p>
        )}
      </div>
    </div>
  );
}
