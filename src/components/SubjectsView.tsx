import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, BookOpen, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { computeSubjectSummaries } from '../lib/analytics';
import { useToast } from './ToastProvider';

export function SubjectsView() {
  const { subjects, tests, attempts, saveSubject, deleteSubject } = useData();
  const { showToast } = useToast();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const subjectSummaries = useMemo(
    () => computeSubjectSummaries(subjects, attempts),
    [subjects, attempts],
  );

  const activeSubject = useMemo(() => {
    if (subjectSummaries.length === 0) return null;
    return subjectSummaries.find((s) => s.subject.id === selectedSubjectId) || subjectSummaries[0];
  }, [subjectSummaries, selectedSubjectId]);

  const activeSubjectTests = useMemo(() => {
    if (!activeSubject) return [];
    return tests.filter((t) => t.subjectId === activeSubject.subject.id);
  }, [tests, activeSubject]);

  const activeSubjectAttempts = useMemo(() => {
    if (!activeSubject) return [];
    return attempts.filter((a) => a.subjectId === activeSubject.subject.id).slice(0, 12);
  }, [attempts, activeSubject]);

  const openCreate = () => {
    setEditingId(undefined);
    setName('');
    setCode('');
    setTeacherName('');
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const s = subjects.find((x) => x.id === id);
    if (!s) return;
    setEditingId(s.id);
    setName(s.name);
    setCode(s.code || '');
    setTeacherName(s.teacherName || '');
    setDescription(s.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveSubject({ id: editingId, name, code, teacherName, description, isDemo: false });
      showToast(editingId ? 'Fan yangilandi.' : 'Yangi fan qo‘shildi.', 'success');
      setModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Xatolik.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="navy-architect-grid text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Fanlar katalogi va natijalari</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Har bir fan bo‘yicha testlar va o‘zlashtirish ko‘rsatkichlari alohida saqlanadi
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_8px_20px_-4px_rgba(37,99,235,0.6)] cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Fan qo‘shish
        </button>
      </div>

      {/* Subjects Grid */}
      {subjectSummaries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {subjectSummaries.map((s) => {
            const subTestsCount = tests.filter((t) => t.subjectId === s.subject.id).length;
            const isSelected = activeSubject?.subject.id === s.subject.id;
            return (
              <div
                key={s.subject.id}
                onClick={() => setSelectedSubjectId(s.subject.id)}
                className={`surface-card rounded-2xl p-5 transition-all cursor-pointer ${
                  isSelected ? 'ring-2 ring-blue-600 border-blue-600' : 'hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl navy-architect-grid text-blue-300 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEdit(s.subject.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSubject(s.subject.id);
                        showToast(`${s.subject.name} o‘chirildi.`, 'info');
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-display font-bold text-base text-slate-900 truncate">{s.subject.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {s.subject.code || 'Kodsiz'} · {s.subject.teacherName || 'O‘qituvchi belgilanmagan'}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{subTestsCount} ta test · {s.attemptsCount} urinish</span>
                  <span className="font-mono-num font-bold text-blue-700">{s.avgPercentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
          <p className="text-sm text-slate-500 mb-4">Hali fanlar qo‘shilmagan.</p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Birinchi fanni qo‘shish
          </button>
        </div>
      )}

      {/* Selected Subject Isolated Tests & Results */}
      {activeSubject && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="surface-card rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DCE5F2] bg-[#F8FAFD]">
              <h3 className="font-display font-bold text-sm text-[#09142B]">
                «{activeSubject.subject.name}» fanidagi testlar ({activeSubjectTests.length})
              </h3>
            </div>
            {activeSubjectTests.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {activeSubjectTests.map((t) => (
                  <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#09142B] truncate">{t.title}</p>
                      <p className="text-xs text-slate-500">
                        {t.questionCount} ta savol · {t.durationMinutes} daqiqa · {t.totalPoints} ball
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 shrink-0">
                      {t.status === 'active' ? 'Faol' : t.status === 'draft' ? 'Qoralama' : 'Arxiv'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-10 text-center">Ushbu fanda testlar mavjud emas.</p>
            )}
          </div>

          <div className="surface-card rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DCE5F2] bg-[#F8FAFD]">
              <h3 className="font-display font-bold text-sm text-[#09142B]">
                «{activeSubject.subject.name}» bo‘yicha natijalar
              </h3>
            </div>
            {activeSubjectAttempts.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {activeSubjectAttempts.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{a.studentName}</p>
                      <p className="text-xs text-slate-500 truncate">{a.groupName} · {a.testTitle}</p>
                    </div>
                    <span className="font-mono-num font-bold text-slate-900 shrink-0">
                      {a.percentage}% ({a.score}/{a.maxScore})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-10 text-center">Ushbu fandan hali natijalar yo‘q.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900">
                {editingId ? 'Fanni tahrirlash' : 'Yangi fan qo‘shish'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fan nomi *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: Matematika"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fan kodi</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="MAT-101"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">O‘qituvchi</label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="F.I.Sh."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tavsif</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 cursor-pointer"
                >
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
