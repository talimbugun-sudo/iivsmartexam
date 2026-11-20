import type { Attempt, ExamType, Group, Student, Subject } from '../types';

export interface StudentAnalyticsSummary {
  student: Student;
  attemptsCount: number;
  avgPercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  growthDelta: number;
  subjectBreakdown: Array<{ subjectId: string; subjectName: string; avgPercentage: number; attemptsCount: number }>;
  history: Attempt[];
  weakestSubject?: string;
  strongestSubject?: string;
}

export interface GroupAnalyticsSummary {
  group: Group;
  studentsCount: number;
  attemptsCount: number;
  avgPercentage: number;
  topStudentName?: string;
  growthDelta: number;
}

export interface SubjectAnalyticsSummary {
  subject: Subject;
  attemptsCount: number;
  avgPercentage: number;
  passRate: number;
}

export interface AnalyticsFilterState {
  startDate: string;
  endDate: string;
  subjectId: string;
  groupId: string;
  examType: 'all' | ExamType;
  resultTier: 'all' | 'excellent' | 'good' | 'satisfactory' | 'low';
}

export function filterAttempts(attempts: Attempt[], filters: AnalyticsFilterState): Attempt[] {
  return attempts.filter((a) => {
    if (filters.subjectId !== 'all' && a.subjectId !== filters.subjectId) return false;
    if (filters.groupId !== 'all' && a.groupId !== filters.groupId) return false;
    if (filters.examType !== 'all' && a.examType !== filters.examType) return false;

    if (filters.startDate) {
      const start = new Date(`${filters.startDate}T00:00:00`);
      if (a.submittedAt < start) return false;
    }
    if (filters.endDate) {
      const end = new Date(`${filters.endDate}T23:59:59`);
      if (a.submittedAt > end) return false;
    }

    if (filters.resultTier === 'excellent' && a.percentage < 86) return false;
    if (filters.resultTier === 'good' && (a.percentage < 71 || a.percentage >= 86)) return false;
    if (filters.resultTier === 'satisfactory' && (a.percentage < 55 || a.percentage >= 71)) return false;
    if (filters.resultTier === 'low' && a.percentage >= 55) return false;

    return true;
  });
}

export function computeGrowthDelta(sortedAttemptsAsc: Attempt[]): number {
  if (sortedAttemptsAsc.length < 2) return 0;
  const firstHalfCount = Math.floor(sortedAttemptsAsc.length / 2);
  if (sortedAttemptsAsc.length === 2) {
    return Number((sortedAttemptsAsc[1].percentage - sortedAttemptsAsc[0].percentage).toFixed(1));
  }
  const earlier = sortedAttemptsAsc.slice(0, firstHalfCount);
  const recent = sortedAttemptsAsc.slice(firstHalfCount);
  const earlierAvg = earlier.reduce((sum, x) => sum + x.percentage, 0) / earlier.length;
  const recentAvg = recent.reduce((sum, x) => sum + x.percentage, 0) / recent.length;
  return Number((recentAvg - earlierAvg).toFixed(1));
}

export function computeStudentSummaries(
  students: Student[],
  attempts: Attempt[],
): StudentAnalyticsSummary[] {
  return students.map((student) => {
    const history = attempts
      .filter((a) => a.studentId === student.id)
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

    if (history.length === 0) {
      return {
        student,
        attemptsCount: 0,
        avgPercentage: 0,
        highestPercentage: 0,
        lowestPercentage: 0,
        growthDelta: 0,
        subjectBreakdown: [],
        history: [],
      };
    }

    const totalPct = history.reduce((sum, a) => sum + a.percentage, 0);
    const avgPercentage = Number((totalPct / history.length).toFixed(1));
    const percentages = history.map((a) => a.percentage);
    const highestPercentage = Math.max(...percentages);
    const lowestPercentage = Math.min(...percentages);
    const growthDelta = computeGrowthDelta(history);

    const bySubject = new Map<string, { subjectName: string; total: number; count: number }>();
    for (const a of history) {
      const prev = bySubject.get(a.subjectId) || { subjectName: a.subjectName, total: 0, count: 0 };
      prev.total += a.percentage;
      prev.count += 1;
      bySubject.set(a.subjectId, prev);
    }

    const subjectBreakdown = Array.from(bySubject.entries())
      .map(([subjectId, val]) => ({
        subjectId,
        subjectName: val.subjectName,
        avgPercentage: Number((val.total / val.count).toFixed(1)),
        attemptsCount: val.count,
      }))
      .sort((a, b) => b.avgPercentage - a.avgPercentage);

    return {
      student,
      attemptsCount: history.length,
      avgPercentage,
      highestPercentage,
      lowestPercentage,
      growthDelta,
      subjectBreakdown,
      history,
      strongestSubject: subjectBreakdown[0]?.subjectName,
      weakestSubject: subjectBreakdown[subjectBreakdown.length - 1]?.subjectName,
    };
  });
}

export function computeGroupSummaries(
  groups: Group[],
  students: Student[],
  attempts: Attempt[],
): GroupAnalyticsSummary[] {
  const studentSummaries = computeStudentSummaries(students, attempts);

  return groups
    .map((group) => {
      const groupStudents = studentSummaries.filter((s) => s.student.groupId === group.id);
      const groupAttempts = attempts
        .filter((a) => a.groupId === group.id)
        .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

      const avgPercentage =
        groupAttempts.length > 0
          ? Number((groupAttempts.reduce((sum, a) => sum + a.percentage, 0) / groupAttempts.length).toFixed(1))
          : 0;

      const sortedStudents = [...groupStudents]
        .filter((s) => s.attemptsCount > 0)
        .sort((a, b) => b.avgPercentage - a.avgPercentage);

      return {
        group,
        studentsCount: groupStudents.length,
        attemptsCount: groupAttempts.length,
        avgPercentage,
        topStudentName: sortedStudents[0]?.student.fullName,
        growthDelta: computeGrowthDelta(groupAttempts),
      };
    })
    .sort((a, b) => b.avgPercentage - a.avgPercentage);
}

export function computeSubjectSummaries(
  subjects: Subject[],
  attempts: Attempt[],
): SubjectAnalyticsSummary[] {
  return subjects
    .map((subject) => {
      const subAttempts = attempts.filter((a) => a.subjectId === subject.id);
      const avgPercentage =
        subAttempts.length > 0
          ? Number((subAttempts.reduce((sum, a) => sum + a.percentage, 0) / subAttempts.length).toFixed(1))
          : 0;
      const passed = subAttempts.filter((a) => a.percentage >= 55).length;
      const passRate = subAttempts.length > 0 ? Math.round((passed / subAttempts.length) * 100) : 0;

      return {
        subject,
        attemptsCount: subAttempts.length,
        avgPercentage,
        passRate,
      };
    })
    .sort((a, b) => b.avgPercentage - a.avgPercentage);
}

export function computeMasteryDistribution(attempts: Attempt[]) {
  const tiers = [
    { name: "A'lo (86–100%)", key: 'excellent', count: 0, color: '#16A34A' },
    { name: 'Yaxshi (71–85%)', key: 'good', count: 0, color: '#2563EB' },
    { name: 'Qoniqarli (55–70%)', key: 'satisfactory', count: 0, color: '#D97706' },
    { name: 'Past (<55%)', key: 'low', count: 0, color: '#DC2626' },
  ];

  for (const a of attempts) {
    if (a.percentage >= 86) tiers[0].count += 1;
    else if (a.percentage >= 71) tiers[1].count += 1;
    else if (a.percentage >= 55) tiers[2].count += 1;
    else tiers[3].count += 1;
  }

  const total = attempts.length || 1;
  return tiers.map((t) => ({
    ...t,
    percent: attempts.length > 0 ? Math.round((t.count / total) * 100) : 0,
  }));
}

export function computeTimeSeries(attempts: Attempt[], period: 'weekly' | 'monthly') {
  const sorted = [...attempts].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  const buckets = new Map<string, { label: string; total: number; count: number; order: number }>();

  for (const a of sorted) {
    const d = a.submittedAt;
    let key = '';
    let label = '';
    let order = 0;

    if (period === 'weekly') {
      const startOfWeek = new Date(d);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      key = startOfWeek.toISOString().slice(0, 10);
      label = `${String(startOfWeek.getDate()).padStart(2, '0')}.${String(startOfWeek.getMonth() + 1).padStart(2, '0')}`;
      order = startOfWeek.getTime();
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
      label = `${months[d.getMonth()]} ${d.getFullYear()}`;
      order = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    }

    const existing = buckets.get(key) || { label, total: 0, count: 0, order };
    existing.total += a.percentage;
    existing.count += 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.order - b.order)
    .map((b) => ({
      label: b.label,
      avgPercentage: Number((b.total / b.count).toFixed(1)),
      attemptsCount: b.count,
    }));
}

export function formatExamTypeUz(type: ExamType): string {
  if (type === 'oraliq') return 'Oraliq nazorat';
  if (type === 'joriy') return 'Joriy nazorat';
  return 'Yakuniy nazorat';
}

export function formatUzDate(date?: Date): string {
  if (!date) return '—';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y} ${hh}:${mm}`;
}
