import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, UserPlus, X, Award } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useData } from '../context/DataContext';
import { computeGroupSummaries, computeStudentSummaries, type StudentAnalyticsSummary } from '../lib/analytics';
import { Avatar } from './Avatar';
import { StudentProfileModal } from './StudentProfileModal';
import { useToast } from './ToastProvider';

export function GroupsView() {
  const { groups, students, attempts, saveGroup, deleteGroup, assignStudentsToGroup } = useData();
  const { showToast } = useToast();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [curatorName, setCuratorName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [assignModalGroupId, setAssignModalGroupId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [profileTarget, setProfileTarget] = useState<StudentAnalyticsSummary | null>(null);

  const groupSummaries = useMemo(
    () => computeGroupSummaries(groups, students, attempts),
    [groups, students, attempts],
  );

  const studentSummaries = useMemo(
    () => computeStudentSummaries(students, attempts),
    [students, attempts],
  );

  const activeGroupSummary = useMemo(() => {
    if (groupSummaries.length === 0) return null;
    return groupSummaries.find((g) => g.group.id === selectedGroupId) || groupSummaries[0];
  }, [groupSummaries, selectedGroupId]);

  const activeGroupStudents = useMemo(() => {
    if (!activeGroupSummary) return [];
    return studentSummaries
      .filter((s) => s.student.groupId === activeGroupSummary.group.id)
      .sort((a, b) => b.avgPercentage - a.avgPercentage);
  }, [studentSummaries, activeGroupSummary]);

  const openCreate = () => {
    setEditingId(undefined);
    setName('');
    setCuratorName('');
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (gId: string) => {
    const g = groups.find((x) => x.id === gId);
    if (!g) return;
    setEditingId(g.id);
    setName(g.name);
    setCuratorName(g.curatorName || '');
    setDescription(g.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveGroup({ id: editingId, name, curatorName, description, isDemo: false });
      showToast(editingId ? 'Guruh yangilandi.' : 'Yangi guruh yaratildi.', 'success');
      setModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Xatolik yuz berdi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAssignModal = (gId: string) => {
    setAssignModalGroupId(gId);
    setSelectedStudentIds(students.filter((s) => s.groupId === gId).map((s) => s.id));
  };

  const handleAssignSubmit = async () => {
    if (!assignModalGroupId) return;
    const grp = groups.find((g) => g.id === assignModalGroupId);
    if (!grp) return;
    try {
      await assignStudentsToGroup(grp.id, grp.name, selectedStudentIds);
      showToast(`${selectedStudentIds.length} nafar o‘quvchi «${grp.name}» guruhiga biriktirildi.`, 'success');
      setAssignModalGroupId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Biriktirishda xatolik.', 'error');
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <div className="navy-architect-grid text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Guruhlar reytingi va o‘zlashtirish taqqoslash
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Guruhlarni boshqarish, o‘quvchi biriktirish va o‘rtacha ball bo‘yicha reyting
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_8px_20px_-4px_rgba(37,99,235,0.6)] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Guruh yaratish
        </button>
      </div>

      {/* Group Comparison Bar Chart + Ranking Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 surface-card rounded-2xl p-5">
          <h3 className="font-display font-bold text-sm text-[#09142B] mb-4">
            Guruhlar o‘rtasida taqqoslash
          </h3>
          {groupSummaries.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupSummaries.map((g) => ({
                    name: g.group.name,
                    avg: g.avgPercentage,
                  }))}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip formatter={(v: unknown) => [`${v}%`, 'O‘rtacha ball']} />
                  <Bar dataKey="avg" fill="#2563EB" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-20 text-center">Guruhlar mavjud emas.</p>
          )}
        </div>

        <div className="xl:col-span-3 surface-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD] flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-[#09142B]">Guruhlar reytingi</h3>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          {groupSummaries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">O‘rin</th>
                    <th className="py-2.5 px-4">Guruh</th>
                    <th className="py-2.5 px-4 text-right">O‘quvchilar</th>
                    <th className="py-2.5 px-4 text-right">O‘rtacha ball</th>
                    <th className="py-2.5 px-4 text-right">O‘sish</th>
                    <th className="py-2.5 px-4 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {groupSummaries.map((g, idx) => {
                    const isSelected = activeGroupSummary?.group.id === g.group.id;
                    return (
                      <tr
                        key={g.group.id}
                        onClick={() => setSelectedGroupId(g.group.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono-num font-bold text-slate-700">#{idx + 1}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{g.group.name}</p>
                          <p className="text-xs text-slate-500">{g.group.curatorName || 'Kurator biriktirilmagan'}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num text-slate-700">{g.studentsCount}</td>
                        <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                          {g.avgPercentage}%
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono-num font-semibold ${
                            g.growthDelta > 0
                              ? 'text-emerald-700'
                              : g.growthDelta < 0
                                ? 'text-red-700'
                                : 'text-slate-500'
                          }`}
                        >
                          {g.growthDelta > 0 ? `+${g.growthDelta}%` : `${g.growthDelta}%`}
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openAssignModal(g.group.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                              title="O‘quvchi biriktirish"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(g.group.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                              title="Tahrirlash"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteGroup(g.group.id);
                                showToast(`${g.group.name} o‘chirildi.`, 'info');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              title="O‘chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-16 text-center">Hali guruhlar yaratilmagan.</p>
          )}
        </div>
      </div>

      {/* Selected Group Students Roster */}
      {activeGroupSummary && (
        <div className="surface-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-base text-[#09142B]">
                «{activeGroupSummary.group.name}» guruhi o‘quvchilari ({activeGroupStudents.length})
              </h3>
              <p className="text-xs text-slate-500">
                Guruhning o‘rtacha bali: <span className="font-mono-num font-semibold text-slate-900">{activeGroupSummary.avgPercentage}%</span>
                {activeGroupSummary.group.description && ` · ${activeGroupSummary.group.description}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAssignModal(activeGroupSummary.group.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              O‘quvchi biriktirish
            </button>
          </div>
          {activeGroupStudents.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {activeGroupStudents.map((s) => (
                <button
                  key={s.student.id}
                  type="button"
                  onClick={() => setProfileTarget(s)}
                  className="w-full px-6 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={s.student.photoUrl} name={s.student.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{s.student.fullName}</p>
                      <p className="text-xs text-slate-500 font-mono-num">{s.student.login}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono-num text-sm font-bold text-slate-900">
                      {s.attemptsCount > 0 ? `${s.avgPercentage}%` : '—'}
                    </p>
                    <p className="text-xs text-slate-500">{s.attemptsCount} ta test</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">Bu guruhda hali o‘quvchilar yo‘q.</p>
          )}
        </div>
      )}

      {/* Create/Edit Group Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900">
                {editingId ? 'Guruhni tahrirlash' : 'Yangi guruh yaratish'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Guruh nomi *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: 10-A Aniq fanlar"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Guruh rahbari / Kurator</label>
                <input
                  type="text"
                  value={curatorName}
                  onChange={(e) => setCuratorName(e.target.value)}
                  placeholder="F.I.Sh."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tavsif</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Yo‘nalish yoki izoh"
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

      {/* Assign Students Modal */}
      {assignModalGroupId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900">
                Guruhga o‘quvchilar biriktirish
              </h3>
              <button type="button" onClick={() => setAssignModalGroupId(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
              {students.map((st) => {
                const checked = selectedStudentIds.includes(st.id);
                return (
                  <label
                    key={st.id}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudentSelection(st.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                      />
                      <Avatar src={st.photoUrl} name={st.fullName} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{st.fullName}</p>
                        <p className="text-xs text-slate-500">Hozirgi guruh: {st.groupName}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
              {students.length === 0 && (
                <p className="text-sm text-slate-500 py-8 text-center">O‘quvchilar mavjud emas.</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignModalGroupId(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleAssignSubmit}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 cursor-pointer"
              >
                Biriktirishni saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentProfileModal summary={profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
