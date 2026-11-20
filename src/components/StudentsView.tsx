import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Upload,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Eye,
  X,
  Download,
  ImagePlus,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { computeStudentSummaries, type StudentAnalyticsSummary } from '../lib/analytics';
import {
  downloadStudentImportTemplate,
  exportStudentsReportExcel,
  exportStudentsReportPdf,
  parseStudentsExcel,
  type ImportedStudentRow,
} from '../lib/exportUtils';
import { uploadImageAsset } from '../lib/imageUtils';
import { Avatar } from './Avatar';
import { StudentProfileModal } from './StudentProfileModal';
import { useToast } from './ToastProvider';

export function StudentsView() {
  const {
    students,
    groups,
    attempts,
    saveStudent,
    importStudentsBatch,
    deleteStudent,
    getStudentPrivateCredentials,
  } = useData();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [profileTarget, setProfileTarget] = useState<StudentAnalyticsSummary | null>(null);

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [fullName, setFullName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  // Excel import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ImportedStudentRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summaries = useMemo(
    () => computeStudentSummaries(students, attempts),
    [students, attempts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter((s) => {
      if (groupFilter !== 'all' && s.student.groupId !== groupFilter) return false;
      if (q) {
        return (
          s.student.fullName.toLowerCase().includes(q) ||
          s.student.login.toLowerCase().includes(q) ||
          s.student.groupName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [summaries, search, groupFilter]);

  const openCreateModal = () => {
    setEditingId(undefined);
    setFullName('');
    setGroupId(groups[0]?.id || '');
    setLogin('');
    setPassword('');
    setPhone('');
    setPhotoUrl(undefined);
    setModalOpen(true);
  };

  const openEditModal = async (summary: StudentAnalyticsSummary) => {
    const st = summary.student;
    setEditingId(st.id);
    setFullName(st.fullName);
    setGroupId(st.groupId);
    setLogin(st.login);
    setPhotoUrl(st.photoUrl);
    setPassword('');
    setPhone('');
    setModalOpen(true);

    try {
      const creds = await getStudentPrivateCredentials(st.id);
      if (creds) {
        setPassword(creds.password);
        setPhone(creds.phone || '');
      }
    } catch {
      // ignore if credentials absent
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadImageAsset(file, 'students');
      setPhotoUrl(url);
      showToast('Rasm muvaffaqiyatli yuklandi.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rasm yuklashda xatolik.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !groupId) {
      showToast('F.I.Sh. va guruh majburiy.', 'error');
      return;
    }
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) {
      showToast('Tanlangan guruh topilmadi.', 'error');
      return;
    }

    const autoLogin =
      login.trim() ||
      `${fullName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 20)}_${Date.now().toString(36).slice(-4)}`;

    setSaving(true);
    try {
      await saveStudent({
        id: editingId,
        fullName,
        groupId: targetGroup.id,
        groupName: targetGroup.name,
        login: autoLogin,
        password: password.trim() || undefined,
        phone: phone.trim() || undefined,
        photoUrl,
        isDemo: false,
      });
      showToast(editingId ? 'O‘quvchi ma’lumotlari yangilandi.' : 'Yangi o‘quvchi qo‘shildi.', 'success');
      setModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Saqlashda xatolik.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (summary: StudentAnalyticsSummary) => {
    try {
      await deleteStudent(summary.student.id, summary.student.login);
      showToast(`${summary.student.fullName} o‘chirildi.`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'O‘chirishda xatolik.', 'error');
    }
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseStudentsExcel(file);
      setParsedRows(rows);
      setImportModalOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Excel faylni o‘qishda xatolik.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const count = await importStudentsBatch(parsedRows, false);
      showToast(`${count} nafar o‘quvchi Exceldan import qilindi.`, 'success');
      setImportModalOpen(false);
      setParsedRows([]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import xatoligi.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="surface-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="F.I.Sh., login yoki guruh bo‘yicha qidirish..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#DCE5F2] rounded-xl bg-[#F8FAFD] focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[#DCE5F2] rounded-xl bg-[#F8FAFD] focus:bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="all">Barcha guruhlar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => downloadStudentImportTemplate()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Shablon
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Excel import
          </button>
          <button
            type="button"
            onClick={() => exportStudentsReportExcel(filtered)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel eksport
          </button>
          <button
            type="button"
            onClick={() => exportStudentsReportPdf(filtered)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            O‘quvchi qo‘shish
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="surface-card rounded-2xl overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCE5F2] bg-[#F8FAFD] text-xs font-semibold text-slate-500">
                  <th className="py-3.5 px-4">O‘quvchi</th>
                  <th className="py-3.5 px-4">Guruh</th>
                  <th className="py-3.5 px-4">Kod</th>
                  <th className="py-3.5 px-4 text-right">Testlar</th>
                  <th className="py-3.5 px-4 text-right">O‘rtacha ball</th>
                  <th className="py-3.5 px-4 text-right">O‘sish</th>
                  <th className="py-3.5 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((s) => (
                  <tr key={s.student.id} className="hover:bg-blue-50/35 transition-colors">
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => setProfileTarget(s)}
                        className="flex items-center gap-3 text-left cursor-pointer group"
                      >
                        <Avatar src={s.student.photoUrl} name={s.student.fullName} size="sm" />
                        <div>
                          <p className="font-semibold text-[#09142B] group-hover:text-blue-600 transition-colors">
                            {s.student.fullName}
                          </p>
                          {s.student.isDemo && (
                            <p className="text-[11px] text-slate-400">Demo yozuv</p>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{s.student.groupName}</td>
                    <td className="py-3.5 px-4 font-mono-num text-xs text-slate-500">{s.student.login}</td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-slate-700">{s.attemptsCount}</td>
                    <td className="py-3.5 px-4 text-right">
                      {s.attemptsCount > 0 ? (
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="hidden sm:block w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${s.avgPercentage}%` }}
                            />
                          </div>
                          <span className="font-mono-num font-bold text-[#09142B]">
                            {s.avgPercentage}%
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono-num text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-semibold ${
                        s.growthDelta > 0
                          ? 'text-emerald-700'
                          : s.growthDelta < 0
                            ? 'text-red-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {s.attemptsCount >= 2 ? (s.growthDelta > 0 ? `+${s.growthDelta}%` : `${s.growthDelta}%`) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setProfileTarget(s)}
                          className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                          title="Individual profil"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          title="Tahrirlash"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="O‘chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center px-6">
            <p className="text-sm text-slate-500 mb-4">
              O‘quvchilar ro‘yxati bo‘sh. Yangi o‘quvchi qo‘shing yoki Exceldan import qiling.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Birinchi o‘quvchini qo‘shish
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DCE5F2] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="px-6 py-4 navy-architect-grid text-white flex items-center justify-between">
              <h3 className="font-display font-bold text-base">
                {editingId ? 'O‘quvchini tahrirlash' : 'Yangi o‘quvchi qo‘shish'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <Avatar src={photoUrl} name={fullName || 'O'} size="lg" />
                <div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer">
                    <ImagePlus className="w-4 h-4 text-blue-600" />
                    {uploadingPhoto ? 'Yuklanmoqda...' : 'Rasm yuklash'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1">JPG, PNG yoki WEBP formatda</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">F.I.Sh. *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masalan: Karimov Azizbek Dilshodovich"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Guruh *</label>
                {groups.length > 0 ? (
                  <select
                    required
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-red-600 py-2">
                    Avval «Guruhlar» bo‘limida kamida bitta guruh yarating.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kod / Login (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Bo‘sh qoldirilsa avtomatik"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Parol (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Shart emas"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Telefon (ixtiyoriy)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={saving || groups.length === 0}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Preview Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900">
                Exceldan import tasdiqlash ({parsedRows.length} ta o‘quvchi)
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3">F.I.Sh.</th>
                    <th className="py-2 px-3">Guruh</th>
                    <th className="py-2 px-3">Login</th>
                    <th className="py-2 px-3">Parol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium text-slate-900">{r.fullName}</td>
                      <td className="py-2 px-3 text-slate-700">{r.groupName}</td>
                      <td className="py-2 px-3 font-mono-num text-slate-600">{r.login}</td>
                      <td className="py-2 px-3 font-mono-num text-slate-600">{r.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={importing}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 cursor-pointer"
              >
                {importing ? 'Saqlanmoqda...' : 'Bazaga saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentProfileModal summary={profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
