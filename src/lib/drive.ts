import { DriveFile } from "@/lib/types";
export { parseExamsFromZipBuffer } from "@/lib/quiz-parser";

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

export async function downloadZipFromDrive(fileId: string): Promise<ArrayBuffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${getApiKey()}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`ZIP download failed: ${res.status}`);
  }

  return res.arrayBuffer();
}

export { DRIVE_FOLDER_MIME };
