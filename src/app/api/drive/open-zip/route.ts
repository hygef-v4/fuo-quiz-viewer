import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: "open-zip proxy is disabled to avoid Vercel data transfer costs. Use direct Drive loading in the browser.",
    },
    { status: 410 }
  );
}
