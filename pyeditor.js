// ===================================================================
// Python Mode — self-contained module
// Contains everything specific to Python mode: its panel markup, its
// mode-exclusive CSS, and all of its JS logic (Pyodide loading, running
// code, the output console, editor setup, find & replace wiring).
//
// Depends on shared/universal code from script.js:
//   updateLineNumbers, setupSimpleEditor, setupSimpleFindBar,
//   closeFindReplace, showNotification, copyCode, setUnsavedState
// ===================================================================

(function () {
  // ---- 1. Inject this mode's markup into the placeholder left in index.html ----
  const PYTHON_MODE_HTML = `
    <div class="container">
      <div class="panel" id="pyPanel">
        <div class="top-bar">
          <div class="file-label">
            <i class="fa-brands fa-python" style="color:#3776ab; margin-right:8px;" aria-hidden="true"></i>
            main.py
          </div>
          <div class="button-group">
            <button type="button" class="icon-btn" onclick="clearPythonCode()" title="Clear Code">
              <i class="fa-solid fa-trash icon"></i>
              <span class="btn-text">Clear</span>
            </button>
            <button type="button" class="icon-btn" onclick="toggleSimpleFindBar('findBarPy')" title="Find &amp; Replace (Ctrl+F)">
              <i class="fa-solid fa-magnifying-glass icon"></i>
              <span class="btn-text">Find</span>
            </button>
            <button type="button" class="copy" onclick="copyCode()" title="Copy Code">
              <i class="fa-solid fa-copy icon" style="margin-right: 6px;"></i>
              Copy
            </button>
            <button type="button" class="run-btn" id="pyRunBtn" onclick="runPython()" title="Run Python (Ctrl+Enter)">
              <i class="fa-solid fa-play icon" style="margin-right: 6px;"></i>
              Run
            </button>
          </div>
        </div>

        <div class="find-bar" id="findBarPy" hidden>
          <i class="fa-solid fa-magnifying-glass find-icon" aria-hidden="true"></i>
          <input type="text" class="find-input find-input-py" placeholder="Find" autocomplete="off" spellcheck="false">
          <span class="find-count">0/0</span>
          <button type="button" class="find-btn find-prev-btn" title="Previous match (Shift+Enter)"><i class="fa-solid fa-chevron-up"></i></button>
          <button type="button" class="find-btn find-next-btn" title="Next match (Enter)"><i class="fa-solid fa-chevron-down"></i></button>
          <span class="find-divider"></span>
          <input type="text" class="find-input find-replace-input" placeholder="Replace" autocomplete="off" spellcheck="false">
          <button type="button" class="find-btn find-text-btn find-replace-one-btn">Replace</button>
          <button type="button" class="find-btn find-text-btn find-replace-all-btn">All</button>
          <button type="button" class="find-btn find-close find-close-py" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="editor-container">
          <div class="line-numbers" id="python-line-numbers">1</div>
          <div class="code-block active" id="python-block">
            <div class="active-line-bg" id="python-active-line"></div>
            <textarea id="python-code" class="editor" spellcheck="false" inputmode="text" autocomplete="off" placeholder="# Write your Python code here
print('Hello, World!')"></textarea>
          </div>
        </div>
      </div>

      <div class="resizer" id="dragbarPy" aria-hidden="true"></div>

      <div class="output-panel" id="pyOutputPanel">
        <div class="top-bar">
          <div class="file-label">
            <i class="fa-solid fa-terminal" style="margin-right:8px;" aria-hidden="true"></i>
            Output
          </div>
          <div class="button-group">
            <button class="clear" onclick="clearPythonOutput()" title="Clear Output" type="button">
              <i class="fa-solid fa-trash icon" style="margin-right: 6px;"></i>
              <span class="btn-text">Clear</span>
            </button>
          </div>
        </div>
        <div class="console-area" style="display:flex">
          <div class="console-toolbar">
            <span class="console-hint" id="pyStatusHint"><i class="fa-solid fa-circle-info"></i> Click Run to execute your Python code</span>
          </div>
          <div class="console-log-list" id="pythonOutput">
            <div class="console-empty">Output from <code>print()</code> and errors will show up here.</div>
          </div>
        </div>
      </div>
    </div>
    <div class="status-bar">
      <div class="status-left">
        <div class="status-item"><span>Lines: </span><span id="pyLineCount">1</span></div>
        <div class="status-item"><span>Characters: </span><span id="pyCharCount">0</span></div>
      </div>
      <div class="status-right">
        <div class="status-item" id="pyEngineStatus"><i class="fa-solid fa-circle-notch"></i> Python not loaded yet</div>
      </div>
    </div>
  `;

  const panel = document.getElementById('pythonModePanel');
  if (panel) panel.innerHTML = PYTHON_MODE_HTML;

  // ---- 2. Inject this mode's exclusive CSS ----
  // Everything else (buttons, editor, find-bar, status-bar) reuses the
  // universal classes already defined in styles.css.
  const PYTHON_MODE_CSS = `
    #pyEngineStatus .fa-circle-notch { animation: spin 1s linear infinite; }
    #pyEngineStatus .fa-circle-check { color: #10b981; }
    #pyEngineStatus .fa-triangle-exclamation { color: #f59e0b; }
  `;
  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-mode-styles', 'python');
  styleTag.textContent = PYTHON_MODE_CSS;
  document.head.appendChild(styleTag);

  // ---- 3. Python Editor Setup ----
  const pythonCode = document.getElementById('python-code');
  const pyLineNumbers = document.getElementById('python-line-numbers');
  const pyActiveLine = document.getElementById('python-active-line');
  const pyLineCountEl = document.getElementById('pyLineCount');
  const pyCharCountEl = document.getElementById('pyCharCount');

  let pyEditorHandle = null;
  if (pythonCode) {
    pythonCode.value = `# Write your Python code here\nname = "World"\nprint(f"Hello, {name}!")\n\nfor i in range(5):\n    print(i, i * i)\n`;
    pyEditorHandle = window.pyEditorHandle = setupSimpleEditor({
      textarea: pythonCode,
      lineNumbers: pyLineNumbers,
      activeLineEl: pyActiveLine,
      onRun: () => runPython(),
      onInput: () => {
        pyLineCountEl.textContent = pythonCode.value.split('\n').length;
        pyCharCountEl.textContent = pythonCode.value.length;
        if (typeof setUnsavedState === 'function') setUnsavedState(true);
      }
    });
    pyLineCountEl.textContent = pythonCode.value.split('\n').length;
    pyCharCountEl.textContent = pythonCode.value.length;
  }

  // Clear the Python code editor (with confirmation)
  window.clearPythonCode = function clearPythonCode() {
    if (!pythonCode.value) {
      showNotification && showNotification('Already empty');
      return;
    }
    if (!confirm('Clear all Python code? This cannot be undone.')) return;
    pythonCode.value = '';
    pythonCode.dispatchEvent(new Event('input'));
    showNotification && showNotification('Python code cleared');
  };

  // ---- 4. Pyodide (Python-in-the-browser) lazy loading ----
  let pyodideInstance = null;
  let pyodideLoadingPromise = null;

  function setPyEngineStatus(html) {
    const el = document.getElementById('pyEngineStatus');
    if (el) el.innerHTML = html;
  }

  function ensurePyodideLoaded() {
    if (pyodideInstance || pyodideLoadingPromise) return pyodideLoadingPromise;

    setPyEngineStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Loading Python runtime… (first time only)');
    const runBtn = document.getElementById('pyRunBtn');
    if (runBtn) runBtn.disabled = true;

    pyodideLoadingPromise = new Promise((resolve, reject) => {
      // Remove any stale loader script from a previous failed attempt so the
      // browser always performs a clean retry instead of reusing a dead tag.
      document.querySelectorAll('script[data-pyodide-loader]').forEach(s => s.remove());

      const script = document.createElement('script');
      script.dataset.pyodideLoader = 'true';
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.3/full/pyodide.js';
      script.onload = async () => {
        try {
          pyodideInstance = await loadPyodide();
          setPyEngineStatus('<i class="fa-solid fa-circle-check"></i> Python ready');
          if (runBtn) runBtn.disabled = false;
          resolve(pyodideInstance);
        } catch (err) {
          setPyEngineStatus('<i class="fa-solid fa-triangle-exclamation"></i> Failed to start Python runtime — click Run to retry');
          appendPyOutput('error', 'Could not start the Python runtime: ' + err.message);
          // Reset the guard so the next Run click retries instead of reusing this failure forever.
          pyodideInstance = null;
          pyodideLoadingPromise = null;
          if (runBtn) runBtn.disabled = false;
          reject(err);
        }
      };
      script.onerror = () => {
        setPyEngineStatus('<i class="fa-solid fa-triangle-exclamation"></i> Could not load Python runtime — click Run to retry');
        appendPyOutput('error', 'Failed to load Pyodide from the CDN. Check your internet connection and try again.');
        // Same reset here — a network blip should not permanently disable Python mode.
        pyodideInstance = null;
        pyodideLoadingPromise = null;
        if (runBtn) runBtn.disabled = false;
        reject(new Error('Failed to load pyodide.js'));
      };
      document.head.appendChild(script);
    });

    return pyodideLoadingPromise;
  }

  // ---- 5. Output console ----
  const pythonOutputEl = document.getElementById('pythonOutput');

  function appendPyOutput(level, text) {
    if (pythonOutputEl.querySelector('.console-empty')) {
      pythonOutputEl.innerHTML = '';
    }
    const entry = document.createElement('div');
    entry.className = `console-entry ${level === 'error' ? 'error' : 'log'}`;
    if (level === 'error') {
      // Keep a clear visual marker only for errors — plain print() output
      // should read like a normal terminal, without a leading icon/prompt
      // character on every line.
      entry.innerHTML = `<span class="console-entry-icon"><i class="fa-solid fa-circle-xmark"></i></span><span class="console-entry-body"></span>`;
    } else {
      entry.innerHTML = `<span class="console-entry-body"></span>`;
    }
    entry.querySelector('.console-entry-body').textContent = text; // textContent: safe against injection
    pythonOutputEl.appendChild(entry);
    pythonOutputEl.scrollTop = pythonOutputEl.scrollHeight;
  }

  window.clearPythonOutput = function clearPythonOutput() {
    pythonOutputEl.innerHTML = '<div class="console-empty">Output from <code>print()</code> and errors will show up here.</div>';
  };

  // ---- 6. Run Python ----
  let pythonRunning = false;

  window.runPython = async function runPython() {
    if (pythonRunning) return;
    const runBtn = document.getElementById('pyRunBtn');
    const hint = document.getElementById('pyStatusHint');

    try {
      pythonRunning = true;
      if (runBtn) { runBtn.disabled = true; runBtn.classList.add('running'); }
      if (hint) hint.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Running…';

      const pyodide = await ensurePyodideLoaded();
      clearPythonOutput();

      // Track the most recent stdout chunk so we can show it as the prompt
      // text in the input dialog — Python's input("some text") writes "some
      // text" to stdout right before reading, so this recovers that text even
      // though Pyodide's stdin callback itself receives no arguments.
      let lastStdoutChunk = '';
      pyodide.setStdout({
        batched: (s) => {
          lastStdoutChunk = s;
          appendPyOutput('stdout', s);
        }
      });
      pyodide.setStderr({ batched: (s) => appendPyOutput('error', s) });

      // Custom stdin handler for input(): Pyodide's built-in default stdin
      // (which silently falls back to the browser's prompt() Web API) throws
      // "OSError: [Errno 29] I/O error" in some browsers/contexts when called
      // from inside runPythonAsync. Calling window.prompt() ourselves here
      // sidesteps that internal path entirely and reliably supports input().
      pyodide.setStdin({
        stdin: () => {
          const promptText = lastStdoutChunk || 'Input:';
          const value = window.prompt(promptText);
          if (value === null) {
            // User hit Cancel — let Python raise the normal EOFError for a
            // cancelled input(), but note it in the output panel too.
            appendPyOutput('error', '(input cancelled)');
            return null;
          }
          // Echo the exchange into the output panel so the transcript reads
          // like a real terminal session (prompt followed by what was typed).
          appendPyOutput('stdout', `${promptText}${value}`);
          lastStdoutChunk = '';
          return value;
        }
      });

      try {
        await pyodide.loadPackagesFromImports(pythonCode.value);
        await pyodide.runPythonAsync(pythonCode.value);
        if (hint) hint.innerHTML = '<i class="fa-solid fa-circle-check"></i> Finished';
      } catch (err) {
        appendPyOutput('error', String(err.message || err));
        if (hint) hint.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Finished with errors';
      }
    } catch (err) {
      // ensurePyodideLoaded already reported this to the output panel
      if (hint) hint.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Python runtime unavailable — try Run again';
    } finally {
      pythonRunning = false;
      if (runBtn) { runBtn.disabled = false; runBtn.classList.remove('running'); }
    }
  };

  // ---- 7. Wire up find & replace (shared logic from script.js) ----
  document.addEventListener('DOMContentLoaded', () => {
    setupSimpleFindBar('findBarPy', pythonCode, () => pyEditorHandle);
  });

  // ---- 8. Hook for the shared mode-switcher in script.js ----
  // switchMode('python') calls this if it's defined, so Pyodide starts
  // loading and the editor re-syncs its layout as soon as the tab opens.
  window.onPythonModeActivated = function onPythonModeActivated() {
    ensurePyodideLoaded();
    pyEditorHandle && pyEditorHandle.refresh();
  };
})();