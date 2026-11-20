/**
 * Dirty Dozen Adversarial Security Rules Verification Spec
 * Maps each of the 12 adversarial payloads from security_spec.md
 * to expected PERMISSION_DENIED outcomes under firestore.rules.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation on Signup',
    collectionPath: '/users/student_uid_1',
    operation: 'create',
    payload: { uid: 'student_uid_1', email: 's1@example.com', displayName: 'S1', role: 'super_admin' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Role Self-Promotion on Update',
    collectionPath: '/users/student_uid_1',
    operation: 'update',
    payload: { role: 'admin' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoof',
    collectionPath: '/groups/g_spoof',
    operation: 'create',
    payload: { name: '10-A', isDemo: false, createdBy: 'spoof_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Ghost Field Injection',
    collectionPath: '/groups/g_ghost',
    operation: 'create',
    payload: { name: '10-A', isDemo: false, createdBy: 'admin_uid', ghostFlag: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Orphaned Question Creation',
    collectionPath: '/tests/missing_test/questions/q1',
    operation: 'create',
    payload: { testId: 'missing_test', order: 1, text: '2+2?', options: ['1', '2', '3', '4'], correctIndex: 3, points: 5 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning',
    collectionPath: '/groups/invalid$id!chars',
    operation: 'create',
    payload: { name: 'Bad', isDemo: false, createdBy: 'admin_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'PII Credential Scraping',
    collectionPath: '/students/student_2/private/credentials',
    operation: 'get',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Score Tampering After Submission',
    collectionPath: '/attempts/attempt_1',
    operation: 'update',
    payload: { score: 100, percentage: 100 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Finished Session Reset',
    collectionPath: '/live_sessions/test1_student1',
    operation: 'update',
    payload: { status: 'working', remainingSeconds: 900 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Student Attempt Impersonation',
    collectionPath: '/attempts/attempt_impersonate',
    operation: 'create',
    payload: { studentUid: 'other_student_uid', score: 95 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Backdated Timestamp Attack',
    collectionPath: '/groups/g_backdate',
    operation: 'create',
    payload: { name: '11-B', isDemo: false, createdBy: 'admin_uid', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Type Poisoning on Test Creation',
    collectionPath: '/tests/t_poison',
    operation: 'create',
    payload: { title: 'Test', durationMinutes: 'ninety', status: 'active' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
