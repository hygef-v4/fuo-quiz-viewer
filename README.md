# FUO Quiz Viewer

An Electron application for viewing quiz files from ZIP archives. This app allows you to browse exam folders containing question images and their corresponding comments.

## Features

- 📁 **ZIP File Support**: Open ZIP files containing exam folders
- 🖼️ **Image Viewer**: View question images (supports .webp, .png, .jpg, .jpeg)
- 💬 **Comment Display**: Read comments associated with each question
- ⌨️ **Keyboard Navigation**: Use arrow keys to navigate between questions
- 🎨 **Modern UI**: Beautiful dark theme with smooth animations
- 📱 **Responsive Design**: Works on different screen sizes

## File Structure Expected

The ZIP file should contain exam folders with the following structure:

```
exam-code.zip
├── MLN111 - Q1 - 5/
│   ├── 265_MLN111__SP_2025__RE_3404.webp
│   ├── 265_MLN111__SP_2025__RE_3404_comments.txt
│   ├── 266_MLN111__SP_2025__RE_3404.webp
│   ├── 266_MLN111__SP_2025__RE_3404_comments.txt
│   └── ...
├── MLN111 - Q1 - 8/
│   └── ...
└── ...
```

**Naming Convention:**
- Images: `{number}_{exam_code}__{session}__{type}.{ext}`
- Comments: `{number}_{exam_code}__{session}__{type}_comments.txt`

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Keyboard Shortcuts

- **Left Arrow**: Previous question
- **Right Arrow**: Next question

## Technologies Used

- **Electron**: Desktop application framework
- **adm-zip**: ZIP file extraction
- **HTML/CSS/JavaScript**: UI and logic

## License

MIT
