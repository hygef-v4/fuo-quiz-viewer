export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
};

export type QuizQuestion = {
  number: number;
  image: string | null;
  comment: string | null;
};

export type QuizExam = {
  name: string;
  questions: QuizQuestion[];
};

export type QuizPayload = {
  exams: QuizExam[];
};
