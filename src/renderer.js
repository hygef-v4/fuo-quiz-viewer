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

// Event listeners
openZipBtn.addEventListener('click', handleOpenZip);
welcomeOpenBtn.addEventListener('click', handleOpenZip);
prevQuestionBtn.addEventListener('click', () => navigateQuestion(-1));
nextQuestionBtn.addEventListener('click', () => navigateQuestion(1));

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!currentData) return;
  
  if (e.key === 'ArrowLeft') {
    navigateQuestion(-1);
  } else if (e.key === 'ArrowRight') {
    navigateQuestion(1);
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
    
    renderExamList();
    showExam(0);
    
    // Hide welcome screen and show viewer
    welcomeScreen.classList.add('hidden');
    viewerContent.classList.remove('hidden');
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
  
  // Update question image
  if (question.image) {
    questionImage.src = question.image;
    questionImage.alt = `Question ${question.number}`;
  } else {
    questionImage.src = '';
    questionImage.alt = 'No image available';
  }
  
  // Update comment
  if (question.comment && question.comment.trim()) {
    commentContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(question.comment)}</pre>`;
  } else {
    commentContent.innerHTML = '<p class="no-comment">No comment available for this question</p>';
  }
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
