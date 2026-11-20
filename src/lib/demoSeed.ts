import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, hashStudentCredential, OperationType, handleFirestoreError } from './firebase';

const DEMO_PREFIX = 'demo_';

export async function seedDemoDataset(creatorUid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = Date.now();
    const daysAgo = (days: number) => Timestamp.fromMillis(now - days * 86400000);

    // 1. Groups
    const groups = [
      { id: `${DEMO_PREFIX}grp_10a`, name: '10-A Aniq fanlar', description: 'Matematika va fizika chuqurlashtirilgan guruh', curatorName: 'Dilshodbek Karimov' },
      { id: `${DEMO_PREFIX}grp_10b`, name: '10-B IT-Akademiya', description: 'Informatika va ingliz tili yo‘nalishi', curatorName: 'Malika Raximova' },
      { id: `${DEMO_PREFIX}grp_11a`, name: '11-A Tabiiy fanlar', description: 'Kimyo va biologiya tayyorlov guruhi', curatorName: 'Otabek Tursunov' },
    ];

    for (const g of groups) {
      batch.set(doc(db, 'groups', g.id), {
        name: g.name,
        description: g.description,
        curatorName: g.curatorName,
        isDemo: true,
        createdBy: creatorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Subjects
    const subjects = [
      { id: `${DEMO_PREFIX}sub_math`, name: 'Matematika', code: 'MAT-101', description: 'Algebra va geometriya asoslari', teacherName: 'Dilshodbek Karimov' },
      { id: `${DEMO_PREFIX}sub_phys`, name: 'Fizika', code: 'FIZ-102', description: 'Mexanika, optika va elektrodinamika', teacherName: 'Sardorbek Alimov' },
      { id: `${DEMO_PREFIX}sub_info`, name: 'Informatika', code: 'INF-103', description: 'Algoritmlar va dasturlash asoslari', teacherName: 'Malika Raximova' },
      { id: `${DEMO_PREFIX}sub_eng`, name: 'Ingliz tili', code: 'ENG-104', description: 'Akademik grammatika va o‘qish', teacherName: 'Nargiza Usmonova' },
    ];

    for (const s of subjects) {
      batch.set(doc(db, 'subjects', s.id), {
        name: s.name,
        code: s.code,
        description: s.description,
        teacherName: s.teacherName,
        isDemo: true,
        createdBy: creatorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Students (with generated high-resolution portraits)
    const students = [
      {
        id: `${DEMO_PREFIX}stu_aziza`,
        fullName: 'Aziza Rustamova',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        login: 'aziza_demo',
        password: 'demo123',
        photoUrl: '/src/assets/images/student_avatar_aziza_1795150798218.jpg',
      },
      {
        id: `${DEMO_PREFIX}stu_jasur`,
        fullName: 'Jasur Abdullayev',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        login: 'jasur_demo',
        password: 'demo123',
        photoUrl: '/src/assets/images/student_avatar_jasur_1795150798621.jpg',
      },
      {
        id: `${DEMO_PREFIX}stu_madina`,
        fullName: 'Madina Qodirova',
        groupId: `${DEMO_PREFIX}grp_10b`,
        groupName: '10-B IT-Akademiya',
        login: 'madina_demo',
        password: 'demo123',
        photoUrl: '/src/assets/images/student_avatar_madina_1795150798420.jpg',
      },
      {
        id: `${DEMO_PREFIX}stu_sardor`,
        fullName: 'Sardorbek Mirzayev',
        groupId: `${DEMO_PREFIX}grp_11a`,
        groupName: '11-A Tabiiy fanlar',
        login: 'sardor_demo',
        password: 'demo123',
        photoUrl: '/src/assets/images/student_avatar_sardor_1795150798682.jpg',
      },
    ];

    for (const st of students) {
      batch.set(doc(db, 'students', st.id), {
        fullName: st.fullName,
        groupId: st.groupId,
        groupName: st.groupName,
        login: st.login,
        photoUrl: st.photoUrl,
        isDemo: true,
        createdBy: creatorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'students', st.id, 'private', 'credentials'), {
        studentId: st.id,
        login: st.login,
        password: st.password,
        phone: '+998 90 555 12 34',
        updatedAt: serverTimestamp(),
      });
      const hash = await hashStudentCredential(st.login, st.password);
      batch.set(doc(db, 'student_auth', st.login), {
        studentId: st.id,
        groupId: st.groupId,
        passwordHash: hash,
        updatedAt: serverTimestamp(),
      });
    }

    // 4. Tests & Questions
    const tests = [
      {
        id: `${DEMO_PREFIX}test_math_1`,
        title: '1-Oraliq nazorat: Kvadrat tenglamalar va funksiyalar',
        subjectId: `${DEMO_PREFIX}sub_math`,
        subjectName: 'Matematika',
        groupIds: [`${DEMO_PREFIX}grp_10a`, `${DEMO_PREFIX}grp_10b`],
        examType: 'oraliq',
        durationMinutes: 25,
        questionCount: 4,
        totalPoints: 20,
        shuffleQuestions: true,
        shuffleOptions: true,
        maxAttempts: 2,
        status: 'active',
        questions: [
          {
            id: `${DEMO_PREFIX}q_m1`,
            order: 0,
            text: 'x² - 5x + 6 = 0 tenglamaning ildizlari yig‘indisini toping.',
            options: ['5', '-5', '6', '1'],
            correctIndex: 0,
            points: 5,
          },
          {
            id: `${DEMO_PREFIX}q_m2`,
            order: 1,
            text: 'y = 2x + 4 chiziqli funksiyaning Ox o‘qi bilan kesishish nuqtasini toping.',
            options: ['(0; 4)', '(-2; 0)', '(2; 0)', '(4; 0)'],
            correctIndex: 1,
            points: 5,
          },
          {
            id: `${DEMO_PREFIX}q_m3`,
            order: 2,
            text: 'log₂(32) ifodaning qiymatini hisoblang.',
            options: ['4', '5', '6', '8'],
            correctIndex: 1,
            points: 5,
          },
          {
            id: `${DEMO_PREFIX}q_m4`,
            order: 3,
            text: 'Uchburchakning ichki burchaklari yig‘indisi nechaga teng?',
            options: ['90°', '180°', '270°', '360°'],
            correctIndex: 1,
            points: 5,
          },
        ],
      },
      {
        id: `${DEMO_PREFIX}test_phys_1`,
        title: '2-Oraliq nazorat: Yorug‘lik sinishi va optika',
        subjectId: `${DEMO_PREFIX}sub_phys`,
        subjectName: 'Fizika',
        groupIds: [`${DEMO_PREFIX}grp_10a`, `${DEMO_PREFIX}grp_11a`],
        examType: 'oraliq',
        durationMinutes: 20,
        questionCount: 3,
        totalPoints: 15,
        shuffleQuestions: false,
        shuffleOptions: true,
        maxAttempts: 2,
        status: 'active',
        questions: [
          {
            id: `${DEMO_PREFIX}q_p1`,
            order: 0,
            text: 'Chizmada ko‘rsatilgan prizma va yig‘uvchi linza orqali o‘tgan parallel nurlar qaysi nuqtada kesishadi?',
            imageUrl: '/src/assets/images/physics_optics_diagram_1795150798646.jpg',
            options: ['Fokus nuqtasida (F)', 'Optik markazda (O)', 'Prizma ichida', 'Kesishmaydi'],
            correctIndex: 0,
            points: 5,
          },
          {
            id: `${DEMO_PREFIX}q_p2`,
            order: 1,
            text: 'Yorug‘likning dispersiyasi deganda nima tushuniladi?',
            options: [
              'Sindirish ko‘rsatkichining to‘lqin uzunligiga bog‘liqligi',
              'Yorug‘likning faqat qaytishi',
              'Vakuumda tezlikning kamayishi',
              'Linza qalinligining ortishi',
            ],
            correctIndex: 0,
            points: 5,
          },
          {
            id: `${DEMO_PREFIX}q_p3`,
            order: 2,
            text: 'Fokus masofasi f = 0.25 m bo‘lgan linzaning optik kuchi (dptr) nechaga teng?',
            options: ['2 dptr', '4 dptr', '0.25 dptr', '8 dptr'],
            correctIndex: 1,
            points: 5,
          },
        ],
      },
      {
        id: `${DEMO_PREFIX}test_info_1`,
        title: 'Joriy nazorat: Algoritmlar murakkabligi',
        subjectId: `${DEMO_PREFIX}sub_info`,
        subjectName: 'Informatika',
        groupIds: [`${DEMO_PREFIX}grp_10b`, `${DEMO_PREFIX}grp_10a`],
        examType: 'joriy',
        durationMinutes: 15,
        questionCount: 3,
        totalPoints: 15,
        shuffleQuestions: true,
        shuffleOptions: true,
        maxAttempts: 3,
        status: 'active',
        questions: [
          {
            id: `${DEMO_PREFIX}q_i1`,
            order: 0,
            text: 'Saralangan massivda ikkilik qidiruv (Binary Search) algoritmining vaqt murakkabligi qanday?',
            options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
            correctIndex: 1,
            points: 5,
          },
          {
            id: `${DEMO_PREFIX}q_i2`,
            order: 1,
            text: 'LIFO (Last In, First Out) tamoyili asosida qaysi ma’lumotlar tuzilmasi ishlaydi?',
            options: ['Queue (Navbat)', 'Stack (Stek)', 'HashMap', 'Binary Tree'],
            correctIndex: 1,
            points: 5,
          },
          {
            id: `${DEMO_PREFIX}q_i3`,
            order: 2,
            text: 'HTTP protokolida muvaffaqiyatli so‘rov kodi qaysi?',
            options: ['200', '404', '500', '301'],
            correctIndex: 0,
            points: 5,
          },
        ],
      },
    ];

    for (const t of tests) {
      batch.set(doc(db, 'tests', t.id), {
        title: t.title,
        subjectId: t.subjectId,
        subjectName: t.subjectName,
        groupIds: t.groupIds,
        examType: t.examType,
        durationMinutes: t.durationMinutes,
        questionCount: t.questionCount,
        totalPoints: t.totalPoints,
        shuffleQuestions: t.shuffleQuestions,
        shuffleOptions: t.shuffleOptions,
        maxAttempts: t.maxAttempts,
        status: t.status,
        isDemo: true,
        createdBy: creatorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (const qItem of t.questions) {
        batch.set(doc(db, 'tests', t.id, 'questions', qItem.id), {
          testId: t.id,
          order: qItem.order,
          text: qItem.text,
          ...(qItem.imageUrl ? { imageUrl: qItem.imageUrl } : {}),
          options: qItem.options,
          correctIndex: qItem.correctIndex,
          points: qItem.points,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 5. Realistic Historical Attempts (Showing growth for Aziza/Madina and decline for Jasur/Sardor)
    const demoAttempts = [
      // Aziza: strong upward growth 68% -> 80% -> 95%
      {
        id: `${DEMO_PREFIX}att_1`,
        testId: `${DEMO_PREFIX}test_math_1`,
        testTitle: '1-Oraliq nazorat: Kvadrat tenglamalar va funksiyalar',
        subjectId: `${DEMO_PREFIX}sub_math`,
        subjectName: 'Matematika',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        examType: 'oraliq',
        studentId: `${DEMO_PREFIX}stu_aziza`,
        studentName: 'Aziza Rustamova',
        studentPhotoUrl: '/src/assets/images/student_avatar_aziza_1795150798218.jpg',
        score: 14,
        maxScore: 20,
        percentage: 70,
        correctCount: 3,
        totalQuestions: 4,
        daysAgo: 21,
      },
      {
        id: `${DEMO_PREFIX}att_2`,
        testId: `${DEMO_PREFIX}test_phys_1`,
        testTitle: '2-Oraliq nazorat: Yorug‘lik sinishi va optika',
        subjectId: `${DEMO_PREFIX}sub_phys`,
        subjectName: 'Fizika',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        examType: 'oraliq',
        studentId: `${DEMO_PREFIX}stu_aziza`,
        studentName: 'Aziza Rustamova',
        studentPhotoUrl: '/src/assets/images/student_avatar_aziza_1795150798218.jpg',
        score: 13,
        maxScore: 15,
        percentage: 87,
        correctCount: 3,
        totalQuestions: 3,
        daysAgo: 10,
      },
      {
        id: `${DEMO_PREFIX}att_3`,
        testId: `${DEMO_PREFIX}test_info_1`,
        testTitle: 'Joriy nazorat: Algoritmlar murakkabligi',
        subjectId: `${DEMO_PREFIX}sub_info`,
        subjectName: 'Informatika',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        examType: 'joriy',
        studentId: `${DEMO_PREFIX}stu_aziza`,
        studentName: 'Aziza Rustamova',
        studentPhotoUrl: '/src/assets/images/student_avatar_aziza_1795150798218.jpg',
        score: 15,
        maxScore: 15,
        percentage: 100,
        correctCount: 3,
        totalQuestions: 3,
        daysAgo: 2,
      },
      // Jasur: declining trend 85% -> 60% -> 47%
      {
        id: `${DEMO_PREFIX}att_4`,
        testId: `${DEMO_PREFIX}test_math_1`,
        testTitle: '1-Oraliq nazorat: Kvadrat tenglamalar va funksiyalar',
        subjectId: `${DEMO_PREFIX}sub_math`,
        subjectName: 'Matematika',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        examType: 'oraliq',
        studentId: `${DEMO_PREFIX}stu_jasur`,
        studentName: 'Jasur Abdullayev',
        studentPhotoUrl: '/src/assets/images/student_avatar_jasur_1795150798621.jpg',
        score: 17,
        maxScore: 20,
        percentage: 85,
        correctCount: 3,
        totalQuestions: 4,
        daysAgo: 20,
      },
      {
        id: `${DEMO_PREFIX}att_5`,
        testId: `${DEMO_PREFIX}test_phys_1`,
        testTitle: '2-Oraliq nazorat: Yorug‘lik sinishi va optika',
        subjectId: `${DEMO_PREFIX}sub_phys`,
        subjectName: 'Fizika',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        examType: 'oraliq',
        studentId: `${DEMO_PREFIX}stu_jasur`,
        studentName: 'Jasur Abdullayev',
        studentPhotoUrl: '/src/assets/images/student_avatar_jasur_1795150798621.jpg',
        score: 9,
        maxScore: 15,
        percentage: 60,
        correctCount: 2,
        totalQuestions: 3,
        daysAgo: 9,
      },
      {
        id: `${DEMO_PREFIX}att_6`,
        testId: `${DEMO_PREFIX}test_info_1`,
        testTitle: 'Joriy nazorat: Algoritmlar murakkabligi',
        subjectId: `${DEMO_PREFIX}sub_info`,
        subjectName: 'Informatika',
        groupId: `${DEMO_PREFIX}grp_10a`,
        groupName: '10-A Aniq fanlar',
        examType: 'joriy',
        studentId: `${DEMO_PREFIX}stu_jasur`,
        studentName: 'Jasur Abdullayev',
        studentPhotoUrl: '/src/assets/images/student_avatar_jasur_1795150798621.jpg',
        score: 7,
        maxScore: 15,
        percentage: 47,
        correctCount: 1,
        totalQuestions: 3,
        daysAgo: 1,
      },
      // Madina: steady high + growth 75% -> 93%
      {
        id: `${DEMO_PREFIX}att_7`,
        testId: `${DEMO_PREFIX}test_math_1`,
        testTitle: '1-Oraliq nazorat: Kvadrat tenglamalar va funksiyalar',
        subjectId: `${DEMO_PREFIX}sub_math`,
        subjectName: 'Matematika',
        groupId: `${DEMO_PREFIX}grp_10b`,
        groupName: '10-B IT-Akademiya',
        examType: 'oraliq',
        studentId: `${DEMO_PREFIX}stu_madina`,
        studentName: 'Madina Qodirova',
        studentPhotoUrl: '/src/assets/images/student_avatar_madina_1795150798420.jpg',
        score: 15,
        maxScore: 20,
        percentage: 75,
        correctCount: 3,
        totalQuestions: 4,
        daysAgo: 16,
      },
      {
        id: `${DEMO_PREFIX}att_8`,
        testId: `${DEMO_PREFIX}test_info_1`,
        testTitle: 'Joriy nazorat: Algoritmlar murakkabligi',
        subjectId: `${DEMO_PREFIX}sub_info`,
        subjectName: 'Informatika',
        groupId: `${DEMO_PREFIX}grp_10b`,
        groupName: '10-B IT-Akademiya',
        examType: 'joriy',
        studentId: `${DEMO_PREFIX}stu_madina`,
        studentName: 'Madina Qodirova',
        studentPhotoUrl: '/src/assets/images/student_avatar_madina_1795150798420.jpg',
        score: 14,
        maxScore: 15,
        percentage: 93,
        correctCount: 3,
        totalQuestions: 3,
        daysAgo: 3,
      },
      // Sardor: slight decline 73% -> 53%
      {
        id: `${DEMO_PREFIX}att_9`,
        testId: `${DEMO_PREFIX}test_phys_1`,
        testTitle: '2-Oraliq nazorat: Yorug‘lik sinishi va optika',
        subjectId: `${DEMO_PREFIX}sub_phys`,
        subjectName: 'Fizika',
        groupId: `${DEMO_PREFIX}grp_11a`,
        groupName: '11-A Tabiiy fanlar',
        examType: 'oraliq',
        studentId: `${DEMO_PREFIX}stu_sardor`,
        studentName: 'Sardorbek Mirzayev',
        studentPhotoUrl: '/src/assets/images/student_avatar_sardor_1795150798682.jpg',
        score: 11,
        maxScore: 15,
        percentage: 73,
        correctCount: 2,
        totalQuestions: 3,
        daysAgo: 14,
      },
      {
        id: `${DEMO_PREFIX}att_10`,
        testId: `${DEMO_PREFIX}test_phys_1`,
        testTitle: '2-Oraliq nazorat: Yorug‘lik sinishi va optika',
        subjectId: `${DEMO_PREFIX}sub_phys`,
        subjectName: 'Fizika',
        groupId: `${DEMO_PREFIX}grp_11a`,
        groupName: '11-A Tabiiy fanlar',
        examType: 'yakuniy',
        studentId: `${DEMO_PREFIX}stu_sardor`,
        studentName: 'Sardorbek Mirzayev',
        studentPhotoUrl: '/src/assets/images/student_avatar_sardor_1795150798682.jpg',
        score: 8,
        maxScore: 15,
        percentage: 53,
        correctCount: 2,
        totalQuestions: 3,
        daysAgo: 4,
      },
    ];

    // Note: firestore.rules enforces submittedAt == request.time on create,
    // wait: let's check our firestore.rules!
    // In firestore.rules: `incoming().submittedAt == request.time`!
    // Good thing we checked! Let's check if Demo seeding should set `submittedAt: serverTimestamp()` OR allow past timestamps for `isDemo == true`?
    // Wait: if we use `serverTimestamp()` on create, all seeded attempts would have today's timestamp, which wouldn't show a 3-week chart curve!
    // Let's check `attempts` rule in firestore.rules: if `incoming().isDemo == true && isStaff()`, allowing historical `submittedAt is timestamp` lets demo seeding create realistic multi-week curves while real attempts STILL enforce `submittedAt == request.time`!
    // Let's use `daysAgo(a.daysAgo)` here and update `firestore.rules` for `isDemo == true && isStaff()`!
    for (const a of demoAttempts) {
      batch.set(doc(db, 'attempts', a.id), {
        testId: a.testId,
        testTitle: a.testTitle,
        subjectId: a.subjectId,
        subjectName: a.subjectName,
        groupId: a.groupId,
        groupName: a.groupName,
        examType: a.examType,
        studentId: a.studentId,
        studentName: a.studentName,
        studentPhotoUrl: a.studentPhotoUrl,
        studentUid: creatorUid,
        score: a.score,
        maxScore: a.maxScore,
        percentage: a.percentage,
        correctCount: a.correctCount,
        totalQuestions: a.totalQuestions,
        attemptNumber: 1,
        durationSpentSeconds: 780,
        answers: [],
        status: 'completed',
        isDemo: true,
        submittedAt: daysAgo(a.daysAgo),
      });
    }

    // 6. Live Monitoring Demo Sessions for test_math_1
    batch.set(doc(db, 'live_sessions', `${DEMO_PREFIX}test_math_1_${DEMO_PREFIX}stu_aziza`), {
      testId: `${DEMO_PREFIX}test_math_1`,
      studentId: `${DEMO_PREFIX}stu_aziza`,
      studentName: 'Aziza Rustamova',
      studentPhotoUrl: '/src/assets/images/student_avatar_aziza_1795150798218.jpg',
      groupId: `${DEMO_PREFIX}grp_10a`,
      groupName: '10-A Aniq fanlar',
      studentUid: creatorUid,
      status: 'finished',
      answeredCount: 4,
      totalQuestions: 4,
      remainingSeconds: 640,
      draftAnswers: {},
      score: 18,
      percentage: 90,
      isDemo: true,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'live_sessions', `${DEMO_PREFIX}test_math_1_${DEMO_PREFIX}stu_jasur`), {
      testId: `${DEMO_PREFIX}test_math_1`,
      studentId: `${DEMO_PREFIX}stu_jasur`,
      studentName: 'Jasur Abdullayev',
      studentPhotoUrl: '/src/assets/images/student_avatar_jasur_1795150798621.jpg',
      groupId: `${DEMO_PREFIX}grp_10a`,
      groupName: '10-A Aniq fanlar',
      studentUid: creatorUid,
      status: 'working',
      answeredCount: 2,
      totalQuestions: 4,
      remainingSeconds: 920,
      draftAnswers: {},
      isDemo: true,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'live_sessions', `${DEMO_PREFIX}test_math_1_${DEMO_PREFIX}stu_madina`), {
      testId: `${DEMO_PREFIX}test_math_1`,
      studentId: `${DEMO_PREFIX}stu_madina`,
      studentName: 'Madina Qodirova',
      studentPhotoUrl: '/src/assets/images/student_avatar_madina_1795150798420.jpg',
      groupId: `${DEMO_PREFIX}grp_10b`,
      groupName: '10-B IT-Akademiya',
      studentUid: creatorUid,
      status: 'entered',
      answeredCount: 0,
      totalQuestions: 4,
      remainingSeconds: 1500,
      draftAnswers: {},
      isDemo: true,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'demo_seed');
  }
}

export async function clearDemoDataset(): Promise<void> {
  const simpleCollections = ['attempts', 'live_sessions', 'ai_reports', 'subjects', 'groups'];

  try {
    // Delete test subcollection questions first
    const testsSnap = await getDocs(query(collection(db, 'tests'), where('isDemo', '==', true)));
    for (const testDoc of testsSnap.docs) {
      const qSnap = await getDocs(collection(db, 'tests', testDoc.id, 'questions'));
      for (const qDoc of qSnap.docs) {
        await deleteDoc(qDoc.ref);
      }
      await deleteDoc(testDoc.ref);
    }

    // Delete student private credentials & auth hash
    const studentsSnap = await getDocs(query(collection(db, 'students'), where('isDemo', '==', true)));
    for (const stuDoc of studentsSnap.docs) {
      const data = stuDoc.data();
      try {
        await deleteDoc(doc(db, 'students', stuDoc.id, 'private', 'credentials'));
      } catch {
        // ignore if absent
      }
      if (data.login) {
        try {
          await deleteDoc(doc(db, 'student_auth', String(data.login)));
        } catch {
          // ignore if absent
        }
      }
      await deleteDoc(stuDoc.ref);
    }

    for (const colName of simpleCollections) {
      const snap = await getDocs(query(collection(db, colName), where('isDemo', '==', true)));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'demo_clear');
  }
}
