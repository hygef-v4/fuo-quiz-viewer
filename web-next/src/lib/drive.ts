import JSZip from "jszip";
import { DriveFile, QuizExam } from "@/lib/types";

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getRootFolderId(): string {
  return getRequiredEnv("DRIVE_ROOT_FOLDER_ID");
}

function getApiKey(): string {
  return getRequiredEnv("GOOGLE_API_KEY");
}

export function isZipFile(file: DriveFile): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".zip") || file.mimeType.includes("zip");
}

function sortDriveFiles(files: DriveFile[]) {
  return [...files].sort((a, b) => {
    const aIsFolder = a.mimeType === DRIVE_FOLDER_MIME ? 1 : 0;
    const bIsFolder = b.mimeType === DRIVE_FOLDER_MIME ? 1 : 0;

    if (aIsFolder !== bIsFolder) {
      return bIsFolder - aIsFolder;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function listDriveFiles(folderId: string, searchQuery?: string): Promise<DriveFile[]> {
  const escapedSearch = searchQuery?.trim().replace(/'/g, "\\'");
  const query = escapedSearch
    ? `'${folderId}' in parents and name contains '${escapedSearch}' and trashed=false`
    : `'${folderId}' in parents and trashed=false`;
  const fields = "files(id,name,mimeType,size,modifiedTime)";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${getApiKey()}&fields=${fields}&orderBy=folder,name&pageSize=1000`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as {
    files?: DriveFile[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `Drive list failed: ${res.status}`);
  }

  if (json.error) {
    throw new Error(json.error.message || "Drive list error");
  }

  return sortDriveFiles(json.files || []);
}

export async function searchDriveFilesRecursive(
  rootFolderId: string,
  searchQuery: string,
): Promise<DriveFile[]> {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const visited = new Set<string>();
  const matched = new Map<string, DriveFile>();
  const queue: string[] = [rootFolderId];

  // Prevent extremely deep traversals from exploding request count.
  const maxFoldersToScan = 400;

  while (queue.length > 0 && visited.size < maxFoldersToScan) {
    const currentFolderId = queue.shift();
    if (!currentFolderId || visited.has(currentFolderId)) {
      continue;
    }

    visited.add(currentFolderId);
    const files = await listDriveFiles(currentFolderId);

    for (const file of files) {
      if (file.name.toLowerCase().includes(normalizedQuery)) {
        matched.set(file.id, file);
      }

      if (file.mimeType === DRIVE_FOLDER_MIME && !visited.has(file.id)) {
        queue.push(file.id);
      }
    }
  }

  return sortDriveFiles([...matched.values()]);
}

function imageMimeFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

export async function downloadZipFromDrive(fileId: string): Promise<ArrayBuffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${getApiKey()}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`ZIP download failed: ${res.status}`);
  }

  return res.arrayBuffer();
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

export { DRIVE_FOLDER_MIME };
