# Quick Start Guide

## Running the Application

The application is now running! You should see the FUO Quiz Viewer window.

## How to Use

### 1. Open a ZIP File
- Click the **"Open ZIP File"** button in the header or on the welcome screen
- Select your ZIP file containing exam folders
- The app will automatically parse and display all exams

### 2. Browse Exams
- The left sidebar shows all available exams
- Click on any exam to view its questions
- The active exam is highlighted with a blue border

### 3. Navigate Questions
- Use the **Previous** and **Next** buttons to navigate between questions
- Or use keyboard shortcuts:
  - **Left Arrow** ← : Previous question
  - **Right Arrow** → : Next question
- The current question number is displayed in the center (e.g., "1 / 10")

### 4. View Content
- **Left Panel**: Displays the question image
- **Right Panel**: Shows the comment/answer for the current question

## Expected ZIP Structure

Your ZIP file should follow this structure:

```
your-exam.zip
├── Exam Folder 1/
│   ├── 1_EXAM_CODE__SESSION__TYPE.webp
│   ├── 1_EXAM_CODE__SESSION__TYPE_comments.txt
│   ├── 2_EXAM_CODE__SESSION__TYPE.webp
│   ├── 2_EXAM_CODE__SESSION__TYPE_comments.txt
│   └── ...
├── Exam Folder 2/
│   └── ...
└── ...
```

**Important:**
- Each question image must start with a number (e.g., `265_`, `266_`)
- Comment files must have the same name as the image + `_comments.txt`
- Supported image formats: `.webp`, `.png`, `.jpg`, `.jpeg`

## Features

✅ **Auto-Detection**: Automatically detects and pairs images with their comments
✅ **Multiple Formats**: Supports various image formats
✅ **Keyboard Navigation**: Quick navigation with arrow keys
✅ **Modern UI**: Beautiful dark theme with smooth animations
✅ **Responsive**: Adapts to different window sizes

## Development Commands

```bash
# Run in development mode (with DevTools)
npm run dev

# Run in production mode
npm start
```

## Troubleshooting

### No exams showing up?
- Make sure your ZIP file has the correct folder structure
- Check that image files start with a number followed by underscore
- Ensure comment files end with `_comments.txt`

### Images not displaying?
- Verify the image format is supported (.webp, .png, .jpg, .jpeg)
- Check that the file is not corrupted

### Comments not showing?
- Ensure the comment file name matches the image file name + `_comments.txt`
- Example: `265_MLN111__SP_2025__RE_3404.webp` → `265_MLN111__SP_2025__RE_3404_comments.txt`

## Next Steps

1. Test with your actual ZIP file
2. Navigate through different exams and questions
3. Enjoy the smooth experience! 🎉
