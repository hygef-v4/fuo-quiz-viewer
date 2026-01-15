// State management
let currentData = null;
let currentExamIndex = 0;
let currentQuestionIndex = 0;

// DOM elements
const openZipBtn = document.getElementById('openZipBtn');
const welcomeOpenBtn = document.getElementById('welcomeOpenBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const viewerContent = document.getElementById('viewerContent');
const examList = document.getElementById('examList');
const examCount = document.getElementById('examCount');
const currentExamName = document.getElementById('currentExamName');
const questionCount = document.getElementById('questionCount');
const questionIndicator = document.getElementById('questionIndicator');
const questionImage = document.getElementById('questionImage');
const commentContent = document.getElementById('commentContent');
const prevQuestionBtn = document.getElementById('prevQuestionBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');

// Fullscreen elements
const fullscreenModal = document.getElementById('fullscreenModal');
const fullscreenImage = document.getElementById('fullscreenImage');
const fullscreenClose = document.getElementById('fullscreenClose');
const fsPrevBtn = document.getElementById('fsPrevBtn');
const fsNextBtn = document.getElementById('fsNextBtn');
const fsToggleComments = document.getElementById('fsToggleComments');
const fsCommentSidebar = document.getElementById('fsCommentSidebar');
const fsCommentContent = document.getElementById('fsCommentContent');

// Event listeners
openZipBtn.addEventListener('click', handleOpenZip);
welcomeOpenBtn.addEventListener('click', handleOpenZip);
prevQuestionBtn.addEventListener('click', () => navigateQuestion(-1));
nextQuestionBtn.addEventListener('click', () => navigateQuestion(1));

// Fullscreen image listeners
questionImage.addEventListener('click', openFullscreen);
fullscreenClose.addEventListener('click', closeFullscreen);

fsPrevBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  navigateQuestion(-1);
});

fsNextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  navigateQuestion(1);
});

fsToggleComments.addEventListener('click', (e) => {
  e.stopPropagation();
  fsCommentSidebar.classList.toggle('collapsed');
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  // Close fullscreen with ESC
  if (e.key === 'Escape' && fullscreenModal.classList.contains('active')) {
    closeFullscreen();
    return;
  }
  
  if (!currentData) return;
  
  // Navigate questions with Left/Right arrows
  if (e.key === 'ArrowLeft') {
    navigateQuestion(-1);
  } else if (e.key === 'ArrowRight') {
    navigateQuestion(1);
  }
  // Navigate exams with Up/Down arrows
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentExamIndex > 0) {
      showExam(currentExamIndex - 1);
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentExamIndex < currentData.length - 1) {
      showExam(currentExamIndex + 1);
    }
  }
});

async function handleOpenZip() {
  try {
    const zipPath = await window.electronAPI.selectZipFile();
    
    if (!zipPath) {
      return; // User cancelled
    }
    
    const result = await window.electronAPI.loadZipFile(zipPath);
    
    if (!result.success) {
      alert(`Error loading ZIP file: ${result.error}`);
      return;
    }
    
    if (!result.exams || result.exams.length === 0) {
      alert('No valid exam data found in the ZIP file');
      return;
    }
    
    currentData = result.exams;
    currentExamIndex = 0;
    currentQuestionIndex = 0;
    
    // Hide welcome screen and show viewer immediately
    welcomeScreen.classList.add('hidden');
    viewerContent.classList.remove('hidden');
    
    renderExamList();
    showExam(0);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

function renderExamList() {
  examCount.textContent = currentData.length;
  
  examList.innerHTML = currentData.map((exam, index) => `
    <div class="exam-item ${index === currentExamIndex ? 'active' : ''}" data-index="${index}">
      <div class="exam-item-name">${exam.name}</div>
      <div class="exam-item-info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>${exam.questions.length} questions</span>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.exam-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      showExam(index);
    });
  });
}

function showExam(examIndex) {
  if (!currentData || examIndex < 0 || examIndex >= currentData.length) {
    return;
  }
  
  currentExamIndex = examIndex;
  currentQuestionIndex = 0;
  
  const exam = currentData[examIndex];
  
  // Update exam info
  currentExamName.textContent = exam.name;
  questionCount.textContent = `${exam.questions.length} question${exam.questions.length !== 1 ? 's' : ''}`;
  
  // Update active state in sidebar
  document.querySelectorAll('.exam-item').forEach((item, index) => {
    if (index === examIndex) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Show first question
  showQuestion(0);
}

function showQuestion(questionIndex) {
  const exam = currentData[currentExamIndex];
  
  if (!exam || questionIndex < 0 || questionIndex >= exam.questions.length) {
    return;
  }
  
  currentQuestionIndex = questionIndex;
  const question = exam.questions[questionIndex];
  
  // Update question indicator
  questionIndicator.textContent = `${questionIndex + 1} / ${exam.questions.length}`;
  
  // Update navigation buttons
  prevQuestionBtn.disabled = questionIndex === 0;
  nextQuestionBtn.disabled = questionIndex === exam.questions.length - 1;
  
  // Update Fullscreen buttons
  if (fullscreenModal.classList.contains('active')) {
    fsPrevBtn.disabled = questionIndex === 0;
    fsNextBtn.disabled = questionIndex === exam.questions.length - 1;
  }
  
  // Update question image
  if (question.image) {
    questionImage.src = question.image;
    questionImage.alt = `Question ${question.number}`;
    questionImage.style.cursor = 'pointer';
    questionImage.title = 'Click to view fullscreen';
    
    // Update fullscreen image if open
    if (fullscreenModal.classList.contains('active')) {
      fullscreenImage.src = question.image;
    }
  } else {
    questionImage.src = '';
    questionImage.alt = 'No image available';
    questionImage.style.cursor = 'default';
    
    if (fullscreenModal.classList.contains('active')) {
      fullscreenImage.src = '';
    }
  }
  
  // Update comment with formatted display
  let commentHtml = '<p class="no-comment">No comment available for this question</p>';
  
  if (question.comment && question.comment.trim()) {
    commentHtml = parseComment(question.comment);
  }
  
  commentContent.innerHTML = commentHtml;
  
  // Update fullscreen comment if open
  if (fullscreenModal.classList.contains('active')) {
    fsCommentContent.innerHTML = commentHtml;
  }
}

function parseComment(commentText) {
  // Check if it's a structured comment from fuoverflow.com
  if (commentText.includes('Media ID:') && commentText.includes('Source:')) {
    return parseStructuredComment(commentText);
  }
  
  // Otherwise, display as plain text
  return `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(commentText)}</pre>`;
}

function parseStructuredComment(text) {
  const lines = text.split('\n');
  let html = '';
  
  // Parse metadata (first few lines)
  let metadataHtml = '<div class="comment-metadata">';
  let i = 0;
  
  while (i < lines.length && !lines[i].includes('====')) {
    const line = lines[i].trim();
    
    if (line.startsWith('Media ID:')) {
      metadataHtml += `<div class="comment-metadata-item">
        <span class="comment-metadata-label">Media ID:</span>
        <span class="comment-metadata-value">${escapeHtml(line.replace('Media ID:', '').trim())}</span>
      </div>`;
    } else if (line.startsWith('Source:')) {
      const url = line.replace('Source:', '').trim();
      metadataHtml += `<div class="comment-metadata-item">
        <span class="comment-metadata-label">Source:</span>
        <span class="comment-metadata-value"><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></span>
      </div>`;
    } else if (line.startsWith('Extracted At:')) {
      metadataHtml += `<div class="comment-metadata-item">
        <span class="comment-metadata-label">Extracted At:</span>
        <span class="comment-metadata-value">${escapeHtml(line.replace('Extracted At:', '').trim())}</span>
      </div>`;
    } else if (line.startsWith('Total Comments:')) {
      metadataHtml += `<div class="comment-metadata-item">
        <span class="comment-metadata-label">Total Comments:</span>
        <span class="comment-metadata-value">${escapeHtml(line.replace('Total Comments:', '').trim())}</span>
      </div>`;
    }
    
    i++;
  }
  
  metadataHtml += '</div>';
  html += metadataHtml;
  
  // Skip the separator line
  if (i < lines.length && lines[i].includes('====')) {
    i++;
  }
  
  // Parse individual comments
  let currentComment = null;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.startsWith('#') && line.includes('|')) {
      // Save previous comment if exists
      if (currentComment) {
        html += formatCommentItem(currentComment);
      }
      
      // Start new comment
      const parts = line.split('|').map(p => p.trim());
      const number = parts[0].replace('#', '').trim();
      const userPart = parts.find(p => p.startsWith('User:'));
      const datePart = parts.find(p => p.startsWith('Date:'));
      
      currentComment = {
        number: number,
        user: userPart ? userPart.replace('User:', '').trim() : 'Unknown',
        date: datePart ? datePart.replace('Date:', '').trim() : '',
        id: '',
        content: ''
      };
    } else if (line.startsWith('ID:') && currentComment) {
      currentComment.id = line.replace('ID:', '').trim();
    } else if (line.startsWith('Content:') && currentComment) {
      // Start collecting content
      i++;
      let contentLines = [];
      while (i < lines.length && !lines[i].includes('---')) {
        if (lines[i].trim()) {
          contentLines.push(lines[i].trim());
        }
        i++;
      }
      currentComment.content = contentLines.join(' ');
      i--; // Back up one line
    }
    
    i++;
  }
  
  // Add last comment
  if (currentComment) {
    html += formatCommentItem(currentComment);
  }
  
  return html;
}

function formatCommentItem(comment) {
  return `
    <div class="comment-item">
      <div class="comment-item-header">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="comment-item-number">#${escapeHtml(comment.number)}</span>
          <span class="comment-item-user">${escapeHtml(comment.user)}</span>
        </div>
        <span class="comment-item-date">${escapeHtml(comment.date)}</span>
      </div>
      <div class="comment-item-content">${escapeHtml(comment.content)}</div>
      ${comment.id ? `<div class="comment-item-id">ID: ${escapeHtml(comment.id)}</div>` : ''}
    </div>
  `;
}

function openFullscreen() {
  if (questionImage.src && questionImage.src !== '') {
    fullscreenImage.src = questionImage.src;
    fsCommentContent.innerHTML = commentContent.innerHTML;
    fullscreenModal.classList.add('active');
    
    // Update button states
    const exam = currentData[currentExamIndex];
    fsPrevBtn.disabled = currentQuestionIndex === 0;
    fsNextBtn.disabled = currentQuestionIndex === exam.questions.length - 1;
  }
}

function closeFullscreen() {
  fullscreenModal.classList.remove('active');
}


function navigateQuestion(direction) {
  const exam = currentData[currentExamIndex];
  const newIndex = currentQuestionIndex + direction;
  
  if (newIndex >= 0 && newIndex < exam.questions.length) {
    showQuestion(newIndex);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
