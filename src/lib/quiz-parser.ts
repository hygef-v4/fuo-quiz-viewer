import JSZip from "jszip";
import { QuizExam } from "@/lib/types";

function imageMimeFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

export async function parseExamsFromZipBuffer(buffer: ArrayBuffer): Promise<QuizExam[]> {
  const zip = await JSZip.loadAsync(buffer);
  const exams: Record<string, QuizExam> = {};

  const entries = Object.values(zip.files);

  for (const entry of entries) {
    if (entry.dir) continue;

    const pathParts = entry.name.split("/");
    if (pathParts.length < 2) continue;

    const examFolder = pathParts[0];
    const fileName = pathParts[pathParts.length - 1];

    if (!exams[examFolder]) {
      exams[examFolder] = {
        name: examFolder,
        questions: []
      };
    }

    const exam = exams[examFolder];
    if (fileName.includes("_upload")) continue;

    const isImage = /\.(webp|png|jpe?g)$/i.test(fileName);
    const isComment = /_comments\.txt$/i.test(fileName);
    const match = fileName.match(/^(\d+)_/);

    if (!match) continue;

    const questionNumber = Number.parseInt(match[1], 10);
    let question = exam.questions.find((q) => q.number === questionNumber);
    if (!question) {
      question = { number: questionNumber, image: null, comment: null };
      exam.questions.push(question);
    }

    if (isImage) {
      const imageBytes = await entry.async("base64");
      question.image = `data:${imageMimeFromName(fileName)};base64,${imageBytes}`;
    } else if (isComment) {
      question.comment = await entry.async("text");
    }
  }

  const parsed = Object.values(exams);
  parsed.forEach((exam) => exam.questions.sort((a, b) => a.number - b.number));
  return parsed;
}