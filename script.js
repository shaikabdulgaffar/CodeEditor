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

// Active-line backgrounds, keyed by tab name
const activeLineEls = {
  html: document.getElementById('html-active-line'),
  css: document.getElementById('css-active-line'),
  js: document.getElementById('js-active-line')
};
const editorEls = { html: htmlCode, css: cssCode, js: jsCode };

// Console panel state (declared here, near the top, so they exist before any
// early call to runCode()/clearConsoleLogs() during startup)
const consoleLogList = document.getElementById('consoleLogList');
const consoleBadge = document.getElementById('consoleBadge');
let consoleEntries = []; // { level, text, count }
let unreadConsoleCount = 0;
let activeOutputView = 'preview';

let currentTab = 'html'; // track active editor
let unsavedChanges = false;

// Project Management
let currentProject = null;

// Load projects from localStorage
function getProjects() {
  const projects = localStorage.getItem('projects');
  return projects ? JSON.parse(projects) : [];
}

// Save projects to localStorage
function saveProjects(projects) {
  localStorage.setItem('projects', JSON.stringify(projects));
}

// Get current project from localStorage
function getCurrentProjectName() {
  return localStorage.getItem('currentProject') || 'Untitled Project';
}

// Set current project in localStorage
function setCurrentProject(projectName) {
  localStorage.setItem('currentProject', projectName);
  currentProject = projectName;
  updateProjectTitle();
}

// Update project title in header
function updateProjectTitle() {
  const titleElement = document.getElementById('projectTitle');
  if (titleElement) {
    titleElement.textContent = currentProject || 'Untitled Project';
  }
}

// Mark/clear the unsaved-changes indicator dot
function setUnsavedState(isUnsaved) {
  unsavedChanges = isUnsaved;
  const dot = document.getElementById('unsavedDot');
  if (dot) dot.classList.toggle('visible', isUnsaved);
}

// Save current project
function saveCurrentProject() {
  if (!currentProject) return;
  
  const projects = getProjects();
  const projectIndex = projects.findIndex(p => p.name === currentProject);
  
  const projectData = {
    name: currentProject,
    html: htmlCode.value,
    css: cssCode.value,
    js: jsCode.value,
    python: document.getElementById('python-code') ? document.getElementById('python-code').value : '',
    sql: document.getElementById('sql-code') ? document.getElementById('sql-code').value : '',
    lastModified: new Date().toISOString()
  };
  
  if (projectIndex >= 0) {
    projects[projectIndex] = projectData;
  } else {
    projects.push(projectData);
  }
  
  saveProjects(projects);
  setUnsavedState(false);
  showNotification('Project saved!');
}

// Create new project
function createNewProject() {
  const projectName = prompt('Enter project name:');
  
  if (!projectName || projectName.trim() === '') {
    showNotification('Project name cannot be empty!', true);
    return;
  }
  
  const trimmedName = projectName.trim();
  const projects = getProjects();
  
  // Check if project already exists
  if (projects.some(p => p.name === trimmedName)) {
    showNotification('Project already exists!', true);
    return;
  }
  
  // Clear editors
  htmlCode.value = '<h1>New Project</h1>';
  cssCode.value = 'h1 { color: #3b82f6; text-align: center; }';
  jsCode.value = 'console.log("New Project Created");';
  if (document.getElementById('python-code')) {
    document.getElementById('python-code').value = "# Write your Python code here\nprint('Hello, World!')\n";
    pyEditorHandle && pyEditorHandle.refresh();
  }
  if (document.getElementById('sql-code')) {
    document.getElementById('sql-code').value = SQL_SAMPLE_QUERY;
    sqlEditorHandle && sqlEditorHandle.refresh();
  }
  
  // Set as current project
  setCurrentProject(trimmedName);
  
  // Save the new project
  saveCurrentProject();
  
  // Update UI
  updateLineNumbers(htmlCode, htmlLineNumbers);
  updateLineNumbers(cssCode, cssLineNumbers);
  updateLineNumbers(jsCode, jsLineNumbers);
  updateStats();
  runCode();
  setUnsavedState(false);

  showNotification(`Project "${trimmedName}" created!`);
}

// Load project
function loadProject(projectName) {
  const projects = getProjects();
  const project = projects.find(p => p.name === projectName);
  
  if (!project) {
    showNotification('Project not found!', true);
    return;
  }
  
  htmlCode.value = project.html || '';
  cssCode.value = project.css || '';
  jsCode.value = project.js || '';
  if (document.getElementById('python-code')) {
    document.getElementById('python-code').value = project.python || "# Write your Python code here\nprint('Hello, World!')\n";
    pyEditorHandle && pyEditorHandle.refresh();
  }
  if (document.getElementById('sql-code')) {
    document.getElementById('sql-code').value = project.sql || SQL_SAMPLE_QUERY;
    sqlEditorHandle && sqlEditorHandle.refresh();
  }
  
  setCurrentProject(projectName);

  // Update UI
  updateLineNumbers(htmlCode, htmlLineNumbers);
  updateLineNumbers(cssCode, cssLineNumbers);
  updateLineNumbers(jsCode, jsLineNumbers);
  updateStats();
  runCode();
  setUnsavedState(false);

  showNotification(`Project "${projectName}" loaded!`);
  closeProjectModal();
}

// Render the (optionally filtered) list of projects into the modal
function renderProjectsList(filterText) {
  const projects = getProjects();
  const projectsList = document.getElementById('projectsList');
  const query = (filterText || '').trim().toLowerCase();

  const filtered = query
    ? projects.filter(p => p.name.toLowerCase().includes(query))
    : projects;

  projectsList.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'project-empty-state';
    empty.textContent = query ? `No projects match "${filterText}"` : 'No projects yet.';
    projectsList.appendChild(empty);
    return;
  }

  filtered
    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
    .forEach(project => {
      const item = document.createElement('div');
      item.className = 'project-item';

      const info = document.createElement('div');
      info.className = 'project-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'project-name';
      nameEl.textContent = project.name;

      const dateEl = document.createElement('div');
      dateEl.className = 'project-date';
      dateEl.textContent = new Date(project.lastModified).toLocaleString();

      info.appendChild(nameEl);
      info.appendChild(dateEl);

      const actions = document.createElement('div');
      actions.className = 'project-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.title = 'Open Project';
      openBtn.dataset.action = 'open';
      openBtn.dataset.name = project.name;
      openBtn.innerHTML = '<i class="fa-solid fa-folder-open"></i>';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.title = 'Delete Project';
      delBtn.dataset.action = 'delete';
      delBtn.dataset.name = project.name;
      delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);

      item.appendChild(info);
      item.appendChild(actions);

      projectsList.appendChild(item);
    });

  // Delegated handlers
  projectsList.onclick = (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.dataset.action === 'open') {
      loadProject(name);
    } else if (btn.dataset.action === 'delete') {
      deleteProject(name);
    }
  };
}

// Show projects modal
function showProjectsModal() {
  const projects = getProjects();

  if (projects.length === 0) {
    showNotification('No projects found. Create a new project first!');
    return;
  }

  const modal = document.getElementById('projectsModal');
  const searchInput = document.getElementById('projectSearch');
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = () => renderProjectsList(searchInput.value);
  }

  renderProjectsList('');
  modal.style.display = 'flex';
  if (searchInput) setTimeout(() => searchInput.focus(), 50);
}

// Close projects modal
function closeProjectModal() {
  const modal = document.getElementById('projectsModal');
  modal.style.display = 'none';
}

// Delete project
function deleteProject(projectName) {
  if (!confirm(`Are you sure you want to delete "${projectName}"?`)) {
    return;
  }
  
  const projects = getProjects();
  const filteredProjects = projects.filter(p => p.name !== projectName);
  saveProjects(filteredProjects);
  
  if (currentProject === projectName) {
    setCurrentProject('Untitled Project');
  }
  
  showNotification(`Project "${projectName}" deleted!`);

  // Refresh list, or close the modal if nothing is left to show
  if (filteredProjects.length === 0) {
    closeProjectModal();
  } else {
    const searchInput = document.getElementById('projectSearch');
    renderProjectsList(searchInput ? searchInput.value : '');
  }
}

// Bridge script injected into the preview iframe: forwards console calls and
// uncaught errors back to the parent window via postMessage so we can render
// them in the Console panel.
const CONSOLE_BRIDGE = `
<script>
(function(){
  const send = (level, args) => {
    let parts;
    try {
      parts = args.map(a => {
        if (a instanceof Error) return a.stack || (a.name + ': ' + a.message);
        if (typeof a === 'object' && a !== null) {
          try { return JSON.stringify(a, null, 2); } catch (e) { return String(a); }
        }
        return typeof a === 'undefined' ? 'undefined' : String(a);
      });
    } catch (e) { parts = ['[unserializable log]']; }
    try {
      parent.postMessage({ __editorConsole: true, level, args: parts }, '*');
    } catch (e) {}
  };
  ['log','info','warn','error'].forEach(level => {
    const original = console[level] ? console[level].bind(console) : function(){};
    console[level] = function(...args) {
      send(level, args);
      original(...args);
    };
  });
  window.addEventListener('error', function(e) {
    send('error', [e.message + ' (line ' + (e.lineno || '?') + ')']);
  });
  window.addEventListener('unhandledrejection', function(e) {
    const reason = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    send('error', ['Uncaught (in promise): ' + reason]);
  });
})();
<\/script>`;

// Run code function
function runCode() {
  const html = htmlCode.value;
  const css = `<style>${cssCode.value}</style>`;
  const js = `<script>${jsCode.value}<\/script>`;
  const source = CONSOLE_BRIDGE + html + css + js;
  clearConsoleLogs(true);
  output.srcdoc = source;

  // Update stats for active editor
  updateStats();
}

// Set initial code
htmlCode.value = `<h1>Hey, write your code here.....</h1>`;
cssCode.value = `h1 { color: #e91e63; text-align: center; }`;
jsCode.value = `console.log("Editor Loaded");`;

// Load current project on startup
const savedProjectName = getCurrentProjectName();
currentProject = savedProjectName;
updateProjectTitle();

// Run initial code
runCode();

// Switch between tabs
function switchTab(tab) {
  currentTab = tab;
  closeFindReplace();

  // Update active tab UI
  document.querySelectorAll('.code-tab').forEach(t => {
    const isActive = (t.dataset.tab || t.textContent.toLowerCase()) === tab;
    t.classList.toggle('active', isActive);
    if (t.getAttribute('role') === 'tab') {
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  });

  // Hide all code blocks and line numbers (scoped to the Web Project panel only —
  // Python/SQL modes have their own single code-block that this must not touch)
  const webPanel = document.getElementById('webModePanel');
  webPanel.querySelectorAll('.code-block').forEach(block => {
    block.style.display = 'none';
    block.classList.remove('active');
  });
  webPanel.querySelectorAll('.line-numbers').forEach(ln => {
    ln.style.display = 'none';
  });

  // Show active code block and line numbers
  const activeBlock = document.getElementById(`${tab}-block`);
  activeBlock.style.display = 'block';
  activeBlock.classList.add('active');
  document.getElementById(`${tab}-line-numbers`).style.display = 'block';

  updateActiveLineBg(tab);
  updateStats();
}

// ===== Find & Replace =====
const findBar = document.getElementById('findBar');
const findInput = document.getElementById('findInput');
const replaceInput = document.getElementById('replaceInput');
const findCountEl = document.getElementById('findCount');
let findMatches = [];
let findMatchIndex = -1;

function getActiveEditor() {
  return editorEls[currentTab];
}

function computeFindMatches() {
  const query = findInput.value;
  findMatches = [];
  findMatchIndex = -1;
  findInput.classList.remove('no-match');

  if (!query) {
    findCountEl.textContent = '0/0';
    return;
  }

  const text = getActiveEditor().value;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  let match;
  while ((match = regex.exec(text)) !== null) {
    findMatches.push({ start: match.index, end: match.index + match[0].length });
    if (match[0].length === 0) regex.lastIndex++; // guard against zero-length loops
  }

  if (findMatches.length === 0) {
    findCountEl.textContent = '0/0';
    findInput.classList.add('no-match');
  } else {
    findMatchIndex = 0;
    selectMatch();
  }
}

function selectMatch() {
  if (findMatches.length === 0) return;
  const m = findMatches[findMatchIndex];
  const editor = getActiveEditor();
  editor.focus();
  editor.setSelectionRange(m.start, m.end);
  // Scroll the match into view roughly
  const lineIndex = editor.value.substr(0, m.start).split('\n').length - 1;
  const approxTop = lineIndex * 21 - editor.clientHeight / 2;
  editor.scrollTop = Math.max(0, approxTop);
  updateActiveLineBg(currentTab);
  findCountEl.textContent = `${findMatchIndex + 1}/${findMatches.length}`;
}

function findNextMatch() {
  if (findMatches.length === 0) { computeFindMatches(); return; }
  findMatchIndex = (findMatchIndex + 1) % findMatches.length;
  selectMatch();
}

function findPrevMatch() {
  if (findMatches.length === 0) { computeFindMatches(); return; }
  findMatchIndex = (findMatchIndex - 1 + findMatches.length) % findMatches.length;
  selectMatch();
}

function replaceCurrentMatch() {
  if (findMatches.length === 0 || findMatchIndex === -1) return;
  const editor = getActiveEditor();
  const m = findMatches[findMatchIndex];
  const replacement = replaceInput.value;
  editor.value = editor.value.slice(0, m.start) + replacement + editor.value.slice(m.end);
  editor.dispatchEvent(new Event('input'));
  // Re-scan since positions shifted
  computeFindMatches();
}

function replaceAllMatches() {
  const query = findInput.value;
  if (!query) return;
  const editor = getActiveEditor();
  const replacement = replaceInput.value;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  const count = (editor.value.match(regex) || []).length;
  editor.value = editor.value.replace(regex, replacement);
  editor.dispatchEvent(new Event('input'));
  computeFindMatches();
  showNotification(count > 0 ? `Replaced ${count} occurrence${count === 1 ? '' : 's'}` : 'Nothing to replace');
}

function toggleFindReplace() {
  const isHidden = findBar.hidden;
  if (isHidden) {
    findBar.hidden = false;
    const editor = getActiveEditor();
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (selected) findInput.value = selected;
    findInput.focus();
    findInput.select();
    computeFindMatches();
  } else {
    closeFindReplace();
  }
}

function closeFindReplace() {
  findBar.hidden = true;
  findMatches = [];
  findMatchIndex = -1;
}

findInput.addEventListener('input', computeFindMatches);
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) findPrevMatch(); else findNextMatch();
  } else if (e.key === 'Escape') {
    closeFindReplace();
  }
});
replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    replaceCurrentMatch();
  } else if (e.key === 'Escape') {
    closeFindReplace();
  }
});
document.getElementById('findNext').addEventListener('click', findNextMatch);
document.getElementById('findPrev').addEventListener('click', findPrevMatch);
document.getElementById('replaceOne').addEventListener('click', replaceCurrentMatch);
document.getElementById('replaceAll').addEventListener('click', replaceAllMatches);
document.getElementById('findClose').addEventListener('click', closeFindReplace);

// ===== Format / Beautify Code =====
function formatCurrentCode() {
  const editor = getActiveEditor();
  const original = editor.value;
  let formatted = original;

  try {
    if (currentTab === 'css') {
      formatted = formatCSS(original);
    } else if (currentTab === 'js') {
      formatted = formatJS(original);
    } else {
      formatted = formatHTML(original);
    }
  } catch (e) {
    showNotification('Could not format: code may have a syntax issue', true);
    return;
  }

  if (formatted === original) {
    showNotification('Already formatted');
    return;
  }

  const scrollPos = editor.scrollTop;
  editor.value = formatted;
  editor.dispatchEvent(new Event('input'));
  editor.scrollTop = scrollPos;
  showNotification('Code formatted');
}

// ===== Clear Code (with confirmation) =====
function clearCurrentCode() {
  const editor = getActiveEditor();
  if (!editor.value) {
    showNotification('Already empty');
    return;
  }
  const tabLabel = currentTab.toUpperCase();
  if (!confirm(`Clear all ${tabLabel} code? This cannot be undone.`)) return;

  editor.value = '';
  editor.dispatchEvent(new Event('input'));
  showNotification(`${tabLabel} code cleared`);
}

function formatCSS(source) {
  // Normalize whitespace, then indent by nesting depth of { }
  let s = source
    .replace(/\s*{\s*/g, ' {\n')
    .replace(/;\s*/g, ';\n')
    .replace(/\s*}\s*/g, '\n}\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let depth = 0;
  const lines = s.map(line => {
    if (line === '}') depth = Math.max(0, depth - 1);
    const indented = '  '.repeat(depth) + line;
    if (line.endsWith('{')) depth += 1;
    return indented;
  });

  return lines.join('\n') + '\n';
}

function formatHTML(source) {
  // Tokenize into tags and text, then reconstruct with indentation
  const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const tokens = source.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  let depth = 0;
  const out = [];

  tokens.forEach(raw => {
    const token = raw.trim();
    if (!token) return;

    if (token.startsWith('<!--')) {
      out.push('  '.repeat(depth) + token);
      return;
    }

    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1);
      out.push('  '.repeat(depth) + token);
      return;
    }

    if (token.startsWith('<')) {
      const tagName = (token.match(/^<([a-zA-Z0-9-]+)/) || [,''])[1].toLowerCase();
      const isSelfClosing = token.endsWith('/>') || VOID_TAGS.has(tagName);
      out.push('  '.repeat(depth) + token);
      if (!isSelfClosing && !token.startsWith('<!')) depth += 1;
      return;
    }

    // Plain text node — keep on its own line at current depth if non-trivial
    const text = token.replace(/\s+/g, ' ').trim();
    if (text) out.push('  '.repeat(depth) + text);
  });

  return out.join('\n') + '\n';
}

function formatJS(source) {
  // Conservative brace-based indenter; does not rewrite tokens, just re-indents lines.
  const rawLines = source.split('\n').map(l => l.trim());
  let depth = 0;
  const out = [];

  rawLines.forEach(line => {
    if (line === '') { out.push(''); return; }

    const startsWithCloser = /^[}\])]/.test(line);
    if (startsWithCloser) depth = Math.max(0, depth - 1);

    out.push('  '.repeat(depth) + line);

    // Count net brace/bracket/paren balance on this line to adjust depth for next line
    let opens = 0, closes = 0;
    let inString = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const prev = line[i - 1];
      if (inString) {
        if (ch === inString && prev !== '\\') inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
      if (ch === '/' && line[i + 1] === '/') break; // line comment
      if ('{[('.includes(ch)) opens++;
      if ('}])'.includes(ch)) closes++;
    }

    let net = opens - closes;
    if (startsWithCloser) net += 1; // already accounted for the leading closer
    depth = Math.max(0, depth + net);
  });

  return out.join('\n');
}

// Copy code function
function copyCode() {
  let codeToCopy;

  if (typeof currentMode !== 'undefined' && currentMode === 'python') {
    codeToCopy = document.getElementById('python-code').value;
  } else if (typeof currentMode !== 'undefined' && currentMode === 'sql') {
    codeToCopy = document.getElementById('sql-code').value;
  } else if (currentTab === 'html') {
    codeToCopy = htmlCode.value;
  } else if (currentTab === 'css') {
    codeToCopy = cssCode.value;
  } else {
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

// ===== Console Panel =====
const CONSOLE_ICONS = {
  log: 'fa-solid fa-chevron-right',
  info: 'fa-solid fa-circle-info',
  warn: 'fa-solid fa-triangle-exclamation',
  error: 'fa-solid fa-circle-xmark'
};

function renderConsole() {
  if (consoleEntries.length === 0) {
    consoleLogList.innerHTML = '<div class="console-empty">Console is empty. Run some JS with <code>console.log()</code> to see output here.</div>';
    return;
  }

  consoleLogList.innerHTML = consoleEntries.map(entry => {
    const icon = CONSOLE_ICONS[entry.level] || CONSOLE_ICONS.log;
    const countBadge = entry.count > 1 ? `<span class="console-entry-count">${entry.count}</span>` : '';
    const escaped = entry.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="console-entry ${entry.level}">
      <span class="console-entry-icon"><i class="${icon}"></i></span>
      <span class="console-entry-body">${escaped}</span>
      ${countBadge}
    </div>`;
  }).join('');

  consoleLogList.scrollTop = consoleLogList.scrollHeight;
}

function addConsoleEntry(level, text) {
  const last = consoleEntries[consoleEntries.length - 1];
  if (last && last.level === level && last.text === text) {
    last.count += 1;
  } else {
    consoleEntries.push({ level, text, count: 1 });
  }

  if (activeOutputView !== 'console') {
    unreadConsoleCount += 1;
    consoleBadge.textContent = unreadConsoleCount > 99 ? '99+' : String(unreadConsoleCount);
    consoleBadge.hidden = false;
  }

  renderConsole();
}

function clearConsoleLogs(silent) {
  consoleEntries = [];
  unreadConsoleCount = 0;
  consoleBadge.hidden = true;
  renderConsole();
  if (!silent) showNotification('Console cleared');
}

// Listen for console messages forwarded from the sandboxed preview iframe
window.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || !data.__editorConsole) return;
  const text = Array.isArray(data.args) ? data.args.join(' ') : String(data.args);
  addConsoleEntry(data.level || 'log', text);
});

function switchOutputView(view) {
  activeOutputView = view;
  document.querySelectorAll('.output-tab').forEach(tab => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.getElementById('previewView').hidden = view !== 'preview';
  document.getElementById('consoleView').hidden = view !== 'console';

  if (view === 'console') {
    unreadConsoleCount = 0;
    consoleBadge.hidden = true;
  }
}

document.querySelectorAll('.output-tab').forEach(tab => {
  tab.addEventListener('click', () => switchOutputView(tab.dataset.view));
});

document.getElementById('consoleClearBtn').addEventListener('click', () => clearConsoleLogs(false));

// Open current output in a new blank tab/window
function openInNewTab() {
  // Build complete HTML document with viewport controls
  const html = htmlCode.value || '';
  const css = cssCode.value ? `<style>${cssCode.value}</style>` : '';
  const js = jsCode.value ? `<script>${jsCode.value}<\/script>` : '';
  
  const fullDoc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preview</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .preview-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow: hidden;
    }
    .preview-wrapper {
      width: 100%;
      height: 100%;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      overflow: hidden;
      transform-origin: top center;
    }
    .preview-wrapper iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    .viewport-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 20px;
      background: #ffffff;
      border-top: 1px solid #e5e7eb;
    }
    .viewport-label {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .vp-btn {
      padding: 8px 16px;
      background: #f3f4f6;
      color: #374151;
      border: 2px solid transparent;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .vp-btn:hover {
      background: #e5e7eb;
      transform: translateY(-2px);
    }
    .vp-btn.active {
      background: #3b82f6;
      color: white;
      border-color: #2563eb;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .divider {
      width: 1px;
      height: 24px;
      background: #d1d5db;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    <div class="preview-wrapper">
      <iframe id="previewFrame"></iframe>
    </div>
  </div>
  
  <div class="viewport-controls">
    <span class="viewport-label">Preview Size:</span>
    <button class="vp-btn active" data-vp="desktop" title="Desktop (Responsive)">
      <i class="fa-solid fa-desktop"></i>Desktop
    </button>
    <button class="vp-btn" data-vp="tablet" title="Tablet (768×1024)">
      <i class="fa-solid fa-tablet-screen-button"></i>Tablet
    </button>
    <button class="vp-btn" data-vp="mobile" title="Mobile (375×667)">
      <i class="fa-solid fa-mobile-screen-button"></i>Mobile
    </button>
  </div>

  <script>
    const VIEWPORTS = {
      mobile: { w: 375, h: 667 },
      tablet: { w: 768, h: 1024 },
      desktop: 'responsive'
    };
    
    let currentViewport = 'desktop';
    const previewFrame = document.getElementById('previewFrame');
    const previewWrapper = document.querySelector('.preview-wrapper');
    const previewContainer = document.querySelector('.preview-container');
    
    function applyViewport(mode) {
      currentViewport = mode;
      const viewport = VIEWPORTS[mode];
      
      document.querySelectorAll('.vp-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vp === mode);
      });
      
      if (viewport === 'responsive') {
        previewWrapper.style.width = '100%';
        previewWrapper.style.height = '100%';
        previewWrapper.style.transform = 'none';
      } else {
        previewWrapper.style.width = viewport.w + 'px';
        previewWrapper.style.height = viewport.h + 'px';
        resizeViewportFit();
      }
    }
    
    function resizeViewportFit() {
      const viewport = VIEWPORTS[currentViewport];
      if (viewport === 'responsive') return;
      
      const containerWidth = previewContainer.clientWidth;
      const containerHeight = previewContainer.clientHeight;
      const viewportRatio = viewport.w / viewport.h;
      const containerRatio = containerWidth / containerHeight;
      
      let scale;
      if (viewportRatio > containerRatio) {
        scale = (containerWidth - 40) / viewport.w;
      } else {
        scale = (containerHeight - 40) / viewport.h;
      }
      
      scale = Math.min(scale, 1);
      previewWrapper.style.transform = \`scale(\${scale})\`;
    }
    
    document.querySelectorAll('.vp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyViewport(btn.dataset.vp);
      });
    });
    
    window.addEventListener('resize', resizeViewportFit);
    applyViewport('desktop');
    
    // Inject the user's content
    const contentDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    contentDoc.open();
    contentDoc.write(\`<!doctype html>
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
</html>\`);
    contentDoc.close();
  </script>
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

// Download code as HTML file
function downloadCode() {
  const html = htmlCode.value || '';
  const css = cssCode.value ? `<style>${cssCode.value}</style>` : '';
  const js  = jsCode.value  ? `<script>${jsCode.value}<\/script>` : '';

  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${(currentProject || 'My Project').replace(/[^a-z0-9 _-]/gi,'')}</title>
${css}
</head>
<body>
${html}
${js}
</body>
</html>`;

  const blob = new Blob([fullDoc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (currentProject || 'project').replace(/[^a-z0-9 _-]/gi,'').trim() || 'project';
  a.download = `${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification('File downloaded successfully!');
}

// Update line numbers and stats
function updateLineNumbers(textarea, lineNumbersElement) {
  const lines = textarea.value.split('\n');
  const lineCount = lines.length;

  // Add extra lines if the last line is not empty (cursor is on a new line)
  const hasExtraLine = textarea.value.endsWith('\n') || textarea.value === '';
  const totalLines = hasExtraLine ? lineCount : lineCount + 1;

  const cursorLine = textarea.value.substr(0, textarea.selectionStart).split('\n').length;

  lineNumbersElement.innerHTML = Array(totalLines)
    .fill(0)
    .map((_, i) => {
      const n = i + 1;
      return n === cursorLine ? `<span class="current-line">${n}</span>` : `<span>${n}</span>`;
    })
    .join('<br>');

  // Sync scrolling
  lineNumbersElement.scrollTop = textarea.scrollTop;
}

// Position the subtle active-line background band under the caret
function updateActiveLineBg(tab) {
  const textarea = editorEls[tab];
  const bg = activeLineEls[tab];
  if (!textarea || !bg) return;

  const lineIndex = textarea.value.substr(0, textarea.selectionStart).split('\n').length - 1;
  const lineHeight = 21; // 14px font-size * 1.5 line-height
  bg.style.display = 'block';
  bg.style.top = `${12 + lineIndex * lineHeight - textarea.scrollTop}px`;
}

// Update character and line count
function updateStats() {
  const activeEditor = currentTab === 'html' ? htmlCode
                   : currentTab === 'css'  ? cssCode
                   : jsCode;

  const lines = activeEditor.value.split('\n');
  lineCount.textContent = lines.length;
  charCount.textContent = activeEditor.value.length;
}

// Debounce helper so highlighting/preview don't re-run on every keystroke of a fast typist
function debounce(fn, wait) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const debouncedRunCode = debounce(runCode, 300);

// Setup line numbers for an editor
function setupLineNumbers(textarea, lineNumbersElement, tab) {
  // Initial update
  updateLineNumbers(textarea, lineNumbersElement);

  // Update on input
  textarea.addEventListener('input', () => {
    updateLineNumbers(textarea, lineNumbersElement);
    updateActiveLineBg(tab);
    updateStats();
    setUnsavedState(true);
    debouncedRunCode();
  });

  // Sync scrolling between textarea and line numbers
  textarea.addEventListener('scroll', () => {
    lineNumbersElement.scrollTop = textarea.scrollTop;
    updateActiveLineBg(tab);
  });

  // Track cursor movement for the active-line highlight and line-number bolding
  textarea.addEventListener('keyup', () => {
    updateLineNumbers(textarea, lineNumbersElement);
    updateActiveLineBg(tab);
  });
  textarea.addEventListener('click', () => {
    updateLineNumbers(textarea, lineNumbersElement);
    updateActiveLineBg(tab);
  });
  textarea.addEventListener('focus', () => updateActiveLineBg(tab));

  // Update on paste (since input event might not catch all pastes)
  textarea.addEventListener('paste', () => {
    setTimeout(() => {
      updateLineNumbers(textarea, lineNumbersElement);
      updateStats();
      setUnsavedState(true);
      runCode();
    }, 0);
  });

  // Handle Tab / Shift+Tab for indent/outdent, and auto-closing brackets/quotes
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;

      if (e.shiftKey) {
        // Outdent: remove up to 2 leading spaces from the current line
        const lineStart = this.value.lastIndexOf('\n', start - 1) + 1;
        const lineText = this.value.slice(lineStart, start);
        const removeCount = lineText.match(/^ {1,2}/);
        if (removeCount) {
          this.value = this.value.slice(0, lineStart) + this.value.slice(lineStart + removeCount[0].length);
          this.selectionStart = this.selectionEnd = Math.max(lineStart, start - removeCount[0].length);
        }
      } else {
        this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
      }

      updateLineNumbers(textarea, lineNumbersElement);
      updateActiveLineBg(tab);
      updateStats();
      setUnsavedState(true);
      runCode();
      return;
    }

    // Auto-close brackets and quotes for a smoother typing experience
    const AUTO_PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (AUTO_PAIRS[e.key] && this.selectionStart === this.selectionEnd) {
      const start = this.selectionStart;
      const closing = AUTO_PAIRS[e.key];
      const nextChar = this.value[start];
      // Don't double up if we're just typing a closing quote/bracket that's already next
      if (e.key === closing && nextChar === closing) {
        e.preventDefault();
        this.selectionStart = this.selectionEnd = start + 1;
        return;
      }
      e.preventDefault();
      this.value = this.value.slice(0, start) + e.key + closing + this.value.slice(start);
      this.selectionStart = this.selectionEnd = start + 1;
      updateLineNumbers(textarea, lineNumbersElement);
      updateStats();
      setUnsavedState(true);
      debouncedRunCode();
      return;
    }

    // Skip over an auto-inserted closing char instead of duplicating it
    const CLOSERS = new Set([')', ']', '}', '"', "'"]);
    if (CLOSERS.has(e.key) && this.selectionStart === this.selectionEnd) {
      const start = this.selectionStart;
      if (this.value[start] === e.key) {
        e.preventDefault();
        this.selectionStart = this.selectionEnd = start + 1;
        return;
      }
    }
  });
}

// Initialize line numbers for all editors
setupLineNumbers(htmlCode, htmlLineNumbers, 'html');
setupLineNumbers(cssCode, cssLineNumbers, 'css');
setupLineNumbers(jsCode, jsLineNumbers, 'js');


// Resizer Functionality (robust across screen sizes/orientation)
const dragbar = document.getElementById("dragbar");
const leftPanel = document.getElementById("codePanel");
const rightPanel = document.getElementById("outputPanel");
const container = document.querySelector(".container");

let isResizing = false;
let activePointerId = null;
let splitRatio = 0.5; // proportion of primary panel along current axis
const RESIZER_SIZE = 4;
const MIN_DESKTOP = 300; // px (row layout)
const MIN_MOBILE = 200;  // px (column layout)

// Determine actual current axis from CSS (row/column)
function isColumnLayout() {
  const fd = getComputedStyle(container).flexDirection;
  return fd === 'column';
}

function setIframeInteractive(enable) {
  const iframe = document.getElementById('output');
  if (iframe) iframe.style.pointerEvents = enable ? 'auto' : 'none';
}

// Sum margins along the active axis so clamping uses usable space accurately
function getAxisMarginsSum(column) {
  const l = getComputedStyle(leftPanel);
  const r = getComputedStyle(rightPanel);
  const n = (v) => Number.parseFloat(v) || 0;
  if (column) {
    return n(l.marginTop) + n(l.marginBottom) + n(r.marginTop) + n(r.marginBottom);
  } else {
    return n(l.marginLeft) + n(l.marginRight) + n(r.marginLeft) + n(r.marginRight);
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function applySplitRatio() {
  const rect = container.getBoundingClientRect();
  const column = isColumnLayout();
  const total = column ? rect.height : rect.width;
  const margins = getAxisMarginsSum(column);
  const usable = Math.max(0, total - RESIZER_SIZE - margins);
  const minPrimary = column ? MIN_MOBILE : MIN_DESKTOP;

  // Convert ratio -> pixels and clamp so both sides keep minimum size
  const primaryPx = clamp(Math.round(usable * splitRatio), minPrimary, Math.max(minPrimary, usable - minPrimary));
  const secondaryPx = Math.max(0, usable - primaryPx);

  leftPanel.style.flex = `0 0 ${primaryPx}px`;
  rightPanel.style.flex = `0 0 ${secondaryPx}px`;
}

function updateSplitFromPixels(primaryPx, totalUsable) {
  splitRatio = clamp(primaryPx / Math.max(1, totalUsable), 0.1, 0.9);
}

dragbar.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  isResizing = true;
  activePointerId = e.pointerId;
  dragbar.setPointerCapture(activePointerId);
  dragbar.classList.add('dragging');
  document.body.style.userSelect = 'none';
  const column = isColumnLayout();
  document.body.style.cursor = column ? "row-resize" : "col-resize";
  dragbar.style.cursor = column ? "row-resize" : "col-resize";
  setIframeInteractive(false);
});

dragbar.addEventListener('pointermove', (e) => {
  if (!isResizing) return;

  const rect = container.getBoundingClientRect();
  const column = isColumnLayout();
  const total = column ? rect.height : rect.width;
  const margins = getAxisMarginsSum(column);
  const usable = Math.max(0, total - RESIZER_SIZE - margins);
  const minPrimary = column ? MIN_MOBILE : MIN_DESKTOP;

  const lpStyle = getComputedStyle(leftPanel);
  const leadMargin = column
    ? (Number.parseFloat(lpStyle.marginTop) || 0)
    : (Number.parseFloat(lpStyle.marginLeft) || 0);

  const pointer = column
    ? (e.clientY - rect.top)
    : (e.clientX - rect.left);

  // Translate pointer position to primary panel inner size (exclude leading margin and half resizer)
  let primaryPx = pointer - leadMargin - (RESIZER_SIZE / 2);
  primaryPx = clamp(primaryPx, minPrimary, Math.max(minPrimary, usable - minPrimary));

  const secondaryPx = Math.max(0, usable - primaryPx);

  leftPanel.style.flex = `0 0 ${primaryPx}px`;
  rightPanel.style.flex = `0 0 ${secondaryPx}px`;

  updateSplitFromPixels(primaryPx, usable);
});

function stopResize() {
  if (!isResizing) return;
  isResizing = false;
  if (activePointerId !== null && dragbar.releasePointerCapture) {
    dragbar.releasePointerCapture(activePointerId);
  }
  activePointerId = null;
  dragbar.classList.remove('dragging');
  document.body.style.cursor = "";
  dragbar.style.cursor = "";
  document.body.style.userSelect = "";
  setIframeInteractive(true);
}

dragbar.addEventListener('pointerup', stopResize);
dragbar.addEventListener('pointercancel', stopResize);
document.addEventListener('pointerup', stopResize);

// Update resizer cursor on hover
dragbar.addEventListener('mouseenter', () => {
  if (!isResizing) {
    const column = isColumnLayout();
    dragbar.style.cursor = column ? "row-resize" : "col-resize";
  }
});

// Re-apply split on resize/orientation/flex-direction changes
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    applySplitRatio();
  }, 100);
});

// Initialize split once
applySplitRatio();

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

// Notification System — toasts stack in a dedicated container so multiple
// notifications fired in quick succession don't overlap each other.
function getToastContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showNotification(message, isError = false) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : 'success'}`;
  toast.innerHTML = `<i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${message}</span>`;

  container.appendChild(toast);

  // Animate in on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3000);
}

// Close modal on outside click
document.getElementById('projectsModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeProjectModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('projectsModal');
    if (modal.style.display === 'flex') {
      closeProjectModal();
    }
  }
});

// Better keyboard navigation for modal
document.getElementById('projectsModal').addEventListener('keydown', function(e) {
  if (e.key === 'Tab') {
    const focusableElements = this.querySelectorAll('button, [tabindex="0"]');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});

// ===== Shortcuts Modal =====
function showShortcutsModal() {
  document.getElementById('shortcutsModal').style.display = 'flex';
}

function closeShortcutsModal() {
  document.getElementById('shortcutsModal').style.display = 'none';
}

document.getElementById('shortcutsModal').addEventListener('click', function(e) {
  if (e.target === this) closeShortcutsModal();
});

// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveCurrentProject();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    // Only hijack Ctrl+F when focus is inside one of our editors, so page-level
    // browser search still works everywhere else.
    if (document.activeElement && document.activeElement.classList.contains('editor')) {
      e.preventDefault();
      if (currentMode === 'python') {
        toggleSimpleFindBar('findBarPy');
      } else if (currentMode === 'sql') {
        toggleSimpleFindBar('findBarSql');
      } else {
        toggleFindReplace();
      }
      return;
    }
  }

  // '?' opens the shortcuts modal, but not while typing in an input/textarea
  if (e.key === '?' && !['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    showShortcutsModal();
    return;
  }

  // Escape: close find bar, or shortcuts modal, or clear output — in that priority order
  if (e.key === 'Escape') {
    if (currentMode === 'python' && !document.getElementById('findBarPy').hidden) {
      const bar = document.getElementById('findBarPy');
      if (bar._pyodideSimpleFindClose) bar._pyodideSimpleFindClose(); else bar.hidden = true;
      return;
    }
    if (currentMode === 'sql' && !document.getElementById('findBarSql').hidden) {
      const bar = document.getElementById('findBarSql');
      if (bar._pyodideSimpleFindClose) bar._pyodideSimpleFindClose(); else bar.hidden = true;
      return;
    }
    if (currentMode === 'web' && !findBar.hidden) {
      closeFindReplace();
      return;
    }
    const shortcutsModal = document.getElementById('shortcutsModal');
    if (shortcutsModal.style.display === 'flex') {
      closeShortcutsModal();
      return;
    }
    if (currentMode === 'web') clearOutput();
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

// Theme toggle keyboard support
toggle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggle.click();
  }
});

// Tab click handling (no inline handlers)
document.querySelector('.code-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.code-tab');
  if (!btn) return;
  const tab = btn.dataset.tab || btn.textContent.toLowerCase();
  switchTab(tab);
});

// Auto-save functionality — persist to localStorage
let autoSaveTimer;
const autoSaveStatusEl = document.getElementById('autoSaveStatus');

function setAutoSaveStatus(state) {
  if (!autoSaveStatusEl) return;
  if (state === 'saving') {
    autoSaveStatusEl.innerHTML = '<i class="fa-solid fa-ellipsis"></i> Saving…';
  } else {
    autoSaveStatusEl.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
  }
}

function setupAutoSave(textarea) {
  textarea.addEventListener('input', function() {
    clearTimeout(autoSaveTimer);
    setAutoSaveStatus('saving');
    autoSaveTimer = setTimeout(() => {
      const pyEl = document.getElementById('python-code');
      const sqlEl = document.getElementById('sql-code');
      const autosave = {
        html: htmlCode.value,
        css: cssCode.value,
        js: jsCode.value,
        python: pyEl ? pyEl.value : undefined,
        sql: sqlEl ? sqlEl.value : undefined,
        ts: Date.now()
      };
      localStorage.setItem('autosave', JSON.stringify(autosave));
      setAutoSaveStatus('saved');
    }, 800);
  });
}

// Setup auto-save for all editors
setupAutoSave(htmlCode);
setupAutoSave(cssCode);
setupAutoSave(jsCode);
if (document.getElementById('python-code')) setupAutoSave(document.getElementById('python-code'));
if (document.getElementById('sql-code')) setupAutoSave(document.getElementById('sql-code'));

// Restore saved code on page load
window.addEventListener('load', function() {
  const autosaveStr = localStorage.getItem('autosave');
  if (autosaveStr) {
    try {
      const saved = JSON.parse(autosaveStr);
      if (typeof saved === 'object') {
        htmlCode.value = saved.html ?? htmlCode.value;
        cssCode.value = saved.css ?? cssCode.value;
        jsCode.value  = saved.js  ?? jsCode.value;
        const pyEl = document.getElementById('python-code');
        const sqlEl = document.getElementById('sql-code');
        if (pyEl && saved.python !== undefined) { pyEl.value = saved.python; pyEditorHandle && pyEditorHandle.refresh(); }
        if (sqlEl && saved.sql !== undefined) { sqlEl.value = saved.sql; sqlEditorHandle && sqlEditorHandle.refresh(); }
      }
    } catch (_) {}
  }
  updateLineNumbers(htmlCode, htmlLineNumbers);
  updateLineNumbers(cssCode, cssLineNumbers);
  updateLineNumbers(jsCode, jsLineNumbers);
  updateStats();
  runCode();
  setUnsavedState(false);
  // Ensure initial tab state
  switchTab(currentTab);
});

// Prevent accidental page close only when there are genuinely unsaved edits
// (autosave already protects content, so this is just a courtesy nudge).
window.addEventListener('beforeunload', function(e) {
  if (unsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

console.log('🚀 TryCode HTML/CSS/JS Editor loaded successfully!');
console.log('💡 Tips:');
console.log('   • Use Tab for indentation');
console.log('   • Use Escape to clear output');
console.log('   • Code is auto-saved as you type');

// ==== Main Editor: Always Desktop Responsive View ====
// Viewport controls have been moved to the new tab preview
// The main editor always displays in responsive desktop mode

const previewWrapper = document.getElementById('previewWrapper');
const outputArea = document.querySelector('.output-area');

// Ensure iframe stays responsive
if (outputArea) {
  const outputAreaRO = new ResizeObserver(() => {
    if (previewWrapper) {
      previewWrapper.style.width = '100%';
      previewWrapper.style.height = '100%';
    }
  });
  outputAreaRO.observe(outputArea);
}

window.addEventListener('resize', () => {
  if (previewWrapper) {
    previewWrapper.style.width = '100%';
    previewWrapper.style.height = '100%';
  }
});

// ===== Mode Switcher: shared infrastructure for Python + SQL editor modes =====
// pyeditor.js and sqleditor.js both call into these — kept here (not
// duplicated in each mode file) since they're identical for both modes and
// this is the "universal" file that always loads first.

let currentMode = 'web';

// ---- Generic single-editor setup (reused for Python + SQL) ----
function setupSimpleEditor(opts) {
  const { textarea, lineNumbers, activeLineEl, onInput, onRun } = opts;

  function update() {
    updateLineNumbers(textarea, lineNumbers);
    positionActiveLine();
    if (onInput) onInput();
  }

  function positionActiveLine() {
    const lineIndex = textarea.value.substr(0, textarea.selectionStart).split('\n').length - 1;
    const lineHeight = 21;
    activeLineEl.style.display = 'block';
    activeLineEl.style.top = `${12 + lineIndex * lineHeight - textarea.scrollTop}px`;
  }

  textarea.addEventListener('input', update);
  textarea.addEventListener('keyup', positionActiveLine);
  textarea.addEventListener('click', positionActiveLine);
  textarea.addEventListener('focus', positionActiveLine);
  textarea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = textarea.scrollTop;
    positionActiveLine();
  });

  // Tab/Shift+Tab indent, auto-closing brackets/quotes — same UX as the main editors
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;
      if (e.shiftKey) {
        const lineStart = this.value.lastIndexOf('\n', start - 1) + 1;
        const lineText = this.value.slice(lineStart, start);
        const removeCount = lineText.match(/^ {1,2}/);
        if (removeCount) {
          this.value = this.value.slice(0, lineStart) + this.value.slice(lineStart + removeCount[0].length);
          this.selectionStart = this.selectionEnd = Math.max(lineStart, start - removeCount[0].length);
        }
      } else {
        this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
      }
      update();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (typeof onRun === 'function') onRun();
      return;
    }

    const AUTO_PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (AUTO_PAIRS[e.key] && this.selectionStart === this.selectionEnd) {
      const start = this.selectionStart;
      const closing = AUTO_PAIRS[e.key];
      const nextChar = this.value[start];
      if (e.key === closing && nextChar === closing) {
        e.preventDefault();
        this.selectionStart = this.selectionEnd = start + 1;
        positionActiveLine();
        return;
      }
      e.preventDefault();
      this.value = this.value.slice(0, start) + e.key + closing + this.value.slice(start);
      this.selectionStart = this.selectionEnd = start + 1;
      update();
      return;
    }

    const CLOSERS = new Set([')', ']', '}', '"', "'"]);
    if (CLOSERS.has(e.key) && this.selectionStart === this.selectionEnd) {
      const start = this.selectionStart;
      if (this.value[start] === e.key) {
        e.preventDefault();
        this.selectionStart = this.selectionEnd = start + 1;
        positionActiveLine();
        return;
      }
    }
  });

  update();
  return { refresh: update };
}

// ===== Mode switching (Web Project / Python / SQL tabs) =====
function switchMode(mode) {
  if (mode === currentMode) return;
  closeFindReplace();
  currentMode = mode;

  document.querySelectorAll('.mode-tab').forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  document.getElementById('webModePanel').hidden = mode !== 'web';
  document.getElementById('webModePanel').classList.toggle('active', mode === 'web');
  document.getElementById('pythonModePanel').hidden = mode !== 'python';
  document.getElementById('sqlModePanel').hidden = mode !== 'sql';

  if (mode === 'python' && typeof onPythonModeActivated === 'function') {
    onPythonModeActivated();
  } else if (mode === 'sql' && typeof onSqlModeActivated === 'function') {
    onSqlModeActivated();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });
});

// Toggle the find & replace bar for the Python/SQL editors (defined here
// since both pyeditor.js and sqleditor.js call it identically)
function toggleSimpleFindBar(barId) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const isHidden = bar.hidden;
  // Close the other simple find bars + the web-mode find/replace bar so only one is open at a time
  ['findBarPy', 'findBarSql'].forEach(id => {
    if (id !== barId) {
      const other = document.getElementById(id);
      if (other) {
        other.hidden = true;
        if (other._simpleFindClose) other._simpleFindClose();
      }
    }
  });
  if (typeof closeFindReplace === 'function') closeFindReplace();

  if (!isHidden) {
    if (bar._simpleFindClose) bar._simpleFindClose();
    else bar.hidden = true;
    return;
  }

  bar.hidden = false;
  const input = bar.querySelector('.find-input');
  const textarea = barId === 'findBarPy' ? document.getElementById('python-code') : document.getElementById('sql-code');
  if (!textarea) return;
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  if (selected) input.value = selected;
  input.focus();
  input.select();
  input.dispatchEvent(new Event('input'));
}

// Full find & replace bar for the Python/SQL single-editor modes
// (mirrors the Web Project find/replace bar's behavior and markup)
function setupSimpleFindBar(barId, textarea, getHandle) {
  const bar = document.getElementById(barId);
  if (!bar || !textarea) return;
  const input = bar.querySelector('.find-input');
  const replaceInput = bar.querySelector('.find-replace-input');
  const countEl = bar.querySelector('.find-count');
  const prevBtn = bar.querySelector('.find-prev-btn');
  const nextBtn = bar.querySelector('.find-next-btn');
  const replaceOneBtn = bar.querySelector('.find-replace-one-btn');
  const replaceAllBtn = bar.querySelector('.find-replace-all-btn');
  const closeBtn = bar.querySelector('.find-btn.find-close');
  let matches = [];
  let idx = -1;

  function compute() {
    const q = input.value;
    matches = [];
    idx = -1;
    if (!q) { countEl.textContent = '0/0'; input.classList.remove('no-match'); return; }
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    let m;
    while ((m = regex.exec(textarea.value)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) regex.lastIndex++;
    }
    if (matches.length === 0) {
      countEl.textContent = '0/0';
      input.classList.add('no-match');
    } else {
      idx = 0;
      input.classList.remove('no-match');
      select();
    }
  }

  function select() {
    const m = matches[idx];
    textarea.focus();
    textarea.setSelectionRange(m.start, m.end);
    countEl.textContent = `${idx + 1}/${matches.length}`;
    const handle = getHandle && getHandle();
    if (handle && handle.refresh) handle.refresh();
  }

  function next() {
    if (matches.length === 0) { compute(); return; }
    idx = (idx + 1) % matches.length;
    select();
  }

  function prev() {
    if (matches.length === 0) { compute(); return; }
    idx = (idx - 1 + matches.length) % matches.length;
    select();
  }

  function replaceCurrent() {
    if (matches.length === 0 || idx === -1) return;
    const m = matches[idx];
    const replacement = replaceInput ? replaceInput.value : '';
    textarea.value = textarea.value.slice(0, m.start) + replacement + textarea.value.slice(m.end);
    textarea.dispatchEvent(new Event('input'));
    compute();
  }

  function replaceAll() {
    const q = input.value;
    if (!q) return;
    const replacement = replaceInput ? replaceInput.value : '';
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const count = (textarea.value.match(regex) || []).length;
    textarea.value = textarea.value.replace(regex, replacement);
    textarea.dispatchEvent(new Event('input'));
    compute();
    if (typeof showNotification === 'function') {
      showNotification(count > 0 ? `Replaced ${count} occurrence${count === 1 ? '' : 's'}` : 'Nothing to replace');
    }
  }

  function close() {
    bar.hidden = true;
    matches = [];
    idx = -1;
  }

  input.addEventListener('input', compute);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev(); else next();
    } else if (e.key === 'Escape') {
      close();
    }
  });
  if (replaceInput) {
    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        replaceCurrent();
      } else if (e.key === 'Escape') {
        close();
      }
    });
  }
  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);
  if (replaceOneBtn) replaceOneBtn.addEventListener('click', replaceCurrent);
  if (replaceAllBtn) replaceAllBtn.addEventListener('click', replaceAll);
  closeBtn.addEventListener('click', close);

  bar._simpleFindClose = close; // exposed so toggleSimpleFindBar / Escape handler can reset state
}