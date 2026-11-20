import { X, TrendingUp, TrendingDown, Minus, FileSpreadsheet, FileText } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { StudentAnalyticsSummary } from '../lib/analytics';
import { formatExamTypeUz, formatUzDate } from '../lib/analytics';
import { exportIndividualStudentExcel, exportIndividualStudentPdf } from '../lib/exportUtils';
import { Avatar } from './Avatar';

interface StudentProfileModalProps {
  summary: StudentAnalyticsSummary | null;
  onClose: () => void;
}

export function StudentProfileModal({ summary, onClose }: StudentProfileModalProps) {
  if (!summary) return null;

  const { student, attemptsCount, avgPercentage, highestPercentage, lowestPercentage, growthDelta, subjectBreakdown, history } =
    summary;

  const chartData = history.map((a, idx) => ({
    index: `#${idx + 1}`,
    label: `${a.subjectName.slice(0, 10)} (${formatUzDate(a.submittedAt).slice(0, 5)})`,
    percentage: a.percentage,
    testTitle: a.testTitle,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 bg-[#0B1528] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar src={student.photoUrl} name={student.fullName} size="lg" className="border-slate-700" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold truncate">{student.fullName}</h2>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{student.groupName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">Login: {student.login}</span>
                {student.isDemo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-blue-300">Demo profil</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportIndividualStudentExcel(summary)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportIndividualStudentPdf(summary)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <p className="text-xs text-slate-500 mb-1">O‘rtacha ball</p>
              <p className="font-mono-num text-2xl font-bold text-slate-900">{avgPercentage}%</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <p className="text-xs text-slate-500 mb-1">Topshirilgan test</p>
              <p className="font-mono-num text-2xl font-bold text-slate-900">{attemptsCount}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <p className="text-xs text-slate-500 mb-1">Eng yuqori</p>
              <p className="font-mono-num text-2xl font-bold text-emerald-700">{highestPercentage}%</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <p className="text-xs text-slate-500 mb-1">Eng past</p>
              <p className="font-mono-num text-2xl font-bold text-red-700">{lowestPercentage}%</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500 mb-1">O‘sish foizi</p>
              <div className="flex items-center gap-1.5">
                {growthDelta > 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : growthDelta < 0 ? (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                ) : (
                  <Minus className="w-4 h-4 text-slate-400" />
                )}
                <p
                  className={`font-mono-num text-2xl font-bold ${
                    growthDelta > 0 ? 'text-emerald-700' : growthDelta < 0 ? 'text-red-700' : 'text-slate-700'
                  }`}
                >
                  {growthDelta > 0 ? `+${growthDelta}%` : `${growthDelta}%`}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile export actions */}
          <div className="flex sm:hidden gap-2">
            <button
              type="button"
              onClick={() => exportIndividualStudentExcel(summary)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel yuklab olish
            </button>
            <button
              type="button"
              onClick={() => exportIndividualStudentPdf(summary)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-xs font-medium text-white"
            >
              <FileText className="w-4 h-4" />
              PDF yuklab olish
            </button>
          </div>

          {/* Individual Growth Chart + Subject Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-slate-200 rounded-xl p-5">
              <h3 className="font-display font-semibold text-sm text-slate-900 mb-4">
                Individual o‘sish diagrammasi (foiz hisobida)
              </h3>
              {chartData.length > 0 ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                      <Tooltip
                        formatter={(value: unknown) => [`${value}%`, 'Natija']}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="percentage"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#0F172A', strokeWidth: 2, stroke: '#FFFFFF' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-16 text-center">
                  Hali topshirilgan testlar mavjud emas.
                </p>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-5">
              <h3 className="font-display font-semibold text-sm text-slate-900 mb-4">
                Fanlar bo‘yicha natijalar
              </h3>
              {subjectBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {subjectBreakdown.map((sb) => (
                    <div key={sb.subjectId}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-800 truncate">{sb.subjectName}</span>
                        <span className="font-mono-num font-semibold text-slate-900">
                          {sb.avgPercentage}% · {sb.attemptsCount} ta
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sb.avgPercentage >= 86
                              ? 'bg-emerald-600'
                              : sb.avgPercentage >= 71
                                ? 'bg-blue-600'
                                : sb.avgPercentage >= 55
                                  ? 'bg-amber-500'
                                  : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min(100, sb.avgPercentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-8 text-center">Fan natijalari yo‘q.</p>
              )}
            </div>
          </div>

          {/* Test History Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
              <h3 className="font-display font-semibold text-sm text-slate-900">Testlar tarixi</h3>
            </div>
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Test nomi</th>
                      <th className="py-2.5 px-4">Fan</th>
                      <th className="py-2.5 px-4">Nazorat turi</th>
                      <th className="py-2.5 px-4 text-right">Ball</th>
                      <th className="py-2.5 px-4 text-right">Foiz</th>
                      <th className="py-2.5 px-4 text-right">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {[...history].reverse().map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-medium text-slate-900">{a.testTitle}</td>
                        <td className="py-2.5 px-4 text-slate-600">{a.subjectName}</td>
                        <td className="py-2.5 px-4 text-slate-600">{formatExamTypeUz(a.examType)}</td>
                        <td className="py-2.5 px-4 text-right font-mono-num text-slate-700">
                          {a.score}/{a.maxScore}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900">
                          {a.percentage}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num text-xs text-slate-500">
                          {formatUzDate(a.submittedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center">Testlar tarixi bo‘sh.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
