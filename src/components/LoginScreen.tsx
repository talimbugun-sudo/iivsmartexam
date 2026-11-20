import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  BarChart3,
  Clock,
  BrainCircuit,
  LogIn,
  FileText,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export function LoginScreen() {
  const {
    firebaseUser,
    signInWithGoogle,
    signOutGoogle,
    enterAdminWithPin,
    enterStudentExam,
    authError,
  } = useAuth();
  const { subjects, tests, groups, students, loading: dataLoading } = useData();

  const [entryMode, setEntryMode] = useState<'student' | 'admin'>('student');
  const [fullName, setFullName] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeTests = useMemo(
    () => tests.filter((t) => t.status === 'active'),
    [tests],
  );

  // Build subject options showing how many active tests belong to each subject
  const subjectEntries = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; activeTests: typeof activeTests }
    >();

    for (const s of subjects) {
      map.set(s.id, { id: s.id, name: s.name, activeTests: [] });
    }
    for (const t of activeTests) {
      const existing = map.get(t.subjectId);
      if (existing) {
        existing.activeTests.push(t);
      } else {
        map.set(t.subjectId, {
          id: t.subjectId,
          name: t.subjectName || 'Fan',
          activeTests: [t],
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.activeTests.length - a.activeTests.length || a.name.localeCompare(b.name),
    );
  }, [subjects, activeTests]);

  // Auto-select first subject with active tests when data loads
  useEffect(() => {
    if (subjectEntries.length === 0) {
      setSelectedSubjectId('');
      return;
    }
    const stillValid = subjectEntries.some((s) => s.id === selectedSubjectId);
    if (!stillValid) {
      const firstReady =
        subjectEntries.find((s) => s.activeTests.length > 0) || subjectEntries[0];
      setSelectedSubjectId(firstReady.id);
    }
  }, [subjectEntries, selectedSubjectId]);

  const currentSubjectTests = useMemo(() => {
    const entry = subjectEntries.find((s) => s.id === selectedSubjectId);
    return entry ? entry.activeTests : [];
  }, [subjectEntries, selectedSubjectId]);

  useEffect(() => {
    if (currentSubjectTests.length === 0) {
      setSelectedTestId('');
      return;
    }
    if (!currentSubjectTests.some((t) => t.id === selectedTestId)) {
      setSelectedTestId(currentSubjectTests[0].id);
    }
  }, [currentSubjectTests, selectedTestId]);

  const selectedTest = useMemo(
    () => currentSubjectTests.find((t) => t.id === selectedTestId) || currentSubjectTests[0] || null,
    [currentSubjectTests, selectedTestId],
  );

  const handleConnectGoogle = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // error is displayed via authError
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!firebaseUser) {
      await handleConnectGoogle();
      return;
    }

    if (fullName.trim().length < 2) {
      setLocalError('Iltimos, ism va familiyangizni to‘liq kiriting.');
      return;
    }

    if (!selectedSubjectId) {
      setLocalError('Iltimos, imtihon topshiradigan faningizni tanlang.');
      return;
    }

    if (!selectedTest) {
      setLocalError(
        'Tanlangan fan bo‘yicha hozircha faol test mavjud emas. Administrator testni faollashtirishi kerak.',
      );
      return;
    }

    setSubmitting(true);
    const res = await enterStudentExam({
      fullName,
      test: selectedTest,
      groups,
      students,
    });
    setSubmitting(false);

    if (!res.ok && res.error) {
      setLocalError(res.error);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    const res = await enterAdminWithPin(adminPin);
    setSubmitting(false);
    if (!res.ok && res.error) {
      setLocalError(res.error);
    }
  };

  return (
    <div className="min-h-screen navy-architect-grid text-white flex flex-col lg:flex-row">
      {/* Left Institutional Brand & Capabilities Panel */}
      <div className="lg:w-7/12 p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_10px_28px_rgba(37,99,235,0.5)] flex items-center justify-center font-display font-bold text-lg tracking-tight">
              ON
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight block whitespace-nowrap">
                ORALIQ NAZORAT
              </span>
              <span className="text-xs text-blue-300/80 block">
                Akademik baholash va tahlil platformasi
              </span>
            </div>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12] text-white max-w-2xl [text-wrap:balance] mb-5">
            Ta’lim sifatini real vaqt va aniq tahlil bilan boshqaring
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mb-10">
            O‘quvchilar ism familiyasi va fanini tanlab darhol imtihonni boshlaydi, administratorlar esa maxfiy parol orqali barcha boshqaruv oynalariga kiradi.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-xs border border-white/10 hover:border-blue-500/40 transition-colors">
              <Clock className="w-5 h-5 text-blue-400 mb-3" />
              <h3 className="font-display font-semibold text-base text-white mb-1">Jonli test monitoringi</h3>
              <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed">
                Kirganlar, ishlayotganlar va qolgan vaqtni soniyalar kesimida kuzating.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-xs border border-white/10 hover:border-blue-500/40 transition-colors">
              <FileText className="w-5 h-5 text-blue-400 mb-3" />
              <h3 className="font-display font-semibold text-base text-white mb-1">Word & Excel import</h3>
              <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed">
                Tayyor .docx yoki .xlsx test savollarini bir bosishda tizimga yuklang.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-xs border border-white/10 hover:border-blue-500/40 transition-colors">
              <BrainCircuit className="w-5 h-5 text-blue-400 mb-3" />
              <h3 className="font-display font-semibold text-base text-white mb-1">Xato va javob tahlili</h3>
              <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed">
                Test tugashi bilan to‘plangan ball, xato savollar va to‘g‘ri javoblar chiqadi.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-xs border border-white/10 hover:border-blue-500/40 transition-colors">
              <BarChart3 className="w-5 h-5 text-blue-400 mb-3" />
              <h3 className="font-display font-semibold text-base text-white mb-1">O‘sish va pasayish</h3>
              <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed">
                Har bir o‘quvchi va guruhning dinamikasini aniq foizlarda solishtiring.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Maxfiy parol bilan himoyalangan boshqaruv
          </span>
          <span>·</span>
          <span>Tezkor o‘quvchi imtihon rejimi</span>
        </div>
      </div>

      {/* Right Floating White Entry Card */}
      <div className="lg:w-5/12 flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md bg-white text-[#09142B] rounded-3xl p-8 sm:p-10 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.55)] border border-white/80">
          <p className="text-xs font-semibold text-blue-600 mb-1.5">Tizimga kirish</p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#09142B] mb-6">
            {entryMode === 'student' ? 'Imtihonni boshlash' : 'Administrator kirishi'}
          </h2>

          {/* Segmented Mode Switch: Student vs Admin Secret Password */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#EEF3F9] rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setEntryMode('student');
                setLocalError(null);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                entryMode === 'student'
                  ? 'bg-[#061024] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              O‘quvchi kirishi
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('admin');
                setLocalError(null);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                entryMode === 'admin'
                  ? 'bg-[#061024] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Maxfiy parol
            </button>
          </div>

          {(localError || authError) && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700">
              {localError || authError}
            </div>
          )}

          {entryMode === 'student' ? (
            <form onSubmit={handleStudentStartExam} className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Ism familiyangizni kiriting va topshiradigan faningizni tanlang — imtihon darhol boshlanadi.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ism va familiya (F.I.Sh.) *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masalan: Aziza Rustamova"
                  className="w-full px-4 py-3 text-sm border border-[#DCE5F2] rounded-xl bg-[#F8FAFD] focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>

              {!firebaseUser ? (
                <div className="p-4 rounded-2xl bg-[#F8FAFD] border border-[#DCE5F2] space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Fanlar va faol testlar ro‘yxatini yuklash uchun avval qurilmani tizimga bir marta ulang.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectGoogle}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm hover:bg-blue-500 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    {submitting ? 'Ulanmoqda...' : 'Fanlarni yuklash (Google orqali ulanish)'}
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Fanni tanlang *
                    </label>
                    {dataLoading ? (
                      <div className="px-4 py-3 text-xs text-slate-500 rounded-xl border border-[#DCE5F2] bg-[#F8FAFD]">
                        Fanlar yuklanmoqda...
                      </div>
                    ) : subjectEntries.length > 0 ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-3 text-sm font-medium border border-[#DCE5F2] rounded-xl bg-[#F8FAFD] focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                          >
                            {subjectEntries.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}{' '}
                                {s.activeTests.length > 0
                                  ? `(${s.activeTests.length} ta faol test)`
                                  : '(Faol test yo‘q)'}
                              </option>
                            ))}
                          </select>
                        </div>

                        {currentSubjectTests.length > 1 && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Testni tanlang
                            </label>
                            <select
                              value={selectedTestId}
                              onChange={(e) => setSelectedTestId(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm border border-[#DCE5F2] rounded-xl bg-[#F8FAFD] focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                            >
                              {currentSubjectTests.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title} ({t.questionCount} savol · {t.durationMinutes} daq)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {selectedTest ? (
                          <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex items-center justify-between gap-2">
                            <span className="font-semibold truncate">{selectedTest.title}</span>
                            <span className="font-mono-num shrink-0 text-blue-700 font-semibold">
                              {selectedTest.questionCount} savol · {selectedTest.durationMinutes} daq
                            </span>
                          </div>
                        ) : (
                          <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                            Bu fan bo‘yicha hozircha faol test mavjud emas.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-xs text-amber-800 rounded-xl border border-amber-200 bg-amber-50">
                        Hozircha tizimda fanlar va faol testlar yaratilmagan. Administrator avval fan va test qo‘shishi kerak.
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedTest}
                    className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 shadow-[0_10px_24px_-6px_rgba(37,99,235,0.5)] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    {submitting ? 'Imtihon ochilmoqda...' : 'Imtihonni boshlash'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Barcha boshqaruv oynalarini ochish uchun administrator maxfiy parolini kiriting.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Maxfiy parol *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Maxfiy parolni kiriting"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 text-sm font-mono-num tracking-wider border border-[#DCE5F2] rounded-xl bg-[#F8FAFD] focus:bg-white focus:outline-none focus:border-blue-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#061024] text-white font-semibold text-sm hover:bg-[#0D1E40] shadow-[0_10px_24px_-6px_rgba(6,16,36,0.45)] transition-all disabled:opacity-60 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                {submitting ? 'Tekshirilmoqda...' : 'Barcha oynalarni ochish'}
              </button>
            </form>
          )}

          {firebaseUser && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="truncate max-w-[190px]" title={firebaseUser.email || ''}>
                Ulangan hisob: <strong className="text-slate-700">{firebaseUser.email}</strong>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Almashtirish
                </button>
                <button
                  type="button"
                  onClick={signOutGoogle}
                  className="text-slate-500 hover:text-red-600 font-semibold cursor-pointer"
                >
                  Chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
