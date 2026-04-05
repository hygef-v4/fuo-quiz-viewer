const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const AdmZip = require('adm-zip');
const fs = require('fs');

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

function parseExamsFromZip(zip) {
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
        questions: [],
        attachments: []
      };
    }

    // Parse question files
    if (fileName.endsWith('.webp') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      // Skip upload files
      if (fileName.includes('_upload')) return;

      // Extract question number from filename
      const match = fileName.match(/^(\d+)_/);
      if (match) {
        const questionNumber = parseInt(match[1], 10);

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
        const questionNumber = parseInt(match[1], 10);

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
    } else {
      // Handle attachments (anything else)
      // Skip upload files here too just in case
      if (fileName.includes('_upload')) return;

      // Skip hidden files or system files if necessary, but generally include others
      exams[examFolder].attachments.push({
        name: fileName,
        path: entry.entryName,
        size: entry.header.size
      });
    }
  });

  // Sort questions by number in each exam
  Object.values(exams).forEach(exam => {
    exam.questions.sort((a, b) => a.number - b.number);
  });

  return Object.values(exams);
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
    const exams = parseExamsFromZip(zip);
    
    return {
      success: true,
      exams
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('drive-load-zip-file', async (event, fileId) => {
  if (!fileId) {
    return {
      success: false,
      error: 'Missing fileId'
    };
  }

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${API_KEY}`;
    const { statusCode, buffer } = await requestBuffer(url);

    if (statusCode !== 200) {
      throw new Error(`Failed to load ZIP from Drive: ${statusCode}`);
    }

    const zip = new AdmZip(buffer);
    const exams = parseExamsFromZip(zip);

    return {
      success: true,
      exams
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle saving attachments
ipcMain.handle('save-attachment', async (e, { zipPath, entryPath }) => {
  try {
    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry(entryPath);
    
    if (!entry) {
      throw new Error('Attachment not found in ZIP');
    }
    
    const fileName = entry.entryName.split('/').pop();
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Attachment',
      defaultPath: fileName,
      buttonLabel: 'Save'
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    
    fs.writeFileSync(result.filePath, entry.getData());
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Google Drive Integration ---
const https = require('https');

// Helper function to decode base64 (like atob in browser)
const decode64 = (str) => Buffer.from(str, 'base64').toString('utf-8');

const ENCODED_API_KEY = 'QUl6YVN5Q1dmZWEtNlVibUpPbXA3N0UwMFZPRzZHVG0tQlk0SG9n';
const ENCODED_FOLDER_ID = 'MXBvR1JZRzIzelRSbkVYUWhzYVkxZktYeTFBdS1yYjdE';

// Decode credentials at runtime
const API_KEY = decode64(ENCODED_API_KEY);
const FOLDER_ID = decode64(ENCODED_FOLDER_ID);

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getImageMimeType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function isQuestionImage(fileName) {
  const lower = fileName.toLowerCase();
  return (lower.endsWith('.webp') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) && !lower.includes('_upload');
}

function requestBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, (res) => {
      // Follow redirect (Google Drive media endpoint can redirect)
      if (res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
        if (!res.headers.location) {
          reject(new Error('Redirect without location header'));
          return;
        }
        requestBuffer(res.headers.location, options).then(resolve).catch(reject);
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, buffer });
      });
    });

    req.on('error', reject);
  });
}

async function requestJson(url, retries = 2) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      const { statusCode, buffer } = await requestBuffer(url);
      const text = buffer.toString('utf8');

      if (statusCode >= 500 || statusCode === 429) {
        throw new Error(`Drive API temporary error ${statusCode}: ${text}`);
      }

      if (statusCode !== 200) {
        throw new Error(`Drive API error ${statusCode}: ${text}`);
      }

      const json = JSON.parse(text);
      if (json.error) {
        throw new Error(typeof json.error === 'string' ? json.error : (json.error.message || 'Unknown Drive error'));
      }

      return json;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await delay(200 * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError;
}

async function listDriveFiles(folderId) {
  const targetFolderId = folderId || FOLDER_ID;
  const query = `'${targetFolderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${API_KEY}&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=folder,name&pageSize=1000`;
  const json = await requestJson(url);
  return json.files || [];
}

function parseDriveExamFiles(examName, files) {
  const questionsByNumber = new Map();
  const attachments = [];

  files.forEach(file => {
    if (!file || !file.name) return;
    const fileName = file.name;
    const lower = fileName.toLowerCase();

    if (lower.includes('_upload')) {
      return;
    }

    if (isQuestionImage(fileName)) {
      const match = fileName.match(/^(\d+)_/);
      if (!match) {
        attachments.push({
          id: file.id,
          name: fileName,
          size: Number(file.size || 0)
        });
        return;
      }

      const questionNumber = parseInt(match[1], 10);
      let question = questionsByNumber.get(questionNumber);
      if (!question) {
        question = {
          number: questionNumber,
          image: null,
          imageRef: null,
          comment: null,
          commentRef: null
        };
        questionsByNumber.set(questionNumber, question);
      }

      question.imageRef = {
        fileId: file.id,
        mimeType: file.mimeType || getImageMimeType(fileName),
        name: fileName
      };
      return;
    }

    if (lower.endsWith('_comments.txt')) {
      const match = fileName.match(/^(\d+)_/);
      if (!match) {
        attachments.push({
          id: file.id,
          name: fileName,
          size: Number(file.size || 0)
        });
        return;
      }

      const questionNumber = parseInt(match[1], 10);
      let question = questionsByNumber.get(questionNumber);
      if (!question) {
        question = {
          number: questionNumber,
          image: null,
          imageRef: null,
          comment: null,
          commentRef: null
        };
        questionsByNumber.set(questionNumber, question);
      }

      question.commentRef = {
        fileId: file.id,
        name: fileName
      };
      return;
    }

    attachments.push({
      id: file.id,
      name: fileName,
      size: Number(file.size || 0)
    });
  });

  return {
    name: examName,
    sourceType: 'drive',
    questions: Array.from(questionsByNumber.values()).sort((a, b) => a.number - b.number),
    attachments
  };
}

ipcMain.handle('drive-list-files', async (event, folderId) => {
  return listDriveFiles(folderId);
});

ipcMain.handle('drive-load-exams-from-folder', async (event, folderId) => {
  const targetFolderId = folderId || FOLDER_ID;
  const children = await listDriveFiles(targetFolderId);
  const examFolders = children.filter(file => file.mimeType === DRIVE_FOLDER_MIME);
  const rootExamFiles = children.filter(file => file.mimeType !== DRIVE_FOLDER_MIME);
  const rootZipFiles = rootExamFiles.filter(file => {
    const name = (file.name || '').toLowerCase();
    return name.endsWith('.zip') || (file.mimeType || '').includes('zip');
  });
  const exams = [];

  // Folder-per-exam structure
  for (const folder of examFolders) {
    const examFiles = await listDriveFiles(folder.id);
    const parsed = parseDriveExamFiles(folder.name, examFiles);
    if (parsed.questions.length > 0 || parsed.attachments.length > 0) {
      exams.push(parsed);
    }
  }

  // Support a flat structure where questions are directly in the selected folder
  if (rootExamFiles.length > 0) {
    const parsedRoot = parseDriveExamFiles('Drive Dataset', rootExamFiles);
    if (parsedRoot.questions.length > 0 || parsedRoot.attachments.length > 0) {
      exams.push(parsedRoot);
    }
  }

  const totalQuestions = exams.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0);
  if (totalQuestions === 0 && rootZipFiles.length > 0) {
    return {
      success: false,
      error: 'This folder contains ZIP archives only. Please open a ZIP file directly from Drive list instead of opening the whole folder as dataset.'
    };
  }

  return {
    success: true,
    exams
  };
});

ipcMain.handle('drive-read-text-file', async (event, fileId) => {
  if (!fileId) {
    return {
      success: false,
      error: 'Missing fileId'
    };
  }

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${API_KEY}`;
    const { statusCode, buffer } = await requestBuffer(url);

    if (statusCode !== 200) {
      throw new Error(`Failed to read text file: ${statusCode}`);
    }

    return {
      success: true,
      text: buffer.toString('utf8')
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('drive-read-image-file', async (event, { fileId, mimeType }) => {
  if (!fileId) {
    return {
      success: false,
      error: 'Missing fileId'
    };
  }

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${API_KEY}`;
    const { statusCode, buffer } = await requestBuffer(url);

    if (statusCode !== 200) {
      throw new Error(`Failed to read image file: ${statusCode}`);
    }

    const normalizedMime = mimeType || 'application/octet-stream';
    return {
      success: true,
      dataUrl: `data:${normalizedMime};base64,${buffer.toString('base64')}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('drive-download-file', async (event, { fileId, fileName }) => {
  return new Promise((resolve, reject) => {
    // Create exam-data folder in userData directory (persists across updates)
    const examDataPath = path.join(app.getPath('userData'), 'exam-data');
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(examDataPath)) {
      fs.mkdirSync(examDataPath, { recursive: true });
    }
    
    const destPath = path.join(examDataPath, fileName);
    
    // Check if file already exists
    if (fs.existsSync(destPath)) {
      // File already downloaded, return existing path
      resolve(destPath);
      return;
    }
    
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
    const file = fs.createWriteStream(destPath);

    https.get(url, (res) => {
      // Follow redirects if necessary (Google Drive might redirect)
      if (res.statusCode === 302 || res.statusCode === 303) {
        https.get(res.headers.location, (redirectRes) => {
           if (redirectRes.statusCode !== 200) {
             reject(`Failed to download (redirect): ${redirectRes.statusCode}`);
             return;
           }
           
           const totalSize = parseInt(redirectRes.headers['content-length'], 10);
           let downloadedSize = 0;
           
           redirectRes.on('data', (chunk) => {
             downloadedSize += chunk.length;
             const progress = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0;
             event.sender.send('drive-download-progress', { progress, downloadedSize, totalSize });
           });
           
           redirectRes.pipe(file);
           file.on('finish', () => {
             file.close(() => resolve(destPath));
           });
        }).on('error', (err) => {
           fs.unlink(destPath, () => {});
           reject(err.message);
        });
        return;
      }

      if (res.statusCode !== 200) {
        reject(`Failed to download: ${res.statusCode}`);
        return;
      }
      
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloadedSize = 0;
      
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0;
        event.sender.send('drive-download-progress', { progress, downloadedSize, totalSize });
      });
      
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err.message);
    });
  });
});

ipcMain.handle('drive-search-files', async (event, { folderId, searchQuery }) => {
  const escapedQuery = searchQuery.toLowerCase();
  
  // Helper function to search in a folder
  const searchInFolder = (targetFolderId) => {
    return new Promise((resolve, reject) => {
      listDriveFiles(targetFolderId)
        .then(resolve)
        .catch(err => reject(err.message || String(err)));
    });
  };
  
  // Recursive search function
  const searchRecursive = async (targetFolderId) => {
    const files = await searchInFolder(targetFolderId);
    let results = [];
    
    // Filter matching files
    const matching = files.filter(f => 
      f.name && f.name.toLowerCase().includes(escapedQuery)
    );
    results.push(...matching);
    
    // Recursively search in subfolders
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    for (const folder of folders) {
      try {
        const subResults = await searchRecursive(folder.id);
        results.push(...subResults);
      } catch (e) {
        // Skip folders we can't access
        console.error('Error searching folder:', folder.name, e);
      }
    }
    
    return results;
  };
  
  try {
    const results = await searchRecursive(folderId);
    return results;
  } catch (error) {
    throw new Error(error);
  }
});

// Get list of downloaded exams
ipcMain.handle('get-downloaded-exams', async () => {
  try {
    const examDataPath = path.join(app.getPath('userData'), 'exam-data');
    
    if (!fs.existsSync(examDataPath)) {
      return [];
    }
    
    const files = fs.readdirSync(examDataPath);
    const exams = files
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(examDataPath, f));
        return {
          name: f,
          path: path.join(examDataPath, f),
          size: stats.size,
          modifiedTime: stats.mtime
        };
      })
      .sort((a, b) => b.modifiedTime - a.modifiedTime); // Sort by date, newest first
    
    return exams;
  } catch (error) {
    console.error('Error getting downloaded exams:', error);
    return [];
  }
});

// Show file in Explorer
ipcMain.handle('show-in-explorer', async (event, filePath) => {
  const { shell } = require('electron');
  shell.showItemInFolder(filePath);
});

// Delete exam file
ipcMain.handle('delete-exam', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    } else {
      return { success: false, error: 'File not found' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open exam-data folder
ipcMain.handle('open-exam-folder', async () => {
  const { shell } = require('electron');
  const examDataPath = path.join(app.getPath('userData'), 'exam-data');
  
  // Create folder if it doesn't exist
  if (!fs.existsSync(examDataPath)) {
    fs.mkdirSync(examDataPath, { recursive: true });
  }
  
  shell.openPath(examDataPath);
});

// --- Auto Updater Logic ---
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = true;
log.info('App starting...');

function sendStatusToWindow(text) {
  log.info(text);
  if (mainWindow) {
    mainWindow.webContents.send('update-message', text);
  }
}

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
});

autoUpdater.on('error', (err) => {
  sendStatusToWindow('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  sendStatusToWindow(log_message);
  
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded');
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

ipcMain.handle('check-for-update', () => {
  if (!app.isPackaged) {
    return;
  }
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('restart-app', () => {
  autoUpdater.quitAndInstall(false, true);
});

app.on('ready', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});
