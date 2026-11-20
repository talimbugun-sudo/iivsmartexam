import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Filter, RotateCcw } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  computeGroupSummaries,
  computeMasteryDistribution,
  computeStudentSummaries,
  computeTimeSeries,
  filterAttempts,
  formatUzDate,
  type AnalyticsFilterState,
} from '../lib/analytics';
import type { ExamType } from '../types';

const DEFAULT_FILTERS: AnalyticsFilterState = {
  startDate: '',
  endDate: '',
  subjectId: 'all',
  groupId: 'all',
  examType: 'all',
  resultTier: 'all',
};

export function AnalyticsView() {
  const { students, groups, subjects, attempts } = useData();
  const [filters, setFilters] = useState<AnalyticsFilterState>(DEFAULT_FILTERS);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  const filteredAttempts = useMemo(
    () => filterAttempts(attempts, filters),
    [attempts, filters],
  );

  const studentSummaries = useMemo(
    () => computeStudentSummaries(students, filteredAttempts),
    [students, filteredAttempts],
  );

  const groupSummaries = useMemo(
    () => computeGroupSummaries(groups, students, filteredAttempts),
    [groups, students, filteredAttempts],
  );

  const masteryPie = useMemo(
    () => computeMasteryDistribution(filteredAttempts),
    [filteredAttempts],
  );

  const areaSeries = useMemo(
    () => computeTimeSeries(filteredAttempts, 'weekly'),
    [filteredAttempts],
  );

  // Line chart data: individual student trajectory or top 3 active students compared
  const lineData = useMemo(() => {
    if (selectedStudentId !== 'all') {
      const target = studentSummaries.find((s) => s.student.id === selectedStudentId);
      if (!target) return [];
      return target.history.map((a, idx) => ({
        step: `${idx + 1}. ${a.subjectName.slice(0, 8)} (${formatUzDate(a.submittedAt).slice(0, 5)})`,
        percentage: a.percentage,
      }));
    }
    const sorted = [...filteredAttempts].sort(
      (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
    );
    return sorted.map((a, idx) => ({
      step: `#${idx + 1} ${a.studentName.split(' ')[0]}`,
      percentage: a.percentage,
    }));
  }, [selectedStudentId, studentSummaries, filteredAttempts]);

  const activeStudentGrowth = useMemo(() => {
    if (selectedStudentId === 'all') return null;
    return studentSummaries.find((s) => s.student.id === selectedStudentId) || null;
  }, [selectedStudentId, studentSummaries]);

  return (
    <div className="space-y-6">
      {/* Shared Multi-Filter Toolbar */}
      <div className="surface-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="font-display font-bold text-sm text-[#09142B]">
              Diagrammalar uchun umumiy filterlar ({filteredAttempts.length} ta natija)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setSelectedStudentId('all');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tozalash
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Boshlanish sanasi</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tugash sanasi</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Fan</label>
            <select
              value={filters.subjectId}
              onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value }))}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Barcha fanlar</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Guruh</label>
            <select
              value={filters.groupId}
              onChange={(e) => setFilters((f) => ({ ...f, groupId: e.target.value }))}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nazorat turi</label>
            <select
              value={filters.examType}
              onChange={(e) =>
                setFilters((f) => ({ ...f, examType: e.target.value as 'all' | ExamType }))
              }
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Barcha turlar</option>
              <option value="oraliq">Oraliq nazorat</option>
              <option value="joriy">Joriy nazorat</option>
              <option value="yakuniy">Yakuniy nazorat</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Natija darajasi</label>
            <select
              value={filters.resultTier}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  resultTier: e.target.value as AnalyticsFilterState['resultTier'],
                }))
              }
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Barcha natijalar</option>
              <option value="excellent">A'lo (86–100%)</option>
              <option value="good">Yaxshi (71–85%)</option>
              <option value="satisfactory">Qoniqarli (55–70%)</option>
              <option value="low">Past (&lt;55%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 Recharts Visualizations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* 1. Line Chart: Growth & Decline per student */}
        <div className="surface-card rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display font-bold text-sm text-[#09142B]">
                1. O‘sish va pasayish dinamikasi (Line Chart)
              </h3>
              <p className="text-xs text-slate-500">
                Turli savollar soniga ega testlar foiz (%) ko‘rsatkichida solishtiriladi
              </p>
            </div>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Barcha o‘quvchilar</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.fullName}
                </option>
              ))}
            </select>
          </div>

          {activeStudentGrowth && (
            <div className="mb-3 text-xs text-slate-600 flex items-center gap-4">
              <span>
                O‘rtacha: <strong className="font-mono-num text-slate-900">{activeStudentGrowth.avgPercentage}%</strong>
              </span>
              <span>
                O‘sish / Pasayish:{' '}
                <strong
                  className={`font-mono-num ${
                    activeStudentGrowth.growthDelta > 0
                      ? 'text-emerald-700'
                      : activeStudentGrowth.growthDelta < 0
                        ? 'text-red-700'
                        : 'text-slate-700'
                  }`}
                >
                  {activeStudentGrowth.growthDelta > 0
                    ? `+${activeStudentGrowth.growthDelta}%`
                    : `${activeStudentGrowth.growthDelta}%`}
                </strong>
              </span>
            </div>
          )}

          {lineData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="step" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip formatter={(v: unknown) => [`${v}%`, 'Natija']} />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0B1528' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-20 text-center">Filter bo‘yicha natijalar topilmadi.</p>
          )}
        </div>

        {/* 2. Bar Chart: Group Comparison */}
        <div className="surface-card rounded-2xl p-6">
          <h3 className="font-display font-bold text-sm text-[#09142B] mb-1">
            2. Guruhlar o‘rtasida taqqoslash (Bar Chart)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Har bir guruhning o‘rtacha o‘zlashtirish foizi
          </p>
          {groupSummaries.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupSummaries.map((g) => ({
                    name: g.group.name,
                    avg: g.avgPercentage,
                    attempts: g.attemptsCount,
                  }))}
                  margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip formatter={(v: unknown) => [`${v}%`, 'O‘rtacha ball']} />
                  <Bar dataKey="avg" fill="#0B1528" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-20 text-center">Guruhlar ma’lumoti yo‘q.</p>
          )}
        </div>

        {/* 3. Pie Chart: Mastery Percentages */}
        <div className="surface-card rounded-2xl p-6">
          <h3 className="font-display font-bold text-sm text-[#09142B] mb-1">
            3. O‘zlashtirish foizlari taqsimoti (Pie Chart)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Natija darajalari bo‘yicha ulushlar
          </p>
          {filteredAttempts.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={masteryPie.filter((m) => m.count > 0)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {masteryPie
                      .filter((m) => m.count > 0)
                      .map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [`${v} ta urinish`, 'Soni']} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-20 text-center">Taqsimot uchun ma’lumotlar yo‘q.</p>
          )}
        </div>

        {/* 4. Area Chart: Knowledge Level Over Time */}
        <div className="surface-card rounded-2xl p-6">
          <h3 className="font-display font-bold text-sm text-[#09142B] mb-1">
            4. Vaqt bo‘yicha bilim darajasi o‘zgarishi (Area Chart)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Haftalar kesimidagi umumiy o‘zlashtirish egri chizig‘i
          </p>
          {areaSeries.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaSeries} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip formatter={(v: unknown) => [`${v}%`, 'O‘rtacha ball']} />
                  <Area
                    type="monotone"
                    dataKey="avgPercentage"
                    stroke="#1D4ED8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#analyticsArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-20 text-center">Vaqt bo‘yicha ma’lumotlar yo‘q.</p>
          )}
        </div>
      </div>
    </div>
  );
}
