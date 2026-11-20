import React, { useState } from 'react';
import { Shield, UserPlus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { UserRole } from '../types';
import { Avatar } from './Avatar';
import { useToast } from './ToastProvider';

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'O‘qituvchi',
  student: 'O‘quvchi',
};

export function RolesView() {
  const { profile } = useAuth();
  const { allUsers, roleInvites, updateUserRole, createRoleInvite, deleteRoleInvite } = useData();
  const { showToast } = useToast();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('teacher');
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setSaving(true);
    try {
      await createRoleInvite(inviteEmail, inviteName, inviteRole);
      showToast(`${inviteEmail} uchun «${ROLE_LABELS[inviteRole]}» ruxsati saqlandi.`, 'success');
      setInviteEmail('');
      setInviteName('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Xatolik yuz berdi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="navy-architect-grid text-white rounded-2xl p-6 shadow-[0_16px_38px_-14px_rgba(6,16,36,0.45)] border border-white/10">
        <h2 className="font-display text-xl font-bold text-white">
          Foydalanuvchi rollari va kirish ruxsatlari
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-1">
          Super Admin, Admin, O‘qituvchi va O‘quvchi rollari Firestore Security Rules orqali himoyalangan
        </p>
      </div>

      {/* Role Permissions Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#09142B] font-display font-bold text-sm mb-2">
            <Shield className="w-4 h-4 text-blue-600" />
            Super Admin
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            To‘liq nazorat, barcha rollarni tayinlash, demo/real ma’lumotlarni boshqarish va tizim sozlamalari.
          </p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#09142B] font-display font-bold text-sm mb-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            Admin
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            O‘quvchilar, guruhlar, fanlar CRUD, testlar, jonli monitoring, hisobotlar va AI tahlilchi.
          </p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#09142B] font-display font-bold text-sm mb-2">
            <Shield className="w-4 h-4 text-amber-600" />
            O‘qituvchi
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Fanlar va testlar yaratish, jonli monitoring, analitika, hisobotlar va AI pedagogik tavsiyalar.
          </p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#09142B] font-display font-bold text-sm mb-2">
            <Shield className="w-4 h-4 text-slate-500" />
            O‘quvchi
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Faqat o‘ziga tayinlangan testlarni topshirish, shaxsiy natijalar va o‘sish tarixini ko‘rish.
          </p>
        </div>
      </div>

      {/* Pre-assign Role by Email */}
      <div className="surface-card rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm text-[#09142B] mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-blue-600" />
          Yangi xodimga Google email orqali rol biriktirish
        </h3>
        <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="F.I.Sh."
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Google email manzili"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as UserRole)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="teacher">O‘qituvchi</option>
            {isSuperAdmin && <option value="admin">Admin</option>}
            {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            <option value="student">O‘quvchi</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
          >
            {saving ? 'Saqlanmoqda...' : 'Rol biriktirish'}
          </button>
        </form>

        {roleInvites.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 divide-y divide-slate-100">
            {roleInvites.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{inv.displayName}</span>
                  <span className="text-xs text-slate-500 ml-2">{inv.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-blue-700">{ROLE_LABELS[inv.role]}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteRoleInvite(inv.id);
                      showToast('Taklif o‘chirildi.', 'info');
                    }}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Users Table */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE5F2] bg-[#F8FAFD]">
          <h3 className="font-display font-bold text-sm text-[#09142B]">
            Tizim foydalanuvchilari ({allUsers.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Foydalanuvchi</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Joriy rol</th>
                <th className="py-3 px-4 text-right">Rolni o‘zgartirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {allUsers.map((u) => {
                const isSelf = u.uid === profile?.uid;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.photoUrl} name={u.displayName} size="sm" />
                        <span className="font-semibold text-slate-900">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{ROLE_LABELS[u.role]}</td>
                    <td className="py-3 px-4 text-right">
                      <select
                        value={u.role}
                        disabled={isSelf || (!isSuperAdmin && u.role === 'super_admin')}
                        onChange={async (e) => {
                          const newRole = e.target.value as UserRole;
                          await updateUserRole(u.uid, newRole);
                          showToast(`${u.displayName} roli yangilandi: ${ROLE_LABELS[newRole]}`, 'success');
                        }}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white disabled:opacity-50"
                      >
                        {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                        <option value="admin">Admin</option>
                        <option value="teacher">O‘qituvchi</option>
                        <option value="student">O‘quvchi</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
