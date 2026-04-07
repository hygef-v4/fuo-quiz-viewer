# FUO Quiz Web Viewer (Next.js)

Web app de xem de quiz online truc tiep tu Google Drive, khong can tai ZIP ve may nguoi dung.

## 1. Setup

```bash
cd web-next
npm install
```

Tao file `.env.local` tu `.env.example`:

```bash
GOOGLE_API_KEY=your_google_drive_api_key
DRIVE_ROOT_FOLDER_ID=your_root_folder_id
```

## 2. Run

```bash
npm run dev
```

Mo `http://localhost:3000`.

## 3. Cach dung

1. Bam `Load Root` de lay danh sach tu root folder.
2. Bam folder de di vao ben trong.
3. Bam file `.zip` de mo de online.

## 4. Kien truc nhanh

- `src/app/api/drive/list/route.ts`: list files tu Google Drive.
- `src/app/api/drive/open-zip/route.ts`: disabled (tranh Vercel data transfer cost).
- `src/lib/drive.ts`: helper Drive API + parse ZIP.
- `src/app/page.tsx`: UI viewer.

## 5. Luu y

- API key nen dung cho data public read-only.
- Chi can `GOOGLE_API_KEY`; app tu map sang bien public khi build de tai ZIP truc tiep tu Google Drive va giam outgoing/data transfer tren Vercel.
- Fallback parse qua server da duoc tat de tranh bi tinh phi Fast Data Transfer.
- Neu sau nay can private Drive, nen doi qua OAuth/service account.
