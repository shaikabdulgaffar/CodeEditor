// ===================================================================
// Data Analysis Mode — self-contained module
// Contains everything specific to Data mode: its panel markup, its
// mode-exclusive CSS (image/table output cards), and all of its JS
// logic (Pyodide + NumPy/pandas/Matplotlib/Seaborn loading, running
// code, the mixed text+image+table output stream, editor setup,
// find & replace wiring).
//
// Runs its own independent Pyodide runtime (same approach pyeditor.js
// and sqleditor.js take with their own engines) so this mode stays
// fully self-contained. The trade-off is a second Python runtime
// download if someone uses both Python mode and Data mode — sharing
// one runtime between them is a reasonable follow-up if that matters
// for your use case.
//
// Depends on shared/universal code from script.js:
//   updateLineNumbers, setupSimpleEditor, setupSimpleFindBar,
//   closeFindReplace, showNotification, copyCode, setUnsavedState
// ===================================================================

(function () {
  // ---- 1. Inject this mode's markup into the placeholder left in index.html ----
  const DATA_MODE_HTML = `
    <div class="container">
      <div class="panel" id="dataPanel">
        <div class="top-bar">
          <div class="file-label">
            <i class="fa-solid fa-chart-line" style="color:#a78bfa; margin-right:8px;" aria-hidden="true"></i>
            analysis.py
          </div>
          <div class="button-group">
            <button type="button" class="icon-btn" onclick="clearDataCode()" title="Clear Code">
              <i class="fa-solid fa-trash icon"></i>
              <span class="btn-text">Clear</span>
            </button>
            <button type="button" class="icon-btn" onclick="toggleSimpleFindBar('findBarData')" title="Find &amp; Replace (Ctrl+F)">
              <i class="fa-solid fa-magnifying-glass icon"></i>
              <span class="btn-text">Find</span>
            </button>
            <button type="button" class="copy" onclick="copyCode()" title="Copy Code">
              <i class="fa-solid fa-copy icon" style="margin-right: 6px;"></i>
              Copy
            </button>
            <button type="button" class="run-btn" id="dataRunBtn" onclick="runDataAnalysis()" title="Run Analysis (Ctrl+Enter)">
              <i class="fa-solid fa-play icon" style="margin-right: 6px;"></i>
              Run
            </button>
          </div>
        </div>

        <div class="find-bar" id="findBarData" hidden>
          <i class="fa-solid fa-magnifying-glass find-icon" aria-hidden="true"></i>
          <input type="text" class="find-input find-input-data" placeholder="Find" autocomplete="off" spellcheck="false">
          <span class="find-count">0/0</span>
          <button type="button" class="find-btn find-prev-btn" title="Previous match (Shift+Enter)"><i class="fa-solid fa-chevron-up"></i></button>
          <button type="button" class="find-btn find-next-btn" title="Next match (Enter)"><i class="fa-solid fa-chevron-down"></i></button>
          <span class="find-divider"></span>
          <input type="text" class="find-input find-replace-input" placeholder="Replace" autocomplete="off" spellcheck="false">
          <button type="button" class="find-btn find-text-btn find-replace-one-btn">Replace</button>
          <button type="button" class="find-btn find-text-btn find-replace-all-btn">All</button>
          <button type="button" class="find-btn find-close find-close-data" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="editor-container">
          <div class="line-numbers" id="data-line-numbers">1</div>
          <div class="code-block active" id="data-block">
            <div class="active-line-bg" id="data-active-line"></div>
            <textarea id="data-code" class="editor" spellcheck="false" inputmode="text" autocomplete="off" placeholder="# numpy, pandas, matplotlib (plt) and seaborn (sns) are preloaded
# along with a sample dataset in df"></textarea>
          </div>
        </div>
      </div>

      <div class="resizer" id="dragbarData" aria-hidden="true"></div>

      <div class="output-panel" id="dataOutputPanel">
        <div class="top-bar">
          <div class="file-label">
            <i class="fa-solid fa-chart-simple" style="margin-right:8px;" aria-hidden="true"></i>
            Output
          </div>
          <div class="button-group">
            <button class="clear" onclick="resetSampleData()" title="Reset the sample dataset (df)" type="button">
              <i class="fa-solid fa-arrows-rotate icon" style="margin-right: 6px;"></i>
              <span class="btn-text">Reset Data</span>
            </button>
            <button class="clear" onclick="clearDataOutput()" title="Clear Output" type="button">
              <i class="fa-solid fa-trash icon" style="margin-right: 6px;"></i>
              <span class="btn-text">Clear</span>
            </button>
          </div>
        </div>
        <div class="console-area" style="display:flex">
          <div class="console-toolbar">
            <span class="console-hint" id="dataStatusHint"><i class="fa-solid fa-circle-info"></i> Click Run to execute your analysis</span>
          </div>
          <div class="console-log-list" id="dataOutput">
            <div class="console-empty">Output from <code>print()</code>, <code>show()</code>, and Matplotlib/Seaborn plots will show up here.</div>
          </div>
        </div>
      </div>
    </div>
    <div class="status-bar">
      <div class="status-left">
        <div class="status-item"><span>Lines: </span><span id="dataLineCount">1</span></div>
        <div class="status-item"><span>Characters: </span><span id="dataCharCount">0</span></div>
      </div>
      <div class="status-right">
        <div class="status-item" id="dataEngineStatus"><i class="fa-solid fa-circle-notch"></i> Data engine not loaded yet</div>
      </div>
    </div>
  `;

  const panel = document.getElementById('dataModePanel');
  if (panel) panel.innerHTML = DATA_MODE_HTML;

  // ---- 2. Inject this mode's exclusive CSS ----
  const DATA_MODE_CSS = `
    #dataEngineStatus .fa-circle-notch { animation: spin 1s linear infinite; }
    #dataEngineStatus .fa-circle-check { color: #10b981; }
    #dataEngineStatus .fa-triangle-exclamation { color: #f59e0b; }

    .data-image-entry, .data-table-entry {
      padding: 12px 14px;
    }

    .data-image-card {
      position: relative;
      display: inline-block;
      max-width: 100%;
      background: var(--bg-tertiary-dark);
      border: 1px solid var(--border-dark);
      border-radius: 8px;
      padding: 8px;
    }

    .data-image-card img {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    .data-image-download {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.75);
      color: white;
      border-radius: 6px;
      font-size: 12px;
      text-decoration: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .data-image-card:hover .data-image-download {
      opacity: 1;
    }

    .data-table-wrapper {
      overflow: auto;
      border: 1px solid var(--border-dark);
      border-radius: 8px;
      max-height: 360px;
    }

    .data-table-wrapper table {
      border-collapse: collapse;
      width: 100%;
      font-family: 'Monaco', 'Cascadia Code', 'Courier New', monospace;
      font-size: 12.5px;
    }

    .data-table-wrapper th {
      position: sticky;
      top: 0;
      background-color: var(--bg-tertiary-dark);
      color: var(--primary-color);
      text-align: left;
      padding: 7px 12px;
      border-bottom: 2px solid var(--border-dark);
      white-space: nowrap;
      font-weight: 700;
    }

    .data-table-wrapper td {
      padding: 6px 12px;
      border-bottom: 1px solid var(--border-dark);
      color: var(--text-dark);
      white-space: nowrap;
    }

    .data-table-wrapper tbody tr:hover {
      background-color: rgba(167, 139, 250, 0.08);
    }
  `;
  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-mode-styles', 'data');
  styleTag.textContent = DATA_MODE_CSS;
  document.head.appendChild(styleTag);

  // ---- 3. Data Editor Setup ----
  const dataCode = document.getElementById('data-code');
  const dataLineNumbers = document.getElementById('data-line-numbers');
  const dataActiveLine = document.getElementById('data-active-line');
  const dataLineCountEl = document.getElementById('dataLineCount');
  const dataCharCountEl = document.getElementById('dataCharCount');

  const DATA_STARTER_CODE = window.DATA_STARTER_CODE = `# A sample sales dataset is preloaded as df (date, region, category, units_sold, revenue)
print(df.head())
print(df.describe(numeric_only=True))

# numpy, pandas, matplotlib.pyplot (plt) and seaborn (sns) are already
# imported for you — call plt.show() to render a plot below
fig, ax = plt.subplots(figsize=(7, 4))
sns.barplot(data=df, x="region", y="revenue", hue="category", estimator=sum, ax=ax)
ax.set_title("Total Revenue by Region and Category")
plt.tight_layout()
plt.show()

# show() also renders a DataFrame or Series as a table below
show(df.groupby("region", as_index=False)["revenue"].sum())
`;

  let dataEditorHandle = null;
  if (dataCode) {
    dataCode.value = DATA_STARTER_CODE;
    dataEditorHandle = window.dataEditorHandle = setupSimpleEditor({
      textarea: dataCode,
      lineNumbers: dataLineNumbers,
      activeLineEl: dataActiveLine,
      onRun: () => runDataAnalysis(),
      onInput: () => {
        dataLineCountEl.textContent = dataCode.value.split('\n').length;
        dataCharCountEl.textContent = dataCode.value.length;
        if (typeof setUnsavedState === 'function') setUnsavedState(true);
      }
    });
    dataLineCountEl.textContent = dataCode.value.split('\n').length;
    dataCharCountEl.textContent = dataCode.value.length;
  }

  // Clear the Data code editor (with confirmation)
  window.clearDataCode = function clearDataCode() {
    if (!dataCode.value) {
      showNotification && showNotification('Already empty');
      return;
    }
    if (!confirm('Clear all code? This cannot be undone.')) return;
    dataCode.value = '';
    dataCode.dispatchEvent(new Event('input'));
    showNotification && showNotification('Code cleared');
  };

  // ---- 4. Sample dataset (offline — no network fetch needed) ----
  const SAMPLE_CSV = `date,region,category,units_sold,revenue
2024-01-05,North,Electronics,120,18400
2024-01-05,North,Apparel,300,9600
2024-01-05,South,Electronics,95,14250
2024-01-05,South,Apparel,410,12300
2024-01-05,East,Electronics,150,22500
2024-01-05,East,Apparel,260,7800
2024-01-05,West,Electronics,180,27000
2024-01-05,West,Apparel,340,10200
2024-02-05,North,Electronics,135,20500
2024-02-05,North,Apparel,280,8900
2024-02-05,South,Electronics,110,16700
2024-02-05,South,Apparel,390,11700
2024-02-05,East,Electronics,160,24200
2024-02-05,East,Apparel,300,9000
2024-02-05,West,Electronics,200,30500
2024-02-05,West,Apparel,320,9600
2024-03-05,North,Electronics,142,21700
2024-03-05,North,Apparel,310,9800
2024-03-05,South,Electronics,105,15900
2024-03-05,South,Apparel,420,12600
2024-03-05,East,Electronics,175,26400
2024-03-05,East,Apparel,290,8700
2024-03-05,West,Electronics,210,32000
2024-03-05,West,Apparel,350,10500
2024-04-05,North,Electronics,150,23000
2024-04-05,North,Apparel,330,10500
2024-04-05,South,Electronics,120,18200
2024-04-05,South,Apparel,400,12000
2024-04-05,East,Electronics,190,28700
2024-04-05,East,Apparel,270,8100
2024-04-05,West,Electronics,225,34200
2024-04-05,West,Apparel,360,10800
2024-05-05,North,Electronics,165,25300
2024-05-05,North,Apparel,350,11200
2024-05-05,South,Electronics,130,19700
2024-05-05,South,Apparel,430,12900
2024-05-05,East,Electronics,205,31000
2024-05-05,East,Apparel,310,9300
2024-05-05,West,Electronics,240,36500
2024-05-05,West,Apparel,370,11100
2024-06-05,North,Electronics,178,27200
2024-06-05,North,Apparel,365,11700
2024-06-05,South,Electronics,140,21300
2024-06-05,South,Apparel,440,13200
2024-06-05,East,Electronics,215,32600
2024-06-05,East,Apparel,320,9600
2024-06-05,West,Electronics,255,38800
2024-06-05,West,Apparel,380,11400`;

  // Bootstrap Python: preloads numpy/pandas/matplotlib/seaborn, the sample
  // dataset (df), and a show()/plt.show() bridge that ships rendered
  // figures and DataFrame/Series tables back to the JS output panel.
  function buildBootstrapPy(csv) {
    return `
import io, base64
import matplotlib
matplotlib.use("AGG")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import js as _js

sns.set_theme(style="darkgrid")

_SAMPLE_CSV = """${csv}"""

def _load_sample():
    return pd.read_csv(io.StringIO(_SAMPLE_CSV), parse_dates=["date"])

df = _load_sample()

def _emit_image(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    buf.seek(0)
    _js.dataModeEmit("image", base64.b64encode(buf.read()).decode("ascii"))
    plt.close(fig)

def _capture_open_figures():
    for num in plt.get_fignums():
        _emit_image(plt.figure(num))

def show(obj=None):
    """Display a DataFrame/Series as a table, a Figure as an image, or
    print() anything else. Call show() with no arguments to flush any
    matplotlib figures that are still open."""
    if obj is None:
        _capture_open_figures()
        return
    if isinstance(obj, pd.DataFrame):
        _js.dataModeEmit("table", obj.to_html(max_rows=200))
    elif isinstance(obj, pd.Series):
        _js.dataModeEmit("table", obj.to_frame().to_html(max_rows=200))
    elif hasattr(obj, "savefig"):
        _emit_image(obj)
    else:
        print(obj)

plt.show = lambda *a, **k: _capture_open_figures()
`;
  }

  // ---- 5. Pyodide + package lazy loading ----
  let pyodideInstance = null;
  let pyodideLoadingPromise = null;

  function setDataEngineStatus(html) {
    const el = document.getElementById('dataEngineStatus');
    if (el) el.innerHTML = html;
  }

  // Reuse the pyodide.js loader script if some other mode already added it —
  // otherwise inject it. Either way, calling loadPyodide() below creates a
  // fresh, independent runtime instance for this mode.
  function loadPyodideScript() {
    return new Promise((resolve, reject) => {
      if (typeof window.loadPyodide === 'function') { resolve(); return; }
      const script = document.createElement('script');
      script.dataset.pyodideDataLoader = 'true';
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.3/full/pyodide.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load pyodide.js'));
      document.head.appendChild(script);
    });
  }

  function ensureDataEngineLoaded() {
    if (pyodideInstance || pyodideLoadingPromise) return pyodideLoadingPromise;

    setDataEngineStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Loading Python runtime… (first time only)');
    const runBtn = document.getElementById('dataRunBtn');
    if (runBtn) runBtn.disabled = true;

    pyodideLoadingPromise = (async () => {
      try {
        await loadPyodideScript();
        const instance = await loadPyodide();

        setDataEngineStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Loading NumPy, pandas &amp; Matplotlib…');
        await instance.loadPackage(['numpy', 'pandas', 'matplotlib', 'scipy']);

        setDataEngineStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Installing Seaborn…');
        await instance.loadPackage('micropip');
        const micropip = instance.pyimport('micropip');
        await micropip.install('seaborn');

        setDataEngineStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Setting up plotting…');
        await instance.runPythonAsync(buildBootstrapPy(SAMPLE_CSV));

        instance.setStdout({ batched: (s) => appendDataOutput('stdout', s) });
        instance.setStderr({ batched: (s) => appendDataOutput('error', s) });

        pyodideInstance = instance;
        setDataEngineStatus('<i class="fa-solid fa-circle-check"></i> Engine ready (NumPy, pandas, Matplotlib, Seaborn)');
        if (runBtn) runBtn.disabled = false;
        return instance;
      } catch (err) {
        setDataEngineStatus('<i class="fa-solid fa-triangle-exclamation"></i> Failed to start data engine — click Run to retry');
        appendDataOutput('error', 'Could not start the data analysis engine: ' + (err && err.message ? err.message : err));
        // Reset the guard so the next Run click retries instead of reusing this failure forever.
        pyodideInstance = null;
        pyodideLoadingPromise = null;
        if (runBtn) runBtn.disabled = false;
        throw err;
      }
    })();

    return pyodideLoadingPromise;
  }

  window.resetSampleData = async function resetSampleData() {
    if (!pyodideInstance) {
      showNotification && showNotification('Data engine is still loading…');
      return;
    }
    try {
      await pyodideInstance.runPythonAsync('df = _load_sample()');
      showNotification && showNotification('Sample dataset (df) reset');
    } catch (err) {
      showNotification && showNotification('Could not reset dataset: ' + (err && err.message ? err.message : err), true);
    }
  };

  // ---- 6. Output console (mixed text + image + table stream) ----
  const dataOutputEl = document.getElementById('dataOutput');

  function appendDataOutput(kind, payload) {
    if (dataOutputEl.querySelector('.console-empty')) {
      dataOutputEl.innerHTML = '';
    }

    if (kind === 'stdout' || kind === 'error') {
      const entry = document.createElement('div');
      entry.className = `console-entry ${kind === 'error' ? 'error' : 'log'}`;
      if (kind === 'error') {
        // Keep a clear visual marker only for errors — plain print() output
        // should read like a normal terminal, without a leading icon on
        // every line.
        entry.innerHTML = `<span class="console-entry-icon"><i class="fa-solid fa-circle-xmark"></i></span><span class="console-entry-body"></span>`;
      } else {
        entry.innerHTML = `<span class="console-entry-body"></span>`;
      }
      entry.querySelector('.console-entry-body').textContent = payload; // textContent: safe against injection
      dataOutputEl.appendChild(entry);
    } else if (kind === 'image') {
      const entry = document.createElement('div');
      entry.className = 'console-entry data-image-entry';
      const card = document.createElement('div');
      card.className = 'data-image-card';
      const img = document.createElement('img');
      img.src = `data:image/png;base64,${payload}`;
      img.alt = 'Plot output';
      const download = document.createElement('a');
      download.className = 'data-image-download';
      download.href = `data:image/png;base64,${payload}`;
      download.download = 'plot.png';
      download.title = 'Download image';
      download.innerHTML = '<i class="fa-solid fa-download"></i>';
      card.appendChild(img);
      card.appendChild(download);
      entry.appendChild(card);
      dataOutputEl.appendChild(entry);
    } else if (kind === 'table') {
      const entry = document.createElement('div');
      entry.className = 'console-entry data-table-entry';
      const wrapper = document.createElement('div');
      wrapper.className = 'data-table-wrapper';
      // payload is pandas-generated HTML (cell values HTML-escaped by
      // pandas' to_html() by default), produced entirely client-side by
      // the user's own sandboxed Pyodide run.
      wrapper.innerHTML = payload;
      entry.appendChild(wrapper);
      dataOutputEl.appendChild(entry);
    }

    dataOutputEl.scrollTop = dataOutputEl.scrollHeight;
  }

  // Bridge called from Python via `import js as _js; _js.dataModeEmit(...)`
  window.dataModeEmit = function dataModeEmit(kind, payload) {
    appendDataOutput(kind, payload);
  };

  window.clearDataOutput = function clearDataOutput() {
    dataOutputEl.innerHTML = '<div class="console-empty">Output from <code>print()</code>, <code>show()</code>, and Matplotlib/Seaborn plots will show up here.</div>';
  };

  // ---- 7. Run ----
  let dataRunning = false;

  window.runDataAnalysis = async function runDataAnalysis() {
    if (dataRunning) return;
    const runBtn = document.getElementById('dataRunBtn');
    const hint = document.getElementById('dataStatusHint');

    try {
      dataRunning = true;
      if (runBtn) { runBtn.disabled = true; runBtn.classList.add('running'); }
      if (hint) hint.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Running…';

      const pyodide = await ensureDataEngineLoaded();
      clearDataOutput();

      try {
        await pyodide.loadPackagesFromImports(dataCode.value);
        await pyodide.runPythonAsync(dataCode.value);
        // Catch any figures the user created but didn't explicitly show.
        await pyodide.runPythonAsync('_capture_open_figures()');
        if (hint) hint.innerHTML = '<i class="fa-solid fa-circle-check"></i> Finished';
      } catch (err) {
        appendDataOutput('error', String(err.message || err));
        if (hint) hint.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Finished with errors';
      }
    } catch (err) {
      // ensureDataEngineLoaded already reported this to the output panel
      if (hint) hint.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Data engine unavailable — try Run again';
    } finally {
      dataRunning = false;
      if (runBtn) { runBtn.disabled = false; runBtn.classList.remove('running'); }
    }
  };

  // ---- 8. Wire up find & replace (shared logic from script.js) ----
  document.addEventListener('DOMContentLoaded', () => {
    setupSimpleFindBar('findBarData', dataCode, () => dataEditorHandle);
  });

  // ---- 9. Hook for the shared mode-switcher in script.js ----
  // switchMode('data') calls this if it's defined, so the engine starts
  // loading and the editor re-syncs its layout as soon as the tab opens.
  window.onDataModeActivated = function onDataModeActivated() {
    ensureDataEngineLoaded();
    dataEditorHandle && dataEditorHandle.refresh();
  };
})();