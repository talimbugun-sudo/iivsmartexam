export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student';

export type ExamType = 'oraliq' | 'joriy' | 'yakuniy';
export type TestStatus = 'draft' | 'active' | 'archived';
export type LiveSessionStatus = 'not_started' | 'entered' | 'working' | 'finished';
export type DataFilterMode = 'all' | 'real' | 'demo';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: UserRole;
  studentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RoleInvite {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedBy: string;
  createdAt?: Date;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  curatorName?: string;
  isDemo: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  description?: string;
  teacherName?: string;
  isDemo: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Student {
  id: string;
  fullName: string;
  groupId: string;
  groupName: string;
  login: string;
  photoUrl?: string;
  isDemo: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StudentCredential {
  studentId: string;
  login: string;
  password: string;
  phone?: string;
  updatedAt?: Date;
}

export interface TestExam {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  groupIds: string[];
  examType: ExamType;
  durationMinutes: number;
  questionCount: number;
  totalPoints: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  status: TestStatus;
  isDemo: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Question {
  id: string;
  testId: string;
  order: number;
  text: string;
  imageUrl?: string;
  options: string[];
  correctIndex: number;
  points: number;
  createdAt?: Date;
}

export interface GradedAnswer {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
}

export interface Attempt {
  id: string;
  testId: string;
  testTitle: string;
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  examType: ExamType;
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string;
  studentUid: string;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  attemptNumber: number;
  durationSpentSeconds: number;
  answers: GradedAnswer[];
  status: 'completed';
  isDemo: boolean;
  submittedAt: Date;
}

export interface LiveSession {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string;
  groupId: string;
  groupName: string;
  studentUid: string;
  status: LiveSessionStatus;
  answeredCount: number;
  totalQuestions: number;
  remainingSeconds: number;
  draftAnswers: Record<string, number>;
  score?: number;
  percentage?: number;
  isDemo: boolean;
  startedAt?: Date;
  updatedAt: Date;
}

export interface AiReport {
  id: string;
  scope: 'overall' | 'group' | 'student' | 'subject';
  targetId?: string;
  targetName: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generatedBy: string;
  isDemo: boolean;
  createdAt: Date;
}

export type NavTab =
  | 'dashboard'
  | 'students'
  | 'groups'
  | 'subjects'
  | 'tests'
  | 'monitoring'
  | 'analytics'
  | 'ai_analyst'
  | 'reports'
  | 'roles';
