import { NextRequest, NextResponse } from "next/server";
import {
  DRIVE_FOLDER_MIME,
  getRootFolderId,
  listDriveFiles,
  searchDriveFilesRecursive,
} from "@/lib/drive";

export async function GET(req: NextRequest) {
  try {
    const folderId = req.nextUrl.searchParams.get("folderId") || getRootFolderId();
    const searchQuery = req.nextUrl.searchParams.get("search") || undefined;
    const files = searchQuery
      ? await searchDriveFilesRecursive(folderId, searchQuery)
      : await listDriveFiles(folderId);

    return NextResponse.json({
      folderId: searchQuery ? undefined : folderId,
      files: files.map((f) => ({
        ...f,
        isFolder: f.mimeType === DRIVE_FOLDER_MIME,
        isZip: f.name.toLowerCase().endsWith(".zip") || f.mimeType.includes("zip")
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
