import React, { useRef, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Upload,
  Download,
  ImagePlus,
  X,
  Shuffle,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatExamTypeUz } from '../lib/analytics';
import {
  downloadQuestionImportTemplate,
  parseQuestionsExcel,
} from '../lib/exportUtils';
import {
  downloadWordQuestionTemplate,
  parseQuestionsWord,
} from '../lib/wordImport';
import { uploadImageAsset } from '../lib/imageUtils';
import type { ExamType, Student, TestExam, TestStatus } from '../types';
import { ExamRunner } from './ExamRunner';
import { useToast } from './ToastProvider';

interface DraftQuestion {
  id?: string;
  text: string;
  imageUrl?: string;
  options: [string, string, string, string];
  correctIndex: number;
  points: number;
}

export function TestsView() {
  const {
    tests,
    subjects,
    groups,
    students,
    saveTestWithQuestions,
    deleteTest,
    fetchTestQuestions,
  } = useData();
  const { showToast } = useToast();

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [examType, setExamType] = useState<ExamType>('oraliq');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [status, setStatus] = useState<TestStatus>('active');
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  // Runner preview modal (staff picking student to run/test exam)
  const [pickStudentForTest, setPickStudentForTest] = useState<TestExam | null>(null);
  const [activeRunner, setActiveRunner] = useState<{ test: TestExam; student: Student } | null>(null);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const quickWordInputRef = useRef<HTMLInputElement>(null);

  const openCreateModal = (prefilledQuestions?: DraftQuestion[], suggestedTitle?: string) => {
    setEditingId(undefined);
    setTitle(suggestedTitle || '');
    setSubjectId(subjects[0]?.id || '');
    setSelectedGroupIds(groups[0] ? [groups[0].id] : []);
    setExamType('oraliq');
    setDurationMinutes(25);
    setMaxAttempts(1);
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setStatus('active');
    setQuestions(
      prefilledQuestions && prefilledQuestions.length > 0
        ? prefilledQuestions
        : [
            {
              text: '',
              options: ['', '', '', ''],
              correctIndex: 0,
              points: 5,
            },
          ],
    );
    setEditorOpen(true);
  };

  const openEditModal = async (t: TestExam) => {
    setEditingId(t.id);
    setTitle(t.title);
    setSubjectId(t.subjectId);
    setSelectedGroupIds(t.groupIds);
    setExamType(t.examType);
    setDurationMinutes(t.durationMinutes);
    setMaxAttempts(t.maxAttempts);
    setShuffleQuestions(t.shuffleQuestions);
    setShuffleOptions(t.shuffleOptions);
    setStatus(t.status);
    setEditorOpen(true);

    try {
      const qs = await fetchTestQuestions(t.id);
      setQuestions(
        qs.map((q) => ({
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl,
          options: [
            q.options[0] || '',
            q.options[1] || '',
            q.options[2] || '',
            q.options[3] || '',
          ],
          correctIndex: q.correctIndex,
          points: q.points,
        })),
      );
    } catch {
      showToast('Savollarni yuklashda xatolik.', 'error');
    }
  };

  const addQuestionRow = () => {
    setQuestions((prev) => [
      ...prev,
      { text: '', options: ['', '', '', ''], correctIndex: 0, points: 5 },
    ]);
  };

  const removeQuestionRow = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestionField = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const handleQuestionImageUpload = async (idx: number, file?: File) => {
    if (!file) return;
    try {
      const url = await uploadImageAsset(file, 'questions');
      updateQuestionField(idx, { imageUrl: url });
      showToast('Savol rasmi yuklandi.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rasm yuklashda xatolik.', 'error');
    }
  };

  const mergeImportedQuestions = (
    imported: Array<{ text: string; options: [string, string, string, string]; correctIndex: number; points: number }>,
  ) => {
    setQuestions((prev) => [
      ...prev.filter((q) => q.text.trim().length > 0),
      ...imported.map((iq) => ({
        text: iq.text,
        options: iq.options,
        correctIndex: iq.correctIndex,
        points: iq.points,
      })),
    ]);
  };

  const handleExcelQuestionsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await parseQuestionsExcel(file);
      mergeImportedQuestions(imported);
      showToast(`${imported.length} ta savol Exceldan qo‘shildi.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Exceldan o‘qishda xatolik.', 'error');
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const handleWordQuestionsImport = async (
    e: React.ChangeEvent<HTMLInputElement>,
    openNewTestAfter = false,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await parseQuestionsWord(file);
      const mapped: DraftQuestion[] = imported.map((iq) => ({
        text: iq.text,
        options: iq.options,
        correctIndex: iq.correctIndex,
        points: iq.points,
      }));
      if (openNewTestAfter) {
        const baseName = file.name.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim();
        openCreateModal(mapped, baseName);
      } else {
        mergeImportedQuestions(imported);
      }
      showToast(`${imported.length} ta savol Word (.docx) fayldan yuklandi.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Word faylni o‘qishda xatolik.', 'error');
    } finally {
      if (wordInputRef.current) wordInputRef.current.value = '';
      if (quickWordInputRef.current) quickWordInputRef.current.value = '';
    }
  };

  const toggleGroupId = (gid: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid],
    );
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subjectId || selectedGroupIds.length === 0) {
      showToast('Test nomi, fan va kamida bitta guruh tanlang.', 'error');
      return;
    }
    const validQuestions = questions.filter(
      (q) => q.text.trim() && q.options.every((o) => o.trim().length > 0),
    );
    if (validQuestions.length === 0) {
      showToast('Kamida 1 ta to‘liq to‘ldirilgan savol va 4 ta variant kiriting.', 'error');
      return;
    }
    const subj = subjects.find((s) => s.id === subjectId);
    if (!subj) {
      showToast('Tanlangan fan topilmadi.', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveTestWithQuestions({
        id: editingId,
        title,
        subjectId: subj.id,
        subjectName: subj.name,
        groupIds: selectedGroupIds,
        examType,
        durationMinutes,
        shuffleQuestions,
        shuffleOptions,
        maxAttempts,
        status,
        isDemo: false,
        questions: validQuestions,
      });
      showToast(editingId ? 'Test yangilandi.' : 'Yangi test yaratildi.', 'success');
      setEditorOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Testni saqlashda xatolik.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (activeRunner) {
    return (
      <ExamRunner
        test={activeRunner.test}
        student={activeRunner.student}
        onExit={() => setActiveRunner(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Midnight Navy Hero Header with Word (.docx) Quick Import */}
      <div className="navy-architect-grid text-white rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Testlar va nazorat konstruktori</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Word (.docx) va Exceldan tezkor import, rasmli savollar, aralashtirish, taymer va urinish cheklovi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={quickWordInputRef}
            type="file"
            accept=".docx"
            onChange={(e) => handleWordQuestionsImport(e, true)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => downloadWordQuestionTemplate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/15 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-blue-300" />
            Word shablon (.docx)
          </button>
          <button
            type="button"
            onClick={() => quickWordInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white text-[#061024] hover:bg-blue-50 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            Word (.docx) dan test yuklash
          </button>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_8px_20px_-4px_rgba(37,99,235,0.6)] cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Yangi test yaratish
          </button>
        </div>
      </div>

      {/* Tests Grid */}
      {tests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tests.map((t) => {
            const groupNames = t.groupIds
              .map((gid) => groups.find((g) => g.id === gid)?.name)
              .filter(Boolean)
              .join(', ');
            return (
              <div
                key={t.id}
                className="surface-card rounded-2xl overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5"
              >
                <div>
                  <div className="bg-[#061024] text-white px-5 py-3.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-blue-200 truncate">
                      {t.subjectName} · {formatExamTypeUz(t.examType)}
                    </span>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        t.status === 'active'
                          ? 'text-emerald-400'
                          : t.status === 'draft'
                            ? 'text-amber-300'
                            : 'text-slate-400'
                      }`}
                    >
                      {t.status === 'active' ? 'Faol' : t.status === 'draft' ? 'Qoralama' : 'Arxiv'}
                    </span>
                  </div>

                  <div className="p-5">
                    <h3 className="font-display font-bold text-base text-[#09142B] mb-1.5">{t.title}</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Guruhlar: <span className="text-slate-800 font-semibold">{groupNames || '—'}</span>
                    </p>

                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center bg-[#F8FAFD] rounded-xl">
                      <div>
                        <p className="text-[11px] text-slate-500">Savollar</p>
                        <p className="font-mono-num text-sm font-bold text-[#09142B]">{t.questionCount}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-blue-600" /> Vaqt
                        </p>
                        <p className="font-mono-num text-sm font-bold text-[#09142B]">{t.durationMinutes} daq</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Urinish</p>
                        <p className="font-mono-num text-sm font-bold text-[#09142B]">{t.maxAttempts}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPickStudentForTest(t)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Testni boshlash
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      className="p-2 rounded-xl text-slate-500 hover:text-[#09142B] hover:bg-slate-100 cursor-pointer"
                      title="Tahrirlash"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteTest(t.id);
                        showToast('Test o‘chirildi.', 'info');
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      title="O‘chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-card rounded-2xl py-16 text-center px-6">
          <p className="text-sm text-slate-500 mb-4">
            Hali testlar yaratilmagan. Qo‘lda yarating yoki tayyor Word (.docx) fayldan yuklang.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => quickWordInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCE5F2] hover:bg-slate-50 text-[#09142B] text-xs font-semibold cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              Word (.docx) dan yuklash
            </button>
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Birinchi testni yaratish
            </button>
          </div>
        </div>
      )}

      {/* Test Create/Edit Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#DCE5F2] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 navy-architect-grid text-white flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base">
                  {editingId ? 'Testni tahrirlash' : 'Yangi test yaratish'}
                </h3>
                <p className="text-xs text-blue-200/80">
                  Word (.docx), Excel import yoki qo‘lda savollar tuzish
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTest} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test nomi *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Masalan: 1-Oraliq nazorat — Algebra"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#DCE5F2] rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fan *</label>
                  {subjects.length > 0 ? (
                    <select
                      required
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-[#DCE5F2] rounded-xl bg-white"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-red-600 py-2">Avval «Fanlar» bo‘limida fan qo‘shing.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nazorat turi</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as ExamType)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#DCE5F2] rounded-xl bg-white"
                  >
                    <option value="oraliq">Oraliq nazorat</option>
                    <option value="joriy">Joriy nazorat</option>
                    <option value="yakuniy">Yakuniy nazorat</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Vaqt (daq.)</label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-[#DCE5F2] rounded-xl font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Urinish limiti</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-[#DCE5F2] rounded-xl font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Holati</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TestStatus)}
                      className="w-full px-2 py-2 text-sm border border-[#DCE5F2] rounded-xl bg-white"
                    >
                      <option value="active">Faol</option>
                      <option value="draft">Qoralama</option>
                      <option value="archived">Arxiv</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-5">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <Shuffle className="w-3.5 h-3.5 text-slate-500" />
                    Savollarni aralashtirish
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    Variantlarni aralashtirish
                  </label>
                </div>

                {/* Group Multi-Select */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Guruhlarni tanlang *</label>
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const active = selectedGroupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroupId(g.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#061024] text-white border-[#061024]'
                              : 'bg-white text-slate-700 border-[#DCE5F2] hover:bg-slate-50'
                          }`}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Questions Section with Word (.docx) + Excel Import */}
              <div className="border-t border-[#DCE5F2] pt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-display font-bold text-sm text-[#09142B]">
                      Savollar ({questions.length} ta · Jami{' '}
                      <span className="font-mono-num">
                        {questions.reduce((s, q) => s + Number(q.points || 0), 0)}
                      </span>{' '}
                      ball)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Word (.docx) formatlar: «1. Savol *A) B) C) D)», «Javob: A», «++++ / ====» (HEMIS) yoki Word jadval
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={wordInputRef}
                      type="file"
                      accept=".docx"
                      onChange={(e) => handleWordQuestionsImport(e, false)}
                      className="hidden"
                    />
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelQuestionsImport}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => downloadWordQuestionTemplate()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DCE5F2] hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      Word shablon
                    </button>
                    <button
                      type="button"
                      onClick={() => wordInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Worddan (.docx) import
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadQuestionImportTemplate()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DCE5F2] hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Excel shablon
                    </button>
                    <button
                      type="button"
                      onClick={() => excelInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DCE5F2] hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Exceldan yuklash
                    </button>
                    <button
                      type="button"
                      onClick={addQuestionRow}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Savol qo‘shish
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {questions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 rounded-2xl border border-[#DCE5F2] bg-[#F8FAFD] space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono-num text-xs font-bold text-[#09142B] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          Savol #{qIdx + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            Ball:
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={q.points}
                              onChange={(e) =>
                                updateQuestionField(qIdx, { points: Number(e.target.value) || 1 })
                              }
                              className="w-16 px-2 py-1 border border-[#DCE5F2] rounded-lg bg-white font-mono-num text-xs"
                            />
                          </label>
                          <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DCE5F2] bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                            <ImagePlus className="w-3.5 h-3.5 text-blue-600" />
                            Rasm
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleQuestionImageUpload(qIdx, e.target.files?.[0])}
                              className="hidden"
                            />
                          </label>
                          {questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestionRow(qIdx)}
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={q.text}
                        onChange={(e) => updateQuestionField(qIdx, { text: e.target.value })}
                        placeholder="Savol matnini kiriting..."
                        className="w-full px-3.5 py-2 text-sm border border-[#DCE5F2] rounded-xl bg-white focus:outline-none focus:border-blue-600"
                      />

                      {q.imageUrl && (
                        <div className="relative inline-block">
                          <img
                            src={q.imageUrl}
                            alt="Savol rasmi"
                            referrerPolicy="no-referrer"
                            className="h-28 rounded-xl border border-[#DCE5F2] object-contain bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuestionField(qIdx, { imageUrl: undefined })}
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(['A', 'B', 'C', 'D'] as const).map((letter, optIdx) => (
                          <div key={letter} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={q.correctIndex === optIdx}
                              onChange={() => updateQuestionField(qIdx, { correctIndex: optIdx })}
                              className="w-4 h-4 text-blue-600 cursor-pointer"
                              title="To‘g‘ri javob sifatida belgilash"
                            />
                            <span className="font-mono-num text-xs font-bold text-slate-600 w-4">
                              {letter}
                            </span>
                            <input
                              type="text"
                              value={q.options[optIdx]}
                              onChange={(e) => {
                                const nextOpts: [string, string, string, string] = [...q.options] as [
                                  string,
                                  string,
                                  string,
                                  string,
                                ];
                                nextOpts[optIdx] = e.target.value;
                                updateQuestionField(qIdx, { options: nextOpts });
                              }}
                              placeholder={`${letter} varianti`}
                              className={`flex-1 px-3 py-1.5 text-sm border rounded-xl bg-white focus:outline-none focus:border-blue-600 ${
                                q.correctIndex === optIdx
                                  ? 'border-blue-500 ring-1 ring-blue-500/20'
                                  : 'border-[#DCE5F2]'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#DCE5F2] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE5F2] text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saqlanmoqda...' : 'Testni saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Select Student Modal to Start Exam */}
      {pickStudentForTest && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DCE5F2] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-6 py-4 navy-architect-grid text-white flex items-center justify-between">
              <h3 className="font-display font-bold text-base">
                Test topshiruvchi o‘quvchini tanlang
              </h3>
              <button
                type="button"
                onClick={() => setPickStudentForTest(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {students
                .filter((st) => pickStudentForTest.groupIds.includes(st.groupId))
                .map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setActiveRunner({ test: pickStudentForTest, student: st });
                      setPickStudentForTest(null);
                    }}
                    className="w-full py-3 px-3 flex items-center justify-between hover:bg-blue-50/50 rounded-xl text-left cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#09142B]">{st.fullName}</p>
                      <p className="text-xs text-slate-500">{st.groupName}</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600">Boshlash</span>
                  </button>
                ))}
              {students.filter((st) => pickStudentForTest.groupIds.includes(st.groupId)).length === 0 && (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Ushbu test biriktirilgan guruhlarda o‘quvchilar topilmadi.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
