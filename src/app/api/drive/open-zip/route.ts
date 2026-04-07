import { NextRequest, NextResponse } from "next/server";
import { downloadZipFromDrive, parseExamsFromZipBuffer } from "@/lib/drive";

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  try {
    const buffer = await downloadZipFromDrive(fileId);
    const exams = await parseExamsFromZipBuffer(buffer);

    return NextResponse.json({ exams });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
