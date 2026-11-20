import { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  BookOpen,
  ClipboardList,
  Radio,
  BarChart3,
  BrainCircuit,
  FileSpreadsheet,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { LoginScreen } from './components/LoginScreen';
import { Avatar } from './components/Avatar';
import { DashboardView } from './components/DashboardView';
import { StudentsView } from './components/StudentsView';
import { GroupsView } from './components/GroupsView';
import { SubjectsView } from './components/SubjectsView';
import { TestsView } from './components/TestsView';
import { MonitoringView } from './components/MonitoringView';
import { AnalyticsView } from './components/AnalyticsView';
import { AiAnalystView } from './components/AiAnalystView';
import { ReportsView } from './components/ReportsView';
import { RolesView } from './components/RolesView';
import { StudentPortalView } from './components/StudentPortalView';
import type { DataFilterMode, NavTab, UserRole } from './types';

interface NavItem {
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Bosh sahifa', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'students', label: 'O‘quvchilar', icon: Users, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'groups', label: 'Guruhlar', icon: Layers, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'subjects', label: 'Fanlar', icon: BookOpen, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'tests', label: 'Testlar', icon: ClipboardList, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'monitoring', label: 'Jonli monitoring', icon: Radio, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'analytics', label: 'Analitika', icon: BarChart3, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'ai_analyst', label: 'AI Tahlilchi', icon: BrainCircuit, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'reports', label: 'Hisobotlar', icon: FileSpreadsheet, roles: ['super_admin', 'admin', 'teacher'] },
  { id: 'roles', label: 'Rollar', icon: Shield, roles: ['super_admin', 'admin'] },
];

const ROLE_TITLES: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'O‘qituvchi',
  student: 'O‘quvchi',
};

function WorkspaceShell() {
  const {
    firebaseUser,
    profile,
    sessionMode,
    effectiveRole,
    previewRole,
    setPreviewRole,
    authReady,
    signInWithGoogle,
    logout,
  } = useAuth();
  const { dataFilterMode, setDataFilterMode, hasDemoData } = useData();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(effectiveRole)),
    [effectiveRole],
  );

  const resolvedTab: NavTab = useMemo(() => {
    if (effectiveRole === 'student') return 'dashboard';
    if (visibleNav.some((n) => n.id === activeTab)) return activeTab;
    return visibleNav[0]?.id || 'dashboard';
  }, [effectiveRole, visibleNav, activeTab]);

  if (!authReady) {
    return (
      <div className="min-h-screen navy-architect-grid flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 shadow-[0_12px_30px_rgba(37,99,235,0.5)] mx-auto flex items-center justify-center font-display font-bold text-lg">
            ON
          </div>
          <p className="text-sm font-medium text-slate-300">Platforma yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !profile || !sessionMode) {
    return <LoginScreen />;
  }

  const activeNavMeta = visibleNav.find((n) => n.id === resolvedTab);

  return (
    <div className="min-h-screen bg-[#EEF3F9] flex">
      {/* Desktop Floating Midnight Navy Sidebar */}
      <aside className="hidden lg:flex lg:w-[268px] lg:flex-col lg:fixed lg:inset-y-3 lg:left-3 navy-architect-grid text-white rounded-2xl border border-white/10 shadow-[0_24px_48px_-12px_rgba(6,16,36,0.48)] overflow-hidden z-40">
        <div className="h-[68px] px-5 flex items-center gap-3 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_6px_18px_rgba(37,99,235,0.5)] flex items-center justify-center font-display font-bold text-sm tracking-tight">
            ON
          </div>
          <div className="min-w-0">
            <span className="font-display font-bold text-sm tracking-tight block text-white whitespace-nowrap">
              ORALIQ NAZORAT
            </span>
            <span className="text-[10px] text-blue-300/80 block truncate">
              AI Ta’lim Nazorat Tizimi
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {effectiveRole === 'student' ? (
            <button
              type="button"
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-[0_8px_20px_-4px_rgba(37,99,235,0.6)] whitespace-nowrap"
            >
              <span className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4 shrink-0" />
                O‘quvchi kabineti
              </span>
              <ChevronRight className="w-4 h-4 opacity-80" />
            </button>
          ) : (
            visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = resolvedTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-[0_8px_20px_-4px_rgba(37,99,235,0.65)]'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-blue-300/75'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />}
                </button>
              );
            })
          )}
        </nav>

        {/* Bottom User Profile & Sign Out */}
        <div className="p-4 border-t border-white/10 bg-black/20 space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={profile.photoUrl} name={profile.displayName} size="sm" className="border-white/20" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{profile.displayName}</p>
              <p className="text-[11px] text-blue-300/80 truncate">{ROLE_TITLES[effectiveRole]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Chiqish
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 max-w-[82vw] navy-architect-grid text-white flex flex-col z-10 shadow-2xl">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-display font-bold text-xs">
                  ON
                </div>
                <span className="font-display font-bold text-sm">ORALIQ NAZORAT</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = resolvedTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-xs font-medium text-white cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Chiqish
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-[284px] flex flex-col min-w-0">
        {/* Elevated Glass Top Navigation Header */}
        <header className="mx-4 sm:mx-6 mt-3 rounded-2xl bg-white/90 backdrop-blur-md border border-[#DCE5F2] shadow-[0_6px_24px_-8px_rgba(9,20,43,0.08)] px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sticky top-3 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#DCE5F2] text-slate-700 hover:bg-slate-50 cursor-pointer"
              aria-label="Menyu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-blue-600/80 truncate">
                ORALIQ NAZORAT · {effectiveRole === 'student' ? 'O‘quvchi kabineti' : activeNavMeta?.label}
              </p>
              <h1 className="font-display font-bold text-base sm:text-lg text-[#09142B] truncate">
                {effectiveRole === 'student' ? 'O‘quvchi test kabineti' : activeNavMeta?.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Demo vs Real Data Separation Switch */}
            {effectiveRole !== 'student' && hasDemoData && (
              <div className="hidden sm:flex items-center gap-1 p-1 bg-[#EEF3F9] border border-[#DCE5F2] rounded-xl">
                {(['all', 'real', 'demo'] as DataFilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDataFilterMode(mode)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      dataFilterMode === mode
                        ? 'bg-[#061024] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'all' ? 'Barchasi' : mode === 'real' ? 'Real' : 'Demo'}
                  </button>
                ))}
              </div>
            )}

            {/* Super Admin Role Preview Selector */}
            {profile.role === 'super_admin' && (
              <select
                value={previewRole || 'super_admin'}
                onChange={(e) => {
                  const val = e.target.value as UserRole;
                  setPreviewRole(val === 'super_admin' ? null : val);
                }}
                aria-label="Rol ko‘rinishini tanlash"
                className="px-3 py-1.5 text-xs font-semibold border border-[#DCE5F2] rounded-xl bg-white text-[#09142B] hover:border-blue-400 focus:outline-none cursor-pointer"
              >
                <option value="super_admin">Rol: Super Admin</option>
                <option value="admin">Ko‘rinish: Admin</option>
                <option value="teacher">Ko‘rinish: O‘qituvchi</option>
                <option value="student">Ko‘rinish: O‘quvchi</option>
              </select>
            )}
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {sessionMode === 'admin' && profile.role !== 'super_admin' && profile.role !== 'admin' && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-amber-900">
              <span>
                Barcha oynalar maxfiy parol orqali ochildi, biroq hozirgi ulangan Google hisobingiz (<strong>{profile.email}</strong>) bazada o‘quvchi sifatida belgilangan. Ma’lumotlarni saqlash/tahrirlash uchun administrator Google hisobini ulang.
              </span>
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="px-3.5 py-2 rounded-xl bg-amber-900 text-white text-xs font-semibold hover:bg-amber-800 cursor-pointer shrink-0"
              >
                Administrator hisobini ulash
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${effectiveRole}_${resolvedTab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {effectiveRole === 'student' ? (
                <StudentPortalView />
              ) : (
                <>
                  {resolvedTab === 'dashboard' && (
                    <DashboardView onNavigateTests={() => setActiveTab('tests')} />
                  )}
                  {resolvedTab === 'students' && <StudentsView />}
                  {resolvedTab === 'groups' && <GroupsView />}
                  {resolvedTab === 'subjects' && <SubjectsView />}
                  {resolvedTab === 'tests' && <TestsView />}
                  {resolvedTab === 'monitoring' && <MonitoringView />}
                  {resolvedTab === 'analytics' && <AnalyticsView />}
                  {resolvedTab === 'ai_analyst' && <AiAnalystView />}
                  {resolvedTab === 'reports' && <ReportsView />}
                  {resolvedTab === 'roles' && <RolesView />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <WorkspaceShell />
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
