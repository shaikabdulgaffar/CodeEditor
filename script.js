// DOM Elements
const htmlCode = document.getElementById('html-code');
const cssCode = document.getElementById('css-code');
const jsCode = document.getElementById('js-code');
const output = document.getElementById('output');
const htmlLineNumbers = document.getElementById('html-line-numbers');
const cssLineNumbers = document.getElementById('css-line-numbers');
const jsLineNumbers = document.getElementById('js-line-numbers');
const lineCount = document.getElementById('lineCount');
const charCount = document.getElementById('charCount');

// Set initial code
htmlCode.value = `<h1>Hey, write your code here.....</h1>`;
cssCode.value = `h1 { color: #e91e63; text-align: center; }`;
jsCode.value = `console.log("Editor Loaded");`;

// Run initial code
runCode();

// Run code function
function runCode() {
  const html = htmlCode.value;
  const css = `<style>${cssCode.value}</style>`;
  const js = `<script>${jsCode.value}<\/script>`;
  const source = html + css + js;
  output.srcdoc = source;
  
  // Update stats for active editor
  updateStats();
}

// Switch between tabs
function switchTab(tab) {
  // Update active tab
  document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.code-tab[onclick="switchTab('${tab}')"]`).classList.add('active');
  
  // Hide all editors and line numbers
  document.querySelectorAll('.editor').forEach(editor => {
    editor.style.display = 'none';
  });
  document.querySelectorAll('.line-numbers').forEach(ln => {
    ln.style.display = 'none';
  });
  
  // Show active editor and line numbers
  document.getElementById(`${tab}-code`).style.display = 'block';
  document.getElementById(`${tab}-line-numbers`).style.display = 'block';
  
  // Update stats
  updateStats();
}

// Copy code function
function copyCode() {
  let codeToCopy;
  const activeTab = document.querySelector('.code-tab.active').getAttribute('onclick').match(/'([^']+)'/)[1];
  
  if (activeTab === 'html') {
    codeToCopy = htmlCode.value;
  } else if (activeTab === 'css') {
    codeToCopy = cssCode.value;
  } else if (activeTab === 'js') {
    codeToCopy = jsCode.value;
  }
  
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(codeToCopy)
      .then(() => showNotification("Code copied to clipboard!"))
      .catch(err => showNotification("Failed to copy: " + err.message, true));
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = codeToCopy;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const successful = document.execCommand('copy');
      showNotification(successful ? "Code copied!" : "Copy failed", !successful);
    } catch (err) {
      showNotification("Copy not supported: " + err.message, true);
    }
    document.body.removeChild(textarea);
  }
}

// Clear output
function clearOutput() {
  output.srcdoc = '';
  showNotification("Output cleared");
}

// Open current output in a new blank tab/window
function openInNewTab() {
  // Build complete HTML document
  const html = htmlCode.value || '';
  const css = cssCode.value ? `<style>${cssCode.value}</style>` : '';
  const js = jsCode.value ? `<script>${jsCode.value}<\/script>` : '';
  const fullDoc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preview</title>
  ${css}
</head>
<body>
  ${html}
  ${js}
</body>
</html>`;

  const newWin = window.open('', '_blank');
  if (!newWin) {
    showNotification('Popup blocked — allow popups for this site.', true);
    return;
  }
  newWin.document.open();
  newWin.document.write(fullDoc);
  newWin.document.close();
  showNotification('Opened in new tab');
}

// Update line numbers and stats
function updateLineNumbers(textarea, lineNumbersElement) {
  const lines = textarea.value.split('\n');
  const lineCount = lines.length;
  
  // Add extra lines if the last line is not empty (cursor is on a new line)
  const hasExtraLine = textarea.value.endsWith('\n') || textarea.value === '';
  const totalLines = hasExtraLine ? lineCount : lineCount + 1;
  
  lineNumbersElement.innerHTML = Array(totalLines)
    .fill('<span></span>')
    .map((_, i) => `<span>${i + 1}</span>`)
    .join('<br>');
  
  // Sync scrolling
  lineNumbersElement.scrollTop = textarea.scrollTop;
}

// Update character and line count
function updateStats() {
  const activeTab = document.querySelector('.code-tab.active').getAttribute('onclick').match(/'([^']+)'/)[1];
  let activeEditor;
  
  if (activeTab === 'html') {
    activeEditor = htmlCode;
  } else if (activeTab === 'css') {
    activeEditor = cssCode;
  } else if (activeTab === 'js') {
    activeEditor = jsCode;
  }
  
  const lines = activeEditor.value.split('\n');
  const numLines = lines.length;
  const numChars = activeEditor.value.length;
  
  lineCount.textContent = numLines;
  charCount.textContent = numChars;
}

// Setup line numbers for an editor
function setupLineNumbers(textarea, lineNumbersElement) {
  // Initial update
  updateLineNumbers(textarea, lineNumbersElement);
  
  // Update on input
  textarea.addEventListener('input', () => {
    updateLineNumbers(textarea, lineNumbersElement);
    updateStats();
    runCode();
  });
  
  // Sync scrolling
  textarea.addEventListener('scroll', () => {
    lineNumbersElement.scrollTop = textarea.scrollTop;
  });
  
  // Update on paste (since input event might not catch all pastes)
  textarea.addEventListener('paste', () => {
    setTimeout(() => {
      updateLineNumbers(textarea, lineNumbersElement);
      updateStats();
      runCode();
    }, 0);
  });
  
  // Handle Tab key for indentation
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 2;
      updateLineNumbers(textarea, lineNumbersElement);
      updateStats();
      runCode();
    }
    
    // Handle Ctrl+Enter for run
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      runCode();
    }
  });
}

// Initialize line numbers for all editors
setupLineNumbers(htmlCode, htmlLineNumbers);
setupLineNumbers(cssCode, cssLineNumbers);
setupLineNumbers(jsCode, jsLineNumbers);


// Resizer Functionality
const dragbar = document.getElementById("dragbar");
const leftPanel = document.getElementById("codePanel");
const rightPanel = document.getElementById("outputPanel");
const container = document.querySelector(".container");
let isResizing = false;

dragbar.addEventListener("mousedown", initResize);
dragbar.addEventListener("touchstart", initResize);

function initResize(e) {
  e.preventDefault();
  isResizing = true;
  dragbar.classList.add('dragging');
  document.body.style.cursor = window.innerWidth <= 768 ? "row-resize" : "col-resize";
  document.body.style.userSelect = "none";
  
  if (e.type === 'mousedown') {
    document.addEventListener("mousemove", doResize);
    document.addEventListener("mouseup", stopResize);
  } else {
    document.addEventListener("touchmove", doResize);
    document.addEventListener("touchend", stopResize);
  }
}

function doResize(e) {
  if (!isResizing) return;
  
  const isMobile = window.innerWidth <= 768;
  const containerRect = container.getBoundingClientRect();
  
  if (isMobile) {
    // Vertical resize for mobile
    const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const relativeY = y - containerRect.top;
    const containerHeight = containerRect.height;
    const percentage = Math.max(20, Math.min(80, (relativeY / containerHeight) * 100));
    
    leftPanel.style.flex = `0 0 ${percentage}%`;
    rightPanel.style.flex = `0 0 ${100 - percentage}%`;
  } else {
    // Horizontal resize for desktop
    const x = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const relativeX = x - containerRect.left;
    const containerWidth = containerRect.width;
    const percentage = Math.max(25, Math.min(75, (relativeX / containerWidth) * 100));
    
    leftPanel.style.flex = `0 0 ${percentage}%`;
    rightPanel.style.flex = `0 0 ${100 - percentage}%`;
  }
}

function stopResize() {
  isResizing = false;
  dragbar.classList.remove('dragging');
  document.body.style.cursor = "default";
  document.body.style.userSelect = "auto";
  
  document.removeEventListener("mousemove", doResize);
  document.removeEventListener("mouseup", stopResize);
  document.removeEventListener("touchmove", doResize);
  document.removeEventListener("touchend", stopResize);
}

// Dark/Light Mode Toggle
const toggle = document.getElementById('darkModeToggle');
const themeIcon = document.getElementById('themeIcon');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

// Get saved theme or default to system preference
const currentTheme = localStorage.getItem('theme') || 
                   (prefersDarkScheme.matches ? 'dark' : 'light');

// Apply initial theme
if (currentTheme === 'light') {
  document.body.classList.add('light-mode');
  // show moon icon when in light mode
  themeIcon.classList.remove('fa-sun');
  themeIcon.classList.add('fa-moon');
}

// Toggle functionality
toggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  themeIcon.classList.toggle('fa-moon', isLight);
  themeIcon.classList.toggle('fa-sun', !isLight);
});

// Watch for system theme changes
prefersDarkScheme.addEventListener('change', e => {
  if (!localStorage.getItem('theme')) {
    const isLight = !e.matches;
    document.body.classList.toggle('light-mode', isLight);
    themeIcon.classList.toggle('fa-moon', isLight);
    themeIcon.classList.toggle('fa-sun', !isLight);
  }
});

// Notification System
function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${isError ? '#ef4444' : '#10b981'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 1000;
    font-size: 14px;
    font-weight: 500;
    max-width: 300px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + S to save (prevent default)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    showNotification('Auto-save is always enabled!');
  }
  
  // Escape to clear output
  if (e.key === 'Escape') {
    clearOutput();
  }
  
  // F11 to toggle fullscreen
  if (e.key === 'F11') {
    e.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }
});

// Handle window resize
window.addEventListener('resize', function() {
  // Reset panel sizes on orientation change
  if (window.innerWidth <= 768) {
    leftPanel.style.flex = '';
    rightPanel.style.flex = '';
  }
});

// Auto-save functionality (using memory storage)
let autoSaveTimer;
function setupAutoSave(textarea) {
  textarea.addEventListener('input', function() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      // Save to memory (session storage alternative)
      window.savedCode = {
        html: htmlCode.value,
        css: cssCode.value,
        js: jsCode.value
      };
    }, 1000);
  });
}

// Setup auto-save for all editors
setupAutoSave(htmlCode);
setupAutoSave(cssCode);
setupAutoSave(jsCode);

// Restore saved code on page load
window.addEventListener('load', function() {
  if (window.savedCode) {
    htmlCode.value = window.savedCode.html || htmlCode.value;
    cssCode.value = window.savedCode.css || cssCode.value;
    jsCode.value = window.savedCode.js || jsCode.value;
    
    // Update line numbers and stats
    updateLineNumbers(htmlCode, htmlLineNumbers);
    updateLineNumbers(cssCode, cssLineNumbers);
    updateLineNumbers(jsCode, jsLineNumbers);
    updateStats();
    
    // Run initial code
    runCode();
  }
});

// Prevent accidental page close
window.addEventListener('beforeunload', function(e) {
  const hasContent = [htmlCode, cssCode, jsCode].some(
    editor => editor.value.trim() && 
    !editor.value.trim().startsWith('<!--') && 
    !editor.value.trim().startsWith('/*') && 
    !editor.value.trim().startsWith('//')
  );
  
  if (hasContent) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

console.log('🚀 TryCode HTML/CSS/JS Editor loaded successfully!');
console.log('💡 Tips:');
console.log('   • Use Ctrl+Enter to run code');
console.log('   • Use Tab for indentation');
console.log('   • Use Escape to clear output');
console.log('   • Code is auto-saved as you type');