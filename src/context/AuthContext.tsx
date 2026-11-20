import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  makeSafeId,
  OperationType,
  sanitizeEmailToId,
} from '../lib/firebase';
import type { Group, Student, TestExam, UserProfile, UserRole } from '../types';

const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'talimbugun@gmail.com';
export const PENDING_STUDENT_ENTRY_KEY = 'oraliq_pending_student_entry';
const SESSION_MODE_KEY = 'oraliq_session_mode';
const PENDING_EXAM_TEST_KEY = 'oraliq_pending_exam_test_id';

export type SessionMode = 'admin' | 'student' | null;

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  sessionMode: SessionMode;
  effectiveRole: UserRole;
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  linkedStudentId: string | null;
  setLinkedStudentId: (id: string | null) => Promise<void>;
  pendingExamTestId: string | null;
  clearPendingExamTest: () => void;
  enterAdminWithPin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  enterStudentExam: (input: {
    fullName: string;
    test: TestExam;
    groups: Group[];
    students: Student[];
  }) => Promise<{ ok: boolean; error?: string }>;
  enterStudentByNameAndGroup: (
    fullName: string,
    groupInput: string,
    groups: Group[],
    students: Student[],
  ) => Promise<{ ok: boolean; error?: string }>;
  authReady: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSessionMode(): SessionMode {
  const val = sessionStorage.getItem(SESSION_MODE_KEY);
  if (val === 'admin' || val === 'student') return val;
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionMode, setSessionModeState] = useState<SessionMode>(() => readStoredSessionMode());
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [linkedStudentId, setLinkedStudentIdState] = useState<string | null>(null);
  const [pendingExamTestId, setPendingExamTestIdState] = useState<string | null>(
    () => sessionStorage.getItem(PENDING_EXAM_TEST_KEY),
  );
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const setSessionMode = useCallback((mode: SessionMode) => {
    setSessionModeState(mode);
    if (mode) {
      sessionStorage.setItem(SESSION_MODE_KEY, mode);
    } else {
      sessionStorage.removeItem(SESSION_MODE_KEY);
    }
  }, []);

  const setPendingExamTestId = useCallback((testId: string | null) => {
    setPendingExamTestIdState(testId);
    if (testId) {
      sessionStorage.setItem(PENDING_EXAM_TEST_KEY, testId);
    } else {
      sessionStorage.removeItem(PENDING_EXAM_TEST_KEY);
    }
  }, []);

  const clearPendingExamTest = useCallback(() => {
    setPendingExamTestId(null);
  }, [setPendingExamTestId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);
      if (!user) {
        setProfile(null);
        setSessionMode(null);
        setPreviewRole(null);
        setLinkedStudentIdState(null);
        setPendingExamTestId(null);
        setAuthReady(true);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const emailLower = (user.email || '').trim().toLowerCase();

        if (snap.exists()) {
          const data = snap.data();
          let resolvedRole = data.role as UserRole;
          if (emailLower === BOOTSTRAP_SUPER_ADMIN_EMAIL && resolvedRole !== 'super_admin') {
            resolvedRole = 'super_admin';
            await updateDoc(userRef, {
              role: 'super_admin',
              updatedAt: serverTimestamp(),
            });
          }
          const loadedProfile: UserProfile = {
            id: snap.id,
            uid: data.uid,
            email: data.email,
            displayName: data.displayName,
            photoUrl: data.photoUrl,
            role: resolvedRole,
            studentId: data.studentId,
          };
          setProfile(loadedProfile);
          setLinkedStudentIdState(data.studentId || null);
        } else {
          let initialRole: UserRole = 'student';
          if (emailLower === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
            initialRole = 'super_admin';
          } else if (emailLower) {
            try {
              const inviteSnap = await getDoc(doc(db, 'role_invites', sanitizeEmailToId(emailLower)));
              if (inviteSnap.exists()) {
                const invRole = inviteSnap.data().role as UserRole;
                if (['super_admin', 'admin', 'teacher', 'student'].includes(invRole)) {
                  initialRole = invRole;
                }
              }
            } catch {
              // No invite found
            }
          }

          const newProfile = {
            uid: user.uid,
            email: user.email || `${user.uid}@user.local`,
            displayName: user.displayName || user.email?.split('@')[0] || 'Foydalanuvchi',
            ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
            role: initialRole,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setProfile({
            id: user.uid,
            uid: newProfile.uid,
            email: newProfile.email,
            displayName: newProfile.displayName,
            photoUrl: newProfile.photoUrl,
            role: initialRole,
          });
        }
      } catch (err) {
        console.error('Auth profile sync error:', err);
        setAuthError(err instanceof Error ? err.message : 'Profilni yuklashda xatolik');
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, [setSessionMode, setPendingExamTestId]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google orqali kirishda xatolik yuz berdi.';
      setAuthError(msg);
      throw err;
    }
  }, []);

  // Locks UI back to LoginScreen while preserving the underlying Google Auth connection
  const logout = useCallback(async () => {
    sessionStorage.removeItem(PENDING_STUDENT_ENTRY_KEY);
    setSessionMode(null);
    setPreviewRole(null);
    setLinkedStudentIdState(null);
    setPendingExamTestId(null);
  }, [setSessionMode, setPendingExamTestId]);

  // Explicit full Google account disconnect
  const signOutGoogle = useCallback(async () => {
    await logout();
    await signOut(auth);
  }, [logout]);

  const setLinkedStudentId = useCallback(
    async (studentId: string | null) => {
      setLinkedStudentIdState(studentId);
      const currentUser = auth.currentUser || firebaseUser;
      if (currentUser && profile) {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            studentId: studentId || '',
            updatedAt: serverTimestamp(),
          });
          setProfile((prev) => (prev ? { ...prev, studentId: studentId || undefined } : prev));
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
        }
      }
    },
    [firebaseUser, profile],
  );

  const enterAdminWithPin = useCallback(
    async (pin: string): Promise<{ ok: boolean; error?: string }> => {
      const cleanPin = pin.trim();
      if (!cleanPin) {
        return { ok: false, error: 'Maxfiy parolni kiriting.' };
      }

      try {
        const res = await fetch('/api/auth/verify-admin-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: cleanPin }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Maxfiy parol noto‘g‘ri!' };
        }

        if (!auth.currentUser) {
          await signInWithGoogle();
        }

        setPreviewRole(null);
        setPendingExamTestId(null);
        setSessionMode('admin');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Administrator kirishida xatolik yuz berdi.',
        };
      }
    },
    [signInWithGoogle, setPendingExamTestId, setSessionMode],
  );

  const enterStudentExam = useCallback(
    async ({
      fullName,
      test,
      groups,
      students,
    }: {
      fullName: string;
      test: TestExam;
      groups: Group[];
      students: Student[];
    }): Promise<{ ok: boolean; error?: string }> => {
      const cleanName = fullName.trim().replace(/\s+/g, ' ');
      if (cleanName.length < 2) {
        return { ok: false, error: 'Iltimos, ism va familiyangizni to‘liq kiriting.' };
      }

      let currentUser = auth.currentUser || firebaseUser;
      if (!currentUser) {
        try {
          currentUser = await signInWithGoogle();
        } catch {
          return { ok: false, error: 'Tizimga ulanish bekor qilindi.' };
        }
      }
      if (!currentUser) {
        return { ok: false, error: 'Foydalanuvchi aniqlanmadi.' };
      }

      const lowerName = cleanName.toLowerCase();
      const matchingStudents = students.filter(
        (s) => s.fullName.trim().replace(/\s+/g, ' ').toLowerCase() === lowerName,
      );
      const existingStudent =
        matchingStudents.find((s) => test.groupIds.includes(s.groupId)) || matchingStudents[0];

      if (existingStudent) {
        setLinkedStudentIdState(existingStudent.id);
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            studentId: existingStudent.id,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignore if profile doc hasn't finished creating yet on first sign-in
        }
        setPendingExamTestId(test.id);
        setSessionMode('student');
        return { ok: true };
      }

      const targetGroup =
        groups.find((g) => test.groupIds.includes(g.id)) || groups[0];
      if (!targetGroup) {
        return {
          ok: false,
          error: 'Tizimda birorta ham guruh topilmadi. Administrator avval guruh yaratishi kerak.',
        };
      }

      const newStudentId = makeSafeId('stu');
      const slug =
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 24) || newStudentId;

      try {
        await setDoc(doc(db, 'students', newStudentId), {
          fullName: cleanName,
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          login: `${slug}_${Date.now().toString(36).slice(-4)}`,
          ...(currentUser.photoURL ? { photoUrl: currentUser.photoURL } : {}),
          isDemo: targetGroup.isDemo,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setLinkedStudentIdState(newStudentId);
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            studentId: newStudentId,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignore if profile doc is still syncing
        }
        setPendingExamTestId(test.id);
        setSessionMode('student');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'O‘quvchini ro‘yxatdan o‘tkazishda xatolik.',
        };
      }
    },
    [firebaseUser, setPendingExamTestId, setSessionMode],
  );

  const enterStudentByNameAndGroup = useCallback(
    async (
      fullName: string,
      groupInput: string,
      groups: Group[],
      students: Student[],
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!firebaseUser) {
        return { ok: false, error: 'Avval tizimga kiring.' };
      }

      const cleanName = fullName.trim().replace(/\s+/g, ' ');
      const cleanGroup = groupInput.trim();
      if (cleanName.length < 2 || !cleanGroup) {
        return { ok: false, error: 'Ism familiya va guruh nomini kiriting.' };
      }

      const lowerGroup = cleanGroup.toLowerCase();
      const matchedGroup =
        groups.find((g) => g.id === cleanGroup) ||
        groups.find((g) => g.name.trim().toLowerCase() === lowerGroup) ||
        groups.find((g) => g.name.trim().toLowerCase().startsWith(lowerGroup)) ||
        groups.find((g) => g.name.trim().toLowerCase().includes(lowerGroup));

      if (!matchedGroup) {
        const listText = groups.slice(0, 6).map((g) => g.name).join(', ');
        return {
          ok: false,
          error:
            groups.length > 0
              ? `«${cleanGroup}» guruhi topilmadi. Mavjud guruhlar: ${listText}`
              : 'Hozircha tizimda guruhlar yaratilmagan. Admin guruh qo‘shishi kerak.',
        };
      }

      const lowerName = cleanName.toLowerCase();
      const existingStudent = students.find(
        (s) =>
          s.groupId === matchedGroup.id &&
          s.fullName.trim().replace(/\s+/g, ' ').toLowerCase() === lowerName,
      );

      if (existingStudent) {
        await setLinkedStudentId(existingStudent.id);
        setSessionMode('student');
        return { ok: true };
      }

      const newStudentId = makeSafeId('stu');
      const slug =
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 24) || newStudentId;

      try {
        await setDoc(doc(db, 'students', newStudentId), {
          fullName: cleanName,
          groupId: matchedGroup.id,
          groupName: matchedGroup.name,
          login: `${slug}_${Date.now().toString(36).slice(-4)}`,
          ...(firebaseUser.photoURL ? { photoUrl: firebaseUser.photoURL } : {}),
          isDemo: matchedGroup.isDemo,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setLinkedStudentId(newStudentId);
        setSessionMode('student');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'O‘quvchini ro‘yxatdan o‘tkazishda xatolik.',
        };
      }
    },
    [firebaseUser, setLinkedStudentId, setSessionMode],
  );

  const effectiveRole: UserRole =
    sessionMode === 'student'
      ? 'student'
      : sessionMode === 'admin'
        ? previewRole || 'super_admin'
        : 'student';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        sessionMode,
        effectiveRole,
        previewRole,
        setPreviewRole,
        linkedStudentId,
        setLinkedStudentId,
        pendingExamTestId,
        clearPendingExamTest,
        enterAdminWithPin,
        enterStudentExam,
        enterStudentByNameAndGroup,
        authReady,
        authError,
        signInWithGoogle,
        logout,
        signOutGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
