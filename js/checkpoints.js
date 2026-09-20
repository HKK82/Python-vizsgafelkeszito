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
    nextLesson: null,
    lessonIds: [14, 15, 16],
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
