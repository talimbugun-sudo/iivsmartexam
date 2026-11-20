# Security Specification — ORALIQ NAZORAT Platform

## 1. Data Invariants
1. **Master Gate & Relational Sync**: Every question in `/tests/{testId}/questions/{questionId}` must belong to an existing parent `/tests/{testId}` document, and `question.testId == testId`.
2. **Identity & Privilege Integrity**: Users cannot self-assign `super_admin`, `admin`, or `teacher` roles in `/users/{userId}` on create or update unless they are the bootstrapped Super Admin (`talimbugun@gmail.com` with `email_verified == true`), an existing `super_admin`/`admin`, or match a verified `/role_invites` grant.
3. **PII & Credential Isolation**: Student passwords and phone numbers are strictly isolated in `/students/{studentId}/private/credentials` and are never readable via general student directory queries.
4. **Temporal & Immutable Field Integrity**: `createdAt`, `createdBy`, `submittedAt`, and `studentUid` must be validated on create (`request.time`) and remain immutable on update.
5. **Terminal State Locking**: Once an exam attempt is submitted (`/attempts/{attemptId}` with `status == 'completed'`) or a `/live_sessions/{sessionId}` reaches `status == 'finished'`, students cannot modify or reset their scores or completion state.
6. **Path Variable Hardening & Volumetric Bounds**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string and list enforces strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Signup**: Student creates `/users/{uid}` with `role: "super_admin"`. -> `PERMISSION_DENIED`.
2. **Role Self-Promotion on Update**: Authenticated student updates `/users/{uid}` changing `role` to `"admin"`. -> `PERMISSION_DENIED`.
3. **Unverified Admin Email Spoof**: User with `email: "talimbugun@gmail.com"` and `email_verified: false` attempts admin write. -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field Injection**: Staff creates `/groups/{groupId}` with extra unexpected key `isVerified: true`. -> `PERMISSION_DENIED`.
5. **Orphaned Question Creation**: Teacher creates `/tests/nonexistent_test/questions/q1` where parent test does not exist. -> `PERMISSION_DENIED`.
6. **ID Poisoning**: User attempts to write `/groups/bad$id*with!chars` or 1500-char ID. -> `PERMISSION_DENIED`.
7. **PII Credential Scraping**: Student reads `/students/s1/private/credentials` belonging to another student. -> `PERMISSION_DENIED`.
8. **Score Tampering (Terminal State)**: Student updates `/attempts/{attemptId}` to change `score` or `percentage` after submission. -> `PERMISSION_DENIED`.
9. **Finished Session Reset**: Student updates `/live_sessions/{sessionId}` from `status: "finished"` back to `status: "working"`. -> `PERMISSION_DENIED`.
10. **Other Student Attempt Impersonation**: Student creates `/attempts/{attemptId}` with `studentUid != request.auth.uid`. -> `PERMISSION_DENIED`.
11. **Backdated Timestamp Attack**: User writes `/groups/{groupId}` with client-forged `createdAt` not equal to `request.time`. -> `PERMISSION_DENIED`.
12. **Blanket Unscoped List / Type Poisoning**: Student sends `durationMinutes: "ninety"` (string instead of int) or queries another user's `/users` PII. -> `PERMISSION_DENIED`.
