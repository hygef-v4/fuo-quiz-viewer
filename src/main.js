const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const AdmZip = require('adm-zip');
const fs = require('fs');

// Enable hot reload in development mode
// Enable hot reload in development mode
if (!app.isPackaged) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (_) {}
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0f172a',
    title: 'FUO Quiz Viewer'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development mode
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file selection
ipcMain.handle('select-zip-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'ZIP Files', extensions: ['zip'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// Handle zip extraction and parsing
ipcMain.handle('load-zip-file', async (event, zipPath) => {
  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    
    // Parse the structure
    const exams = {};
    
    zipEntries.forEach(entry => {
      if (entry.isDirectory) return;
      
      const pathParts = entry.entryName.split('/');
      if (pathParts.length < 2) return;
      
      const examFolder = pathParts[0];
      const fileName = pathParts[pathParts.length - 1];
      
      // Initialize exam folder if not exists
      if (!exams[examFolder]) {
        exams[examFolder] = {
          name: examFolder,
          questions: []
        };
      }
      
      // Parse question files
      if (fileName.endsWith('.webp') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        // Skip upload files
        if (fileName.includes('_upload')) return;

        // Extract question number from filename
        const match = fileName.match(/^(\d+)_/);
        if (match) {
          const questionNumber = parseInt(match[1]);
          
          // Find or create question entry
          let question = exams[examFolder].questions.find(q => q.number === questionNumber);
          if (!question) {
            question = {
              number: questionNumber,
              image: null,
              comment: null
            };
            exams[examFolder].questions.push(question);
          }
          
          // Store image as base64
          const imageData = entry.getData();
          const base64Image = imageData.toString('base64');
          const mimeType = fileName.endsWith('.webp') ? 'image/webp' : 
                          fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
          question.image = `data:${mimeType};base64,${base64Image}`;
        }
      } else if (fileName.endsWith('_comments.txt')) {
        // Extract question number from comment filename
        const match = fileName.match(/^(\d+)_/);
        if (match) {
          const questionNumber = parseInt(match[1]);
          
          // Find or create question entry
          let question = exams[examFolder].questions.find(q => q.number === questionNumber);
          if (!question) {
            question = {
              number: questionNumber,
              image: null,
              comment: null
            };
            exams[examFolder].questions.push(question);
          }
          
          // Store comment text
          const commentData = entry.getData();
          question.comment = commentData.toString('utf8');
        }
      }
    });
    
    // Sort questions by number in each exam
    Object.values(exams).forEach(exam => {
      exam.questions.sort((a, b) => a.number - b.number);
    });
    
    return {
      success: true,
      exams: Object.values(exams)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
