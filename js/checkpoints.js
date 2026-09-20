export const checkpoints = [
  {
    id: 'checkpoint-1',
    examId: 'checkpoint-1',
    title: 'Kisvizsga 1 – Kiírás, változók, input()',
    afterLesson: 3,
    nextLesson: 4,
    lessonIds: [1, 2, 3],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-2',
    examId: 'checkpoint-2',
    title: 'Kisvizsga 2 – Számok és alapműveletek',
    afterLesson: 6,
    nextLesson: 7,
    lessonIds: [4, 5, 6],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-3',
    examId: 'checkpoint-3',
    title: 'Kisvizsga 3 – Szövegformázás és döntések',
    afterLesson: 10,
    nextLesson: 11,
    lessonIds: [7, 8, 9, 10],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-4',
    examId: 'checkpoint-4',
    title: 'Kisvizsga 4 – Listák és for ciklus',
    afterLesson: 13,
    nextLesson: 14,
    lessonIds: [11, 12, 13],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-5',
    examId: 'checkpoint-5',
    title: 'Kisvizsga 5 – range, while, függvények',
    afterLesson: 16,
    nextLesson: 17,
    lessonIds: [14, 15, 16],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-6',
    examId: 'checkpoint-6',
    title: 'Kisvizsga 6 – Algoritmusok',
    afterLesson: 20,
    nextLesson: 21,
    lessonIds: [17, 18, 19, 20],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-7',
    examId: 'checkpoint-7',
    title: 'Kisvizsga 7 – Modulok és fájlkezelés',
    afterLesson: 24,
    nextLesson: 25,
    lessonIds: [21, 22, 23, 24],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-8',
    examId: 'checkpoint-8',
    title: 'Kisvizsga 8 – Osztályok és objektumok',
    afterLesson: 28,
    nextLesson: 29,
    lessonIds: [25, 26, 27, 28],
    passPct: 80,
    minTaskPct: 60
  },
  {
    id: 'checkpoint-9',
    examId: 'checkpoint-9',
    title: 'Kisvizsga 9 – Csomagok és kódjavítás',
    afterLesson: 30,
    nextLesson: null,
    lessonIds: [29, 30],
    passPct: 80,
    minTaskPct: 60
  }
];

export function checkpointAfterLesson(lessonId) {
  return checkpoints.find(cp => cp.afterLesson === Number(lessonId)) || null;
}

export function checkpointRequiredBeforeLesson(lessonId) {
  const n = Number(lessonId);
  return checkpoints.find(cp => cp.nextLesson !== null && n >= cp.nextLesson && n <= (checkpoints[checkpoints.indexOf(cp) + 1]?.afterLesson || 999)) || null;
}

export function checkpointById(id) {
  return checkpoints.find(cp => cp.id === id || cp.examId === id) || null;
}
