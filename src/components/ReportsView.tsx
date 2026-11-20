import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Users, Layers, BookOpen, Award, TrendingUp, UserCheck } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  computeGroupSummaries,
  computeStudentSummaries,
  computeSubjectSummaries,
} from '../lib/analytics';
import {
  exportGroupsReportExcel,
  exportGroupsReportPdf,
  exportIndividualStudentExcel,
  exportIndividualStudentPdf,
  exportStudentsReportExcel,
  exportStudentsReportPdf,
  exportSubjectsReportExcel,
  exportSubjectsReportPdf,
} from '../lib/exportUtils';
import { useToast } from './ToastProvider';

export function ReportsView() {
  const { students, groups, subjects, attempts } = useData();
  const { showToast } = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const studentSummaries = useMemo(() => computeStudentSummaries(students, attempts), [students, attempts]);
  const groupSummaries = useMemo(() => computeGroupSummaries(groups, students, attempts), [groups, students, attempts]);
  const subjectSummaries = useMemo(() => computeSubjectSummaries(subjects, attempts), [subjects, attempts]);

  const rankedStudents = useMemo(
    () => [...studentSummaries].sort((a, b) => b.avgPercentage - a.avgPercentage),
    [studentSummaries],
  );

  const growthSortedStudents = useMemo(
    () => [...studentSummaries].sort((a, b) => b.growthDelta - a.growthDelta),
    [studentSummaries],
  );

  const activeIndividual = useMemo(() => {
    if (studentSummaries.length === 0) return null;
    return studentSummaries.find((s) => s.student.id === selectedStudentId) || studentSummaries[0];
  }, [studentSummaries, selectedStudentId]);

  const safeRun = async (fn: () => void | Promise<void>, label: string) => {
    try {
      await fn();
      showToast(`«${label}» fayli yuklab olindi.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Eksport qilishda xatolik.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="navy-architect-grid text-white rounded-2xl p-6 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <h2 className="font-display text-xl font-bold text-white">Excel va PDF hisobotlar markazi</h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-1">
          Bazadagi real natijalar asosida rasmiy jadvallar va individual hisobotlarni yuklab oling
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* 1. O'quvchilar hisoboti */}
        <div className="surface-card rounded-2xl p-6 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">O‘quvchilar hisoboti</h3>
            <p className="text-xs text-slate-500 mb-5">
              Barcha {students.length} nafar o‘quvchining umumiy o‘rtacha bali, maksimal/minimal natijalari.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => safeRun(() => exportStudentsReportExcel(studentSummaries), "O'quvchilar Excel")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => safeRun(() => exportStudentsReportPdf(studentSummaries), "O'quvchilar PDF")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B1528] hover:bg-slate-800 text-xs font-medium text-white cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* 2. Guruh hisoboti */}
        <div className="surface-card rounded-2xl p-6 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">Guruhlar hisoboti</h3>
            <p className="text-xs text-slate-500 mb-5">
              {groups.length} ta guruh bo‘yicha o‘quvchilar soni, o‘rtacha ko‘rsatkich va yetakchilar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => safeRun(() => exportGroupsReportExcel(groupSummaries), 'Guruhlar Excel')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => safeRun(() => exportGroupsReportPdf(groupSummaries), 'Guruhlar PDF')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B1528] hover:bg-slate-800 text-xs font-medium text-white cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* 3. Fanlar hisoboti */}
        <div className="surface-card rounded-2xl p-6 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">Fanlar hisoboti</h3>
            <p className="text-xs text-slate-500 mb-5">
              {subjects.length} ta fan kesimida o‘rtacha o‘zlashtirish va muvaffaqiyatli o‘tish foizlari.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => safeRun(() => exportSubjectsReportExcel(subjectSummaries), 'Fanlar Excel')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => safeRun(() => exportSubjectsReportPdf(subjectSummaries), 'Fanlar PDF')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B1528] hover:bg-slate-800 text-xs font-medium text-white cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* 4. Reyting hisoboti */}
        <div className="surface-card rounded-2xl p-6 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">Reyting hisoboti</h3>
            <p className="text-xs text-slate-500 mb-5">
              Eng yuqori natijadan pastga qarab saralangan umumiy akademik reyting jadvali.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => safeRun(() => exportStudentsReportExcel(rankedStudents), 'Reyting Excel')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Excel
            </button>
            <button
              type="button"
              onClick={() =>
                safeRun(() => exportStudentsReportPdf(rankedStudents, 'Umumiy reyting hisoboti'), 'Reyting PDF')
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B1528] hover:bg-slate-800 text-xs font-medium text-white cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* 5. O'sish va pasayish hisoboti */}
        <div className="surface-card rounded-2xl p-6 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">O‘sish va pasayish</h3>
            <p className="text-xs text-slate-500 mb-5">
              Nazoratlar orasidagi dinamika foizi bo‘yicha saralangan o‘sish/pasayish hisoboti.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                safeRun(() => exportStudentsReportExcel(growthSortedStudents), "O'sish va pasayish Excel")
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Excel
            </button>
            <button
              type="button"
              onClick={() =>
                safeRun(
                  () => exportStudentsReportPdf(growthSortedStudents, "O'sish va pasayish hisoboti"),
                  "O'sish va pasayish PDF",
                )
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B1528] hover:bg-slate-800 text-xs font-medium text-white cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* 6. Individual profil hisoboti */}
        <div className="surface-card rounded-2xl p-6 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 mb-1">Individual profil hisoboti</h3>
            <p className="text-xs text-slate-500 mb-3">
              Tanlangan o‘quvchining shaxsiy natijalari va testlar tarixi.
            </p>
            <select
              value={activeIndividual?.student.id || ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white mb-4"
            >
              {studentSummaries.length === 0 && <option value="">O‘quvchilar yo‘q</option>}
              {studentSummaries.map((s) => (
                <option key={s.student.id} value={s.student.id}>
                  {s.student.fullName} ({s.student.groupName})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!activeIndividual}
              onClick={() =>
                activeIndividual &&
                safeRun(() => exportIndividualStudentExcel(activeIndividual), 'Individual Excel')
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Excel
            </button>
            <button
              type="button"
              disabled={!activeIndividual}
              onClick={() =>
                activeIndividual &&
                safeRun(() => exportIndividualStudentPdf(activeIndividual), 'Individual PDF')
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white disabled:opacity-40 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
