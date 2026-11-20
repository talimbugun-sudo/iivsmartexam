import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  hashStudentCredential,
  makeSafeId,
  OperationType,
  sanitizeEmailToId,
} from '../lib/firebase';
import { clearDemoDataset, seedDemoDataset } from '../lib/demoSeed';
import { useAuth } from './AuthContext';
import type {
  AiReport,
  Attempt,
  DataFilterMode,
  ExamType,
  Group,
  LiveSession,
  Question,
  RoleInvite,
  Student,
  Subject,
  TestExam,
  TestStatus,
  UserProfile,
  UserRole,
} from '../types';

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return new Date();
}

interface DataContextValue {
  loading: boolean;
  dataFilterMode: DataFilterMode;
  setDataFilterMode: (mode: DataFilterMode) => void;
  groups: Group[];
  subjects: Subject[];
  students: Student[];
  tests: TestExam[];
  attempts: Attempt[];
  liveSessions: LiveSession[];
  aiReports: AiReport[];
  allUsers: UserProfile[];
  roleInvites: RoleInvite[];
  hasDemoData: boolean;
  hasRealData: boolean;
  // CRUD
  saveGroup: (input: { id?: string; name: string; description?: string; curatorName?: string; isDemo?: boolean }) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  assignStudentsToGroup: (groupId: string, groupName: string, studentIds: string[]) => Promise<void>;
  saveSubject: (input: { id?: string; name: string; code?: string; description?: string; teacherName?: string; isDemo?: boolean }) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  saveStudent: (input: {
    id?: string;
    fullName: string;
    groupId: string;
    groupName: string;
    login: string;
    password?: string;
    phone?: string;
    photoUrl?: string;
    isDemo?: boolean;
  }) => Promise<void>;
  importStudentsBatch: (
    rows: Array<{ fullName: string; groupName: string; login: string; password: string; phone?: string }>,
    isDemo?: boolean,
  ) => Promise<number>;
  deleteStudent: (id: string, login?: string) => Promise<void>;
  getStudentPrivateCredentials: (studentId: string) => Promise<{ password: string; phone?: string } | null>;
  saveTestWithQuestions: (input: {
    id?: string;
    title: string;
    subjectId: string;
    subjectName: string;
    groupIds: string[];
    examType: ExamType;
    durationMinutes: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    maxAttempts: number;
    status: TestStatus;
    isDemo?: boolean;
    questions: Array<{
      id?: string;
      text: string;
      imageUrl?: string;
      options: string[];
      correctIndex: number;
      points: number;
    }>;
  }) => Promise<string>;
  deleteTest: (testId: string) => Promise<void>;
  fetchTestQuestions: (testId: string) => Promise<Question[]>;
  saveAiReport: (input: {
    scope: 'overall' | 'group' | 'student' | 'subject';
    targetId?: string;
    targetName: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    isDemo: boolean;
  }) => Promise<void>;
  updateUserRole: (uid: string, role: UserRole) => Promise<void>;
  createRoleInvite: (email: string, displayName: string, role: UserRole) => Promise<void>;
  deleteRoleInvite: (inviteId: string) => Promise<void>;
  runSeedDemo: () => Promise<void>;
  runClearDemo: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { authReady, firebaseUser, profile, effectiveRole } = useAuth();
  const [dataFilterMode, setDataFilterMode] = useState<DataFilterMode>('all');
  const [loading, setLoading] = useState(true);

  const [rawGroups, setRawGroups] = useState<Group[]>([]);
  const [rawSubjects, setRawSubjects] = useState<Subject[]>([]);
  const [rawStudents, setRawStudents] = useState<Student[]>([]);
  const [rawTests, setRawTests] = useState<TestExam[]>([]);
  const [rawAttempts, setRawAttempts] = useState<Attempt[]>([]);
  const [rawLiveSessions, setRawLiveSessions] = useState<LiveSession[]>([]);
  const [rawAiReports, setRawAiReports] = useState<AiReport[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [roleInvites, setRoleInvites] = useState<RoleInvite[]>([]);

  const isStaffUser = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'teacher';
  const isAdminUser = profile?.role === 'super_admin' || profile?.role === 'admin';

  useEffect(() => {
    if (!authReady || !firebaseUser || !profile) {
      setRawGroups([]);
      setRawSubjects([]);
      setRawStudents([]);
      setRawTests([]);
      setRawAttempts([]);
      setRawLiveSessions([]);
      setRawAiReports([]);
      setAllUsers([]);
      setRoleInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'groups'),
        (snap) => {
          setRawGroups(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: data.name,
                description: data.description,
                curatorName: data.curatorName,
                isDemo: Boolean(data.isDemo),
                createdBy: data.createdBy,
                createdAt: toDate(data.createdAt),
                updatedAt: toDate(data.updatedAt),
              };
            }),
          );
          setLoading(false);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'groups'),
      ),
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'subjects'),
        (snap) => {
          setRawSubjects(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: data.name,
                code: data.code,
                description: data.description,
                teacherName: data.teacherName,
                isDemo: Boolean(data.isDemo),
                createdBy: data.createdBy,
                createdAt: toDate(data.createdAt),
                updatedAt: toDate(data.updatedAt),
              };
            }),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'),
      ),
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'students'),
        (snap) => {
          setRawStudents(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                fullName: data.fullName,
                groupId: data.groupId,
                groupName: data.groupName,
                login: data.login,
                photoUrl: data.photoUrl,
                isDemo: Boolean(data.isDemo),
                createdBy: data.createdBy,
                createdAt: toDate(data.createdAt),
                updatedAt: toDate(data.updatedAt),
              };
            }),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students'),
      ),
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'tests'),
        (snap) => {
          setRawTests(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                title: data.title,
                subjectId: data.subjectId,
                subjectName: data.subjectName,
                groupIds: Array.isArray(data.groupIds) ? data.groupIds : [],
                examType: data.examType,
                durationMinutes: Number(data.durationMinutes || 20),
                questionCount: Number(data.questionCount || 0),
                totalPoints: Number(data.totalPoints || 0),
                shuffleQuestions: Boolean(data.shuffleQuestions),
                shuffleOptions: Boolean(data.shuffleOptions),
                maxAttempts: Number(data.maxAttempts || 1),
                status: data.status || 'active',
                isDemo: Boolean(data.isDemo),
                createdBy: data.createdBy,
                createdAt: toDate(data.createdAt),
                updatedAt: toDate(data.updatedAt),
              };
            }),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'tests'),
      ),
    );

    // Attempts query respects Firestore Rules Query Enforcer!
    const attemptsQuery = isStaffUser
      ? query(collection(db, 'attempts'), orderBy('submittedAt', 'desc'))
      : query(collection(db, 'attempts'), where('studentUid', '==', firebaseUser.uid));

    unsubs.push(
      onSnapshot(
        attemptsQuery,
        (snap) => {
          const list = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              testId: data.testId,
              testTitle: data.testTitle,
              subjectId: data.subjectId,
              subjectName: data.subjectName,
              groupId: data.groupId,
              groupName: data.groupName,
              examType: data.examType,
              studentId: data.studentId,
              studentName: data.studentName,
              studentPhotoUrl: data.studentPhotoUrl,
              studentUid: data.studentUid,
              score: Number(data.score || 0),
              maxScore: Number(data.maxScore || 0),
              percentage: Number(data.percentage || 0),
              correctCount: Number(data.correctCount || 0),
              totalQuestions: Number(data.totalQuestions || 0),
              attemptNumber: Number(data.attemptNumber || 1),
              durationSpentSeconds: Number(data.durationSpentSeconds || 0),
              answers: Array.isArray(data.answers) ? data.answers : [],
              status: 'completed' as const,
              isDemo: Boolean(data.isDemo),
              submittedAt: toDate(data.submittedAt),
            };
          });
          list.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
          setRawAttempts(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'attempts'),
      ),
    );

    const liveQuery = isStaffUser
      ? collection(db, 'live_sessions')
      : query(collection(db, 'live_sessions'), where('studentUid', '==', firebaseUser.uid));

    unsubs.push(
      onSnapshot(
        liveQuery,
        (snap) => {
          setRawLiveSessions(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                testId: data.testId,
                studentId: data.studentId,
                studentName: data.studentName,
                studentPhotoUrl: data.studentPhotoUrl,
                groupId: data.groupId,
                groupName: data.groupName,
                studentUid: data.studentUid,
                status: data.status,
                answeredCount: Number(data.answeredCount || 0),
                totalQuestions: Number(data.totalQuestions || 0),
                remainingSeconds: Number(data.remainingSeconds || 0),
                draftAnswers: (data.draftAnswers as Record<string, number>) || {},
                score: data.score !== undefined ? Number(data.score) : undefined,
                percentage: data.percentage !== undefined ? Number(data.percentage) : undefined,
                isDemo: Boolean(data.isDemo),
                startedAt: data.startedAt ? toDate(data.startedAt) : undefined,
                updatedAt: toDate(data.updatedAt),
              };
            }),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'live_sessions'),
      ),
    );

    if (isStaffUser) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'ai_reports'), orderBy('createdAt', 'desc')),
          (snap) => {
            setRawAiReports(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  scope: data.scope,
                  targetId: data.targetId,
                  targetName: data.targetName,
                  summary: data.summary,
                  strengths: Array.isArray(data.strengths) ? data.strengths : [],
                  weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
                  recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
                  generatedBy: data.generatedBy,
                  isDemo: Boolean(data.isDemo),
                  createdAt: toDate(data.createdAt),
                };
              }),
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'ai_reports'),
        ),
      );
    }

    if (isAdminUser) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setAllUsers(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: data.uid,
                  email: data.email,
                  displayName: data.displayName,
                  photoUrl: data.photoUrl,
                  role: data.role,
                  studentId: data.studentId,
                  createdAt: toDate(data.createdAt),
                  updatedAt: toDate(data.updatedAt),
                };
              }),
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
        ),
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'role_invites'),
          (snap) => {
            setRoleInvites(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  email: data.email,
                  displayName: data.displayName,
                  role: data.role,
                  assignedBy: data.assignedBy,
                  createdAt: toDate(data.createdAt),
                };
              }),
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'role_invites'),
        ),
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser, profile, isStaffUser, isAdminUser, effectiveRole]);

  const filterByMode = useCallback(
    <T extends { isDemo: boolean }>(arr: T[]): T[] => {
      if (dataFilterMode === 'real') return arr.filter((x) => !x.isDemo);
      if (dataFilterMode === 'demo') return arr.filter((x) => x.isDemo);
      return arr;
    },
    [dataFilterMode],
  );

  const groups = useMemo(() => filterByMode(rawGroups), [rawGroups, filterByMode]);
  const subjects = useMemo(() => filterByMode(rawSubjects), [rawSubjects, filterByMode]);
  const students = useMemo(() => filterByMode(rawStudents), [rawStudents, filterByMode]);
  const tests = useMemo(() => filterByMode(rawTests), [rawTests, filterByMode]);
  const attempts = useMemo(() => filterByMode(rawAttempts), [rawAttempts, filterByMode]);
  const liveSessions = useMemo(() => filterByMode(rawLiveSessions), [rawLiveSessions, filterByMode]);
  const aiReports = useMemo(() => filterByMode(rawAiReports), [rawAiReports, filterByMode]);

  const hasDemoData = useMemo(
    () => rawGroups.some((g) => g.isDemo) || rawStudents.some((s) => s.isDemo) || rawAttempts.some((a) => a.isDemo),
    [rawGroups, rawStudents, rawAttempts],
  );
  const hasRealData = useMemo(
    () => rawGroups.some((g) => !g.isDemo) || rawStudents.some((s) => !s.isDemo) || rawAttempts.some((a) => !a.isDemo),
    [rawGroups, rawStudents, rawAttempts],
  );

  const saveGroup = useCallback(
    async (input: { id?: string; name: string; description?: string; curatorName?: string; isDemo?: boolean }) => {
      if (!firebaseUser) return;
      const id = input.id || makeSafeId('grp');
      const ref = doc(db, 'groups', id);
      try {
        if (input.id) {
          await updateDoc(ref, {
            name: input.name.trim(),
            description: (input.description || '').trim(),
            curatorName: (input.curatorName || '').trim(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const batch = writeBatch(db);
          batch.set(ref, {
            name: input.name.trim(),
            ...(input.description?.trim() ? { description: input.description.trim() } : {}),
            ...(input.curatorName?.trim() ? { curatorName: input.curatorName.trim() } : {}),
            isDemo: Boolean(input.isDemo),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, input.id ? OperationType.UPDATE : OperationType.CREATE, `groups/${id}`);
      }
    },
    [firebaseUser],
  );

  const deleteGroup = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'groups', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${id}`);
    }
  }, []);

  const assignStudentsToGroup = useCallback(async (groupId: string, groupName: string, studentIds: string[]) => {
    try {
      const batch = writeBatch(db);
      for (const sid of studentIds) {
        batch.update(doc(db, 'students', sid), {
          groupId,
          groupName,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}/assign`);
    }
  }, []);

  const saveSubject = useCallback(
    async (input: { id?: string; name: string; code?: string; description?: string; teacherName?: string; isDemo?: boolean }) => {
      if (!firebaseUser) return;
      const id = input.id || makeSafeId('sub');
      const ref = doc(db, 'subjects', id);
      try {
        if (input.id) {
          await updateDoc(ref, {
            name: input.name.trim(),
            code: (input.code || '').trim(),
            description: (input.description || '').trim(),
            teacherName: (input.teacherName || '').trim(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const batch = writeBatch(db);
          batch.set(ref, {
            name: input.name.trim(),
            ...(input.code?.trim() ? { code: input.code.trim() } : {}),
            ...(input.description?.trim() ? { description: input.description.trim() } : {}),
            ...(input.teacherName?.trim() ? { teacherName: input.teacherName.trim() } : {}),
            isDemo: Boolean(input.isDemo),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, input.id ? OperationType.UPDATE : OperationType.CREATE, `subjects/${id}`);
      }
    },
    [firebaseUser],
  );

  const deleteSubject = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subjects', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subjects/${id}`);
    }
  }, []);

  const saveStudent = useCallback(
    async (input: {
      id?: string;
      fullName: string;
      groupId: string;
      groupName: string;
      login: string;
      password?: string;
      phone?: string;
      photoUrl?: string;
      isDemo?: boolean;
    }) => {
      if (!firebaseUser) return;
      const id = input.id || makeSafeId('stu');
      const cleanLogin = input.login.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const stuRef = doc(db, 'students', id);

      try {
        const batch = writeBatch(db);
        if (input.id) {
          batch.update(stuRef, {
            fullName: input.fullName.trim(),
            groupId: input.groupId,
            groupName: input.groupName,
            login: cleanLogin,
            ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(stuRef, {
            fullName: input.fullName.trim(),
            groupId: input.groupId,
            groupName: input.groupName,
            login: cleanLogin,
            ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
            isDemo: Boolean(input.isDemo),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (input.password && input.password.trim().length >= 3) {
          const pwd = input.password.trim();
          const hash = await hashStudentCredential(cleanLogin, pwd);
          batch.set(doc(db, 'students', id, 'private', 'credentials'), {
            studentId: id,
            login: cleanLogin,
            password: pwd,
            ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
            updatedAt: serverTimestamp(),
          });
          batch.set(doc(db, 'student_auth', cleanLogin), {
            studentId: id,
            groupId: input.groupId,
            passwordHash: hash,
            updatedAt: serverTimestamp(),
          });
        } else if (input.id && input.phone !== undefined) {
          const credSnap = await getDoc(doc(db, 'students', id, 'private', 'credentials'));
          if (credSnap.exists()) {
            batch.update(doc(db, 'students', id, 'private', 'credentials'), {
              phone: input.phone.trim(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, input.id ? OperationType.UPDATE : OperationType.CREATE, `students/${id}`);
      }
    },
    [firebaseUser],
  );

  const importStudentsBatch = useCallback(
    async (
      rows: Array<{ fullName: string; groupName: string; login: string; password: string; phone?: string }>,
      isDemo = false,
    ): Promise<number> => {
      if (!firebaseUser) return 0;
      const groupByName = new Map<string, Group>();
      for (const g of rawGroups) {
        groupByName.set(g.name.trim().toLowerCase(), g);
      }

      const batch = writeBatch(db);
      let count = 0;

      for (const row of rows) {
        const gKey = row.groupName.trim().toLowerCase();
        let targetGroup = groupByName.get(gKey);
        if (!targetGroup) {
          const newGid = makeSafeId('grp');
          targetGroup = {
            id: newGid,
            name: row.groupName.trim(),
            isDemo,
            createdBy: firebaseUser.uid,
          };
          groupByName.set(gKey, targetGroup);
          batch.set(doc(db, 'groups', newGid), {
            name: targetGroup.name,
            isDemo,
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const sid = makeSafeId('stu');
        const cleanLogin = row.login.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const pwd = (row.password || '123456').trim();
        const hash = await hashStudentCredential(cleanLogin, pwd);

        batch.set(doc(db, 'students', sid), {
          fullName: row.fullName.trim(),
          groupId: targetGroup.id,
          groupName: targetGroup.name,
          login: cleanLogin,
          isDemo,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'students', sid, 'private', 'credentials'), {
          studentId: sid,
          login: cleanLogin,
          password: pwd,
          ...(row.phone ? { phone: row.phone } : {}),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'student_auth', cleanLogin), {
          studentId: sid,
          groupId: targetGroup.id,
          passwordHash: hash,
          updatedAt: serverTimestamp(),
        });
        count += 1;
      }

      try {
        await batch.commit();
        return count;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'students/excel_import');
      }
    },
    [firebaseUser, rawGroups],
  );

  const deleteStudent = useCallback(async (id: string, login?: string) => {
    try {
      try {
        await deleteDoc(doc(db, 'students', id, 'private', 'credentials'));
      } catch {
        // ignore if missing
      }
      if (login) {
        try {
          await deleteDoc(doc(db, 'student_auth', login));
        } catch {
          // ignore if missing
        }
      }
      await deleteDoc(doc(db, 'students', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
    }
  }, []);

  const getStudentPrivateCredentials = useCallback(async (studentId: string) => {
    try {
      const snap = await getDoc(doc(db, 'students', studentId, 'private', 'credentials'));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        password: String(d.password || ''),
        phone: d.phone ? String(d.phone) : undefined,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `students/${studentId}/private/credentials`);
    }
  }, []);

  const fetchTestQuestions = useCallback(async (testId: string): Promise<Question[]> => {
    try {
      const qSnap = await getDocs(query(collection(db, 'tests', testId, 'questions'), orderBy('order', 'asc')));
      return qSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          testId: data.testId,
          order: Number(data.order || 0),
          text: data.text,
          imageUrl: data.imageUrl,
          options: Array.isArray(data.options) ? data.options : [],
          correctIndex: Number(data.correctIndex || 0),
          points: Number(data.points || 5),
          createdAt: toDate(data.createdAt),
        };
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `tests/${testId}/questions`);
    }
  }, []);

  const saveTestWithQuestions = useCallback(
    async (input: {
      id?: string;
      title: string;
      subjectId: string;
      subjectName: string;
      groupIds: string[];
      examType: ExamType;
      durationMinutes: number;
      shuffleQuestions: boolean;
      shuffleOptions: boolean;
      maxAttempts: number;
      status: TestStatus;
      isDemo?: boolean;
      questions: Array<{
        id?: string;
        text: string;
        imageUrl?: string;
        options: string[];
        correctIndex: number;
        points: number;
      }>;
    }): Promise<string> => {
      if (!firebaseUser) return '';
      const testId = input.id || makeSafeId('test');
      const totalPoints = input.questions.reduce((sum, q) => sum + Number(q.points || 0), 0);

      try {
        const batch = writeBatch(db);
        const testRef = doc(db, 'tests', testId);

        if (input.id) {
          batch.update(testRef, {
            title: input.title.trim(),
            subjectId: input.subjectId,
            subjectName: input.subjectName,
            groupIds: input.groupIds,
            examType: input.examType,
            durationMinutes: Number(input.durationMinutes),
            questionCount: input.questions.length,
            totalPoints,
            shuffleQuestions: input.shuffleQuestions,
            shuffleOptions: input.shuffleOptions,
            maxAttempts: Number(input.maxAttempts),
            status: input.status,
            updatedAt: serverTimestamp(),
          });

          const existingQSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
          const incomingIds = new Set(input.questions.map((q) => q.id).filter(Boolean));
          for (const oldDoc of existingQSnap.docs) {
            if (!incomingIds.has(oldDoc.id)) {
              batch.delete(oldDoc.ref);
            }
          }
        } else {
          batch.set(testRef, {
            title: input.title.trim(),
            subjectId: input.subjectId,
            subjectName: input.subjectName,
            groupIds: input.groupIds,
            examType: input.examType,
            durationMinutes: Number(input.durationMinutes),
            questionCount: input.questions.length,
            totalPoints,
            shuffleQuestions: input.shuffleQuestions,
            shuffleOptions: input.shuffleOptions,
            maxAttempts: Number(input.maxAttempts),
            status: input.status,
            isDemo: Boolean(input.isDemo),
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        input.questions.forEach((qItem, idx) => {
          const qId = qItem.id || makeSafeId('q');
          const qRef = doc(db, 'tests', testId, 'questions', qId);
          if (qItem.id) {
            batch.update(qRef, {
              order: idx,
              text: qItem.text.trim(),
              ...(qItem.imageUrl ? { imageUrl: qItem.imageUrl } : {}),
              options: qItem.options.map((o) => o.trim()),
              correctIndex: qItem.correctIndex,
              points: Number(qItem.points),
            });
          } else {
            batch.set(qRef, {
              testId,
              order: idx,
              text: qItem.text.trim(),
              ...(qItem.imageUrl ? { imageUrl: qItem.imageUrl } : {}),
              options: qItem.options.map((o) => o.trim()),
              correctIndex: qItem.correctIndex,
              points: Number(qItem.points),
              createdAt: serverTimestamp(),
            });
          }
        });

        await batch.commit();
        return testId;
      } catch (err) {
        handleFirestoreError(err, input.id ? OperationType.UPDATE : OperationType.CREATE, `tests/${testId}`);
      }
    },
    [firebaseUser],
  );

  const deleteTest = useCallback(async (testId: string) => {
    try {
      const qSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
      for (const qDoc of qSnap.docs) {
        await deleteDoc(qDoc.ref);
      }
      await deleteDoc(doc(db, 'tests', testId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tests/${testId}`);
    }
  }, []);

  const saveAiReport = useCallback(
    async (input: {
      scope: 'overall' | 'group' | 'student' | 'subject';
      targetId?: string;
      targetName: string;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
      isDemo: boolean;
    }) => {
      if (!firebaseUser) return;
      const reportId = makeSafeId('ai');
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'ai_reports', reportId), {
          scope: input.scope,
          ...(input.targetId ? { targetId: input.targetId } : {}),
          targetName: input.targetName,
          summary: input.summary,
          strengths: input.strengths,
          weaknesses: input.weaknesses,
          recommendations: input.recommendations,
          generatedBy: firebaseUser.uid,
          isDemo: input.isDemo,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `ai_reports/${reportId}`);
      }
    },
    [firebaseUser],
  );

  const updateUserRole = useCallback(async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  }, []);

  const createRoleInvite = useCallback(
    async (email: string, displayName: string, role: UserRole) => {
      if (!firebaseUser) return;
      const inviteId = sanitizeEmailToId(email);
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'role_invites', inviteId), {
          email: email.trim().toLowerCase(),
          displayName: displayName.trim(),
          role,
          assignedBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `role_invites/${inviteId}`);
      }
    },
    [firebaseUser],
  );

  const deleteRoleInvite = useCallback(async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'role_invites', inviteId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `role_invites/${inviteId}`);
    }
  }, []);

  const runSeedDemo = useCallback(async () => {
    if (!firebaseUser) return;
    await seedDemoDataset(firebaseUser.uid);
  }, [firebaseUser]);

  const runClearDemo = useCallback(async () => {
    await clearDemoDataset();
  }, []);

  return (
    <DataContext.Provider
      value={{
        loading,
        dataFilterMode,
        setDataFilterMode,
        groups,
        subjects,
        students,
        tests,
        attempts,
        liveSessions,
        aiReports,
        allUsers,
        roleInvites,
        hasDemoData,
        hasRealData,
        saveGroup,
        deleteGroup,
        assignStudentsToGroup,
        saveSubject,
        deleteSubject,
        saveStudent,
        importStudentsBatch,
        deleteStudent,
        getStudentPrivateCredentials,
        saveTestWithQuestions,
        deleteTest,
        fetchTestQuestions,
        saveAiReport,
        updateUserRole,
        createRoleInvite,
        deleteRoleInvite,
        runSeedDemo,
        runClearDemo,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
