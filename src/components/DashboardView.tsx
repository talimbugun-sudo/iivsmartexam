import { useMemo, useState } from 'react';
import {
  Users,
  Layers,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Trash2,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useData } from '../context/DataContext';
import {
  computeStudentSummaries,
  computeTimeSeries,
  formatExamTypeUz,
  type StudentAnalyticsSummary,
} from '../lib/analytics';
import { Avatar } from './Avatar';
import { StudentProfileModal } from './StudentProfileModal';
import { useToast } from './ToastProvider';

export function DashboardView({ onNavigateTests }: { onNavigateTests: () => void }) {
  const {
    students,
    groups,
    subjects,
    tests,
    attempts,
    loading,
    hasDemoData,
    runSeedDemo,
    runClearDemo,
  } = useData();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedStudent, setSelectedStudent] = useState<StudentAnalyticsSummary | null>(null);
  const [seeding, setSeeding] = useState(false);

  const avgMastery = useMemo(() => {
    if (attempts.length === 0) return 0;
    const sum = attempts.reduce((acc, a) => acc + a.percentage, 0);
    return Number((sum / attempts.length).toFixed(1));
  }, [attempts]);

  const studentSummaries = useMemo(
    () => computeStudentSummaries(students, attempts),
    [students, attempts],
  );

  const topPerformers = useMemo(
    () =>
      [...studentSummaries]
        .filter((s) => s.attemptsCount > 0)
        .sort((a, b) => b.avgPercentage - a.avgPercentage)
        .slice(0, 5),
    [studentSummaries],
  );

  const decliningStudents = useMemo(
    () =>
      [...studentSummaries]
        .filter((s) => s.attemptsCount >= 2 && s.growthDelta < 0)
        .sort((a, b) => a.growthDelta - b.growthDelta)
        .slice(0, 5),
    [studentSummaries],
  );

  const timeSeries = useMemo(
    () => computeTimeSeries(attempts, period),
    [attempts, period],
  );

  const recentAttempts = useMemo(() => attempts.slice(0, 6), [attempts]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await runSeedDemo();
      showToast('Namuna (Demo) ma’lumotlar bazaga yuklandi.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Demo yuklashda xatolik.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    setSeeding(true);
    try {
      await runClearDemo();
      showToast('Barcha Demo ma’lumotlar tozalandi.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Tozalashda xatolik.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-44 rounded-2xl navy-architect-grid opacity-80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl surface-card" />
          ))}
        </div>
        <div className="h-80 rounded-2xl surface-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commanding Midnight Navy Hero Summary Band */}
      <section className="navy-architect-grid text-white rounded-2xl p-6 sm:p-8 shadow-[0_20px_48px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-semibold text-blue-300 tracking-wide">
              Akademik nazorat boshqaruv markazi
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              {students.length === 0 && tests.length === 0
                ? 'ORALIQ NAZORAT tizimiga xush kelibsiz'
                : 'O‘quvchilar va guruhlar o‘zlashtirish ko‘rsatkichi'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {students.length === 0 && tests.length === 0
                ? 'Baza hozircha bo‘sh. Platformani darhol sinash uchun alohida ajratilgan Demo ma’lumotlarni yuklang yoki haqiqiy guruh va testlarni qo‘shing.'
                : `${students.length} nafar o‘quvchi · ${groups.length} ta guruh · ${subjects.length} ta fan · ${attempts.length} ta topshirilgan nazorat`}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onNavigateTests}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-[0_8px_20px_-4px_rgba(37,99,235,0.6)] transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Yangi test yaratish
              </button>
              {students.length === 0 && tests.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-xs font-semibold text-white transition-all cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-blue-300" />
                  {seeding ? 'Yuklanmoqda...' : 'Demo ma’lumotlarni yuklash'}
                </button>
              )}
              {hasDemoData && (
                <button
                  type="button"
                  onClick={handleClearDemo}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-xs font-medium text-slate-200 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Demo yozuvlarni tozalash
                </button>
              )}
            </div>
          </div>

          {/* Right Prominent Mastery Gauge */}
          <div className="lg:w-80 bg-white/[0.06] backdrop-blur-sm border border-white/12 rounded-2xl p-5 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-200">O‘rtacha o‘zlashtirish</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-mono-num text-4xl font-extrabold text-white">{avgMastery}%</span>
              <span className="text-xs text-slate-400">barcha nazoratlar</span>
            </div>
            <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, avgMastery))}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4 Crisp Architectural Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="surface-card rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Jami o‘quvchilar</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-[#09142B]">{students.length}</p>
          <p className="text-xs text-slate-500 mt-1.5">{groups.length} ta guruhga biriktirilgan</p>
        </div>

        <div className="surface-card rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Jami guruhlar</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-[#09142B]">{groups.length}</p>
          <p className="text-xs text-slate-500 mt-1.5">Faol o‘quv guruhlari</p>
        </div>

        <div className="surface-card rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Jami fanlar</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-[#09142B]">{subjects.length}</p>
          <p className="text-xs text-slate-500 mt-1.5">{tests.length} ta test bazada</p>
        </div>

        <div className="surface-card rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">O‘tkazilgan nazoratlar</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-[#09142B]">{attempts.length}</p>
          <p className="text-xs text-slate-500 mt-1.5">Topshirilgan urinishlar soni</p>
        </div>
      </div>

      {/* Weekly / Monthly Chart + Recent Tests */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 surface-card rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="font-display text-base font-bold text-[#09142B]">
                Haftalik va oylik o‘zlashtirish dinamikasi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bazadagi topshirilgan testlar sanasi bo‘yicha o‘rtacha foiz
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#EEF3F9] border border-[#DCE5F2] rounded-xl">
              <button
                type="button"
                onClick={() => setPeriod('weekly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  period === 'weekly' ? 'bg-[#061024] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Haftalik
              </button>
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  period === 'monthly' ? 'bg-[#061024] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Oylik
              </button>
            </div>
          </div>

          {timeSeries.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashBlueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) =>
                      name === 'avgPercentage' ? [`${value}%`, 'O‘rtacha o‘zlashtirish'] : [String(value), 'Testlar']
                    }
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #DCE5F2',
                      boxShadow: '0 10px 25px -5px rgba(9,20,43,0.12)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgPercentage"
                    stroke="#2563EB"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dashBlueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center border border-dashed border-[#DCE5F2] rounded-2xl bg-[#F8FAFD]">
              <p className="text-sm text-slate-500 mb-3">Grafik uchun topshirilgan test natijalari hali yo‘q.</p>
              <button
                type="button"
                onClick={onNavigateTests}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-500 transition-colors cursor-pointer"
              >
                Testlar bo‘limiga o‘tish
              </button>
            </div>
          )}
        </div>

        {/* Oxirgi testlar */}
        <div className="surface-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-[#09142B]">Oxirgi test natijalari</h2>
            <button
              type="button"
              onClick={onNavigateTests}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer whitespace-nowrap"
            >
              Barchasi
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentAttempts.length > 0 ? (
            <div className="divide-y divide-slate-100 flex-1">
              {recentAttempts.map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={a.studentPhotoUrl} name={a.studentName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#09142B] truncate">{a.studentName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {a.subjectName} · {formatExamTypeUz(a.examType)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-mono-num text-sm font-bold ${
                        a.percentage >= 86
                          ? 'text-emerald-700'
                          : a.percentage >= 71
                            ? 'text-blue-700'
                            : a.percentage >= 55
                              ? 'text-amber-700'
                              : 'text-red-700'
                      }`}
                    >
                      {a.percentage}%
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-400">
                      {a.score}/{a.maxScore}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-16 text-center">Hali test topshirilmagan.</p>
          )}
        </div>
      </div>

      {/* Top Performers vs Declining Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD] flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#09142B]">
              Eng yaxshi natija ko‘rsatganlar
            </h2>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          {topPerformers.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {topPerformers.map((s, idx) => (
                <button
                  key={s.student.id}
                  type="button"
                  onClick={() => setSelectedStudent(s)}
                  className="w-full px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-blue-50/40 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-mono-num text-xs font-bold text-blue-600 w-5">
                      {idx + 1}.
                    </span>
                    <Avatar src={s.student.photoUrl} name={s.student.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#09142B] truncate">
                        {s.student.fullName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${s.avgPercentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 truncate">
                          {s.student.groupName} · {s.attemptsCount} ta test
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono-num text-sm font-bold text-emerald-700">
                      {s.avgPercentage}%
                    </p>
                    <p className="font-mono-num text-xs text-slate-500">
                      {s.growthDelta > 0 ? `+${s.growthDelta}%` : `${s.growthDelta}%`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">Ma’lumotlar yetarli emas.</p>
          )}
        </div>

        <div className="surface-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD] flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#09142B]">
              Natijasi pasaygan o‘quvchilar
            </h2>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          {decliningStudents.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {decliningStudents.map((s) => (
                <button
                  key={s.student.id}
                  type="button"
                  onClick={() => setSelectedStudent(s)}
                  className="w-full px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-red-50/30 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar src={s.student.photoUrl} name={s.student.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#09142B] truncate">
                        {s.student.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {s.student.groupName} · Zaif fan: {s.weakestSubject || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono-num text-sm font-bold text-red-700">
                      {s.growthDelta}%
                    </p>
                    <p className="font-mono-num text-xs text-slate-500">
                      O‘rtacha: {s.avgPercentage}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">
              Natijasi pasaygan o‘quvchilar aniqlanmadi.
            </p>
          )}
        </div>
      </div>

      <StudentProfileModal
        summary={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
