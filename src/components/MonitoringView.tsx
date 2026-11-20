import { useEffect, useMemo, useState } from 'react';
import { Radio, Clock, CheckCircle2, UserX, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Avatar } from './Avatar';

export function MonitoringView() {
  const { tests, students, liveSessions, attempts } = useData();
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Tick every second so active countdown displays smoothly in real time
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeTest = useMemo(() => {
    if (tests.length === 0) return null;
    return tests.find((t) => t.id === selectedTestId) || tests[0];
  }, [tests, selectedTestId]);

  const roster = useMemo(() => {
    if (!activeTest) return [];
    const targetStudents = students.filter((s) => activeTest.groupIds.includes(s.groupId));

    return targetStudents.map((st) => {
      const session = liveSessions.find(
        (ls) => ls.testId === activeTest.id && ls.studentId === st.id,
      );
      const latestAttempt = attempts.find(
        (a) => a.testId === activeTest.id && a.studentId === st.id,
      );

      let status: 'not_started' | 'entered' | 'working' | 'finished' = 'not_started';
      let answeredCount = 0;
      const totalQuestions = activeTest.questionCount;
      let remainingSeconds = activeTest.durationMinutes * 60;
      let percentage: number | undefined;
      let score: number | undefined;

      if (session) {
        status = session.status;
        answeredCount = session.answeredCount;
        if (session.status === 'working' || session.status === 'entered') {
          const elapsedSinceUpdate = Math.floor((nowTick - session.updatedAt.getTime()) / 1000);
          remainingSeconds = Math.max(0, session.remainingSeconds - Math.max(0, elapsedSinceUpdate));
        } else {
          remainingSeconds = session.remainingSeconds;
        }
        percentage = session.percentage;
        score = session.score;
      } else if (latestAttempt) {
        status = 'finished';
        answeredCount = latestAttempt.totalQuestions;
        remainingSeconds = Math.max(0, activeTest.durationMinutes * 60 - latestAttempt.durationSpentSeconds);
        percentage = latestAttempt.percentage;
        score = latestAttempt.score;
      }

      return {
        student: st,
        status,
        answeredCount,
        totalQuestions,
        remainingSeconds,
        percentage,
        score,
      };
    });
  }, [activeTest, students, liveSessions, attempts, nowTick]);

  const counts = useMemo(() => {
    const enteredOrMore = roster.filter((r) => r.status !== 'not_started').length;
    const notStarted = roster.filter((r) => r.status === 'not_started').length;
    const working = roster.filter((r) => r.status === 'working' || r.status === 'entered').length;
    const finished = roster.filter((r) => r.status === 'finished').length;
    return { enteredOrMore, notStarted, working, finished };
  }, [roster]);

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="navy-architect-grid text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/25 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-white">
              Jonli test monitoringi (Real vaqt rejimi)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              O‘quvchilarning imtihondagi holati, qolgan vaqti va natijalari avtomatik yangilanadi
            </p>
          </div>
        </div>

        <select
          value={activeTest?.id || ''}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="px-3.5 py-2.5 text-sm border border-white/15 rounded-xl bg-[#0A1936] text-white min-w-[240px] focus:outline-none focus:border-blue-400"
        >
          {tests.length === 0 && <option value="">Testlar mavjud emas</option>}
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Testga kirganlar</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-[#09142B]">{counts.enteredOrMore}</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Testni boshlamaganlar</span>
            <UserX className="w-4 h-4 text-slate-400" />
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-[#09142B]">{counts.notStarted}</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Test ishlayotganlar</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-blue-700">{counts.working}</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Testni tugatganlar</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-mono-num text-3xl font-extrabold text-emerald-700">{counts.finished}</p>
        </div>
      </div>

      {/* Live Student Roster Table */}
      <div className="surface-card rounded-2xl overflow-hidden">
        {roster.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCE5F2] bg-[#F8FAFD] text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">O‘quvchi</th>
                  <th className="py-3 px-4">Guruh</th>
                  <th className="py-3 px-4">Holati</th>
                  <th className="py-3 px-4">Jarayon</th>
                  <th className="py-3 px-4 text-right">Qolgan vaqt</th>
                  <th className="py-3 px-4 text-right">Natija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {roster.map((r) => {
                  const pctProgress =
                    r.totalQuestions > 0 ? Math.round((r.answeredCount / r.totalQuestions) * 100) : 0;
                  return (
                    <tr key={r.student.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar src={r.student.photoUrl} name={r.student.fullName} size="sm" />
                          <span className="font-semibold text-slate-900">{r.student.fullName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{r.student.groupName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            r.status === 'finished'
                              ? 'text-emerald-700'
                              : r.status === 'working'
                                ? 'text-blue-700'
                                : r.status === 'entered'
                                  ? 'text-amber-700'
                                  : 'text-slate-400'
                          }`}
                        >
                          {r.status === 'finished'
                            ? 'Tugatgan'
                            : r.status === 'working'
                              ? 'Ishlamoqda'
                              : r.status === 'entered'
                                ? 'Kirgan'
                                : 'Boshlamagan'}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{ width: `${pctProgress}%` }}
                            />
                          </div>
                          <span className="font-mono-num text-xs text-slate-600">
                            {r.answeredCount}/{r.totalQuestions}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                        {r.status === 'finished' ? 'Yakunlangan' : formatSec(r.remainingSeconds)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                        {r.percentage !== undefined ? `${r.percentage}% (${r.score})` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-16 text-center">
            Tanlangan test guruhlarida o‘quvchilar topilmadi.
          </p>
        )}
      </div>
    </div>
  );
}
