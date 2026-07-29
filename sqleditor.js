// ===================================================================
// SQL Mode — self-contained module
// Contains everything specific to SQL mode: its panel markup, its
// mode-exclusive CSS (result table, schema cards), and all of its JS
// logic (sql.js loading, running queries, schema view, find & replace).
//
// Depends on shared/universal code from script.js:
//   updateLineNumbers, setupSimpleEditor, setupSimpleFindBar,
//   closeFindReplace, showNotification, copyCode, setUnsavedState
// ===================================================================

(function () {
  // ---- 1. Inject this mode's markup into the placeholder left in index.html ----
  const SQL_MODE_HTML = `
    <div class="container">
      <div class="panel" id="sqlPanel">
        <div class="top-bar">
          <div class="file-label">
            <i class="fa-solid fa-database" style="color:#4fc3f7; margin-right:8px;" aria-hidden="true"></i>
            query.sql
          </div>
          <div class="button-group">
            <button type="button" class="icon-btn" onclick="clearSQLCode()" title="Clear Code">
              <i class="fa-solid fa-trash icon"></i>
              <span class="btn-text">Clear</span>
            </button>
            <button type="button" class="icon-btn" onclick="toggleSimpleFindBar('findBarSql')" title="Find &amp; Replace (Ctrl+F)">
              <i class="fa-solid fa-magnifying-glass icon"></i>
              <span class="btn-text">Find</span>
            </button>
            <button type="button" class="copy" onclick="copyCode()" title="Copy Code">
              <i class="fa-solid fa-copy icon" style="margin-right: 6px;"></i>
              Copy
            </button>
            <button type="button" class="run-btn" id="sqlRunBtn" onclick="runSQL()" title="Run SQL (Ctrl+Enter)">
              <i class="fa-solid fa-play icon" style="margin-right: 6px;"></i>
              Run
            </button>
          </div>
        </div>

        <div class="find-bar" id="findBarSql" hidden>
          <i class="fa-solid fa-magnifying-glass find-icon" aria-hidden="true"></i>
          <input type="text" class="find-input find-input-sql" placeholder="Find" autocomplete="off" spellcheck="false">
          <span class="find-count">0/0</span>
          <button type="button" class="find-btn find-prev-btn" title="Previous match (Shift+Enter)"><i class="fa-solid fa-chevron-up"></i></button>
          <button type="button" class="find-btn find-next-btn" title="Next match (Enter)"><i class="fa-solid fa-chevron-down"></i></button>
          <span class="find-divider"></span>
          <input type="text" class="find-input find-replace-input" placeholder="Replace" autocomplete="off" spellcheck="false">
          <button type="button" class="find-btn find-text-btn find-replace-one-btn">Replace</button>
          <button type="button" class="find-btn find-text-btn find-replace-all-btn">All</button>
          <button type="button" class="find-btn find-close find-close-sql" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="editor-container">
          <div class="line-numbers" id="sql-line-numbers">1</div>
          <div class="code-block active" id="sql-block">
            <div class="active-line-bg" id="sql-active-line"></div>
            <textarea id="sql-code" class="editor" spellcheck="false" inputmode="text" autocomplete="off" placeholder="-- Write your SQL here"></textarea>
          </div>
        </div>
      </div>

      <div class="resizer" id="dragbarSql" aria-hidden="true"></div>

      <div class="output-panel" id="sqlOutputPanel">
        <div class="top-bar">
          <div class="output-tabs" role="tablist" aria-label="SQL output views">
            <button class="output-tab active" data-sqlview="result" role="tab" aria-selected="true" type="button">
              <i class="fa-solid fa-table" aria-hidden="true"></i> Result
            </button>
            <button class="output-tab" data-sqlview="schema" role="tab" aria-selected="false" type="button">
              <i class="fa-solid fa-sitemap" aria-hidden="true"></i> Schema
            </button>
          </div>
          <div class="button-group">
            <button class="clear" onclick="resetSQLDatabase()" title="Reset Database" type="button">
              <i class="fa-solid fa-arrows-rotate icon" style="margin-right: 6px;"></i>
              <span class="btn-text">Reset DB</span>
            </button>
          </div>
        </div>
        <div class="output-area sql-result-view" id="sqlResultView">
          <div class="console-empty" id="sqlResultEmpty">Run a query to see results here. A sample <code>employees</code> table is preloaded — try <code>SELECT * FROM employees;</code></div>
          <div class="sql-table-wrapper" id="sqlTableWrapper" hidden></div>
        </div>
        <div class="output-area sql-schema-view" id="sqlSchemaView" hidden>
          <div class="console-log-list" id="sqlSchemaList"></div>
        </div>
      </div>
    </div>
    <div class="status-bar">
      <div class="status-left">
        <div class="status-item"><span>Lines: </span><span id="sqlLineCount">1</span></div>
        <div class="status-item"><span>Characters: </span><span id="sqlCharCount">0</span></div>
      </div>
      <div class="status-right">
        <div class="status-item" id="sqlEngineStatus"><i class="fa-solid fa-circle-notch"></i> SQL engine not loaded yet</div>
      </div>
    </div>
  `;

  const panel = document.getElementById('sqlModePanel');
  if (panel) panel.innerHTML = SQL_MODE_HTML;

  // ---- 2. Inject this mode's exclusive CSS ----
  const SQL_MODE_CSS = `
    #sqlEngineStatus .fa-circle-notch { animation: spin 1s linear infinite; }
    #sqlEngineStatus .fa-circle-check { color: #10b981; }
    #sqlEngineStatus .fa-triangle-exclamation { color: #f59e0b; }

    .sql-result-view {
      display: flex;
      flex-direction: column;
      overflow: auto;
      padding: 0;
    }

    .sql-row-count {
      padding: 8px 14px;
      font-size: 12px;
      color: var(--text-secondary-dark);
      border-bottom: 1px solid var(--border-dark);
      flex-shrink: 0;
    }

    .sql-table-wrapper {
      overflow: auto;
      flex: 1;
    }

    .sql-table {
      border-collapse: collapse;
      width: 100%;
      font-family: 'Monaco', 'Cascadia Code', 'Courier New', monospace;
      font-size: 13px;
    }

    .sql-table th {
      position: sticky;
      top: 0;
      background-color: var(--bg-tertiary-dark);
      color: var(--primary-color);
      text-align: left;
      padding: 8px 14px;
      border-bottom: 2px solid var(--border-dark);
      white-space: nowrap;
      font-weight: 700;
    }

    .sql-table td {
      padding: 7px 14px;
      border-bottom: 1px solid var(--border-dark);
      color: var(--text-dark);
      white-space: nowrap;
    }

    .sql-table tbody tr:hover {
      background-color: rgba(59, 130, 246, 0.06);
    }

    .sql-null {
      color: var(--text-secondary-dark);
      font-style: italic;
    }

    .schema-table-card {
      margin: 10px 14px;
      background: var(--bg-tertiary-dark);
      border: 1px solid var(--border-dark);
      border-radius: 8px;
      overflow: hidden;
    }

    .schema-table-name {
      padding: 8px 12px;
      font-weight: 600;
      font-size: 13px;
      color: var(--primary-color);
      border-bottom: 1px solid var(--border-dark);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .schema-table-sql {
      margin: 0;
      padding: 10px 12px;
      font-family: 'Monaco', 'Cascadia Code', 'Courier New', monospace;
      font-size: 12px;
      color: var(--text-secondary-dark);
      white-space: pre-wrap;
      word-break: break-word;
    }
  `;
  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-mode-styles', 'sql');
  styleTag.textContent = SQL_MODE_CSS;
  document.head.appendChild(styleTag);

  // ---- 3. SQL Editor Setup ----
  const sqlCode = document.getElementById('sql-code');
  const sqlLineNumbers = document.getElementById('sql-line-numbers');
  const sqlActiveLine = document.getElementById('sql-active-line');
  const sqlLineCountEl = document.getElementById('sqlLineCount');
  const sqlCharCountEl = document.getElementById('sqlCharCount');

  const SQL_SAMPLE_QUERY = window.SQL_SAMPLE_QUERY = `SELECT * FROM employees\nORDER BY salary DESC;`;

  let sqlEditorHandle = null;
  if (sqlCode) {
    sqlCode.value = SQL_SAMPLE_QUERY;
    sqlEditorHandle = window.sqlEditorHandle = setupSimpleEditor({
      textarea: sqlCode,
      lineNumbers: sqlLineNumbers,
      activeLineEl: sqlActiveLine,
      onRun: () => runSQL(),
      onInput: () => {
        sqlLineCountEl.textContent = sqlCode.value.split('\n').length;
        sqlCharCountEl.textContent = sqlCode.value.length;
        if (typeof setUnsavedState === 'function') setUnsavedState(true);
      }
    });
    sqlLineCountEl.textContent = sqlCode.value.split('\n').length;
    sqlCharCountEl.textContent = sqlCode.value.length;
  }

  // Clear the SQL code editor (with confirmation)
  window.clearSQLCode = function clearSQLCode() {
    if (!sqlCode.value) {
      showNotification && showNotification('Already empty');
      return;
    }
    if (!confirm('Clear all SQL code? This cannot be undone.')) return;
    sqlCode.value = '';
    sqlCode.dispatchEvent(new Event('input'));
    showNotification && showNotification('SQL code cleared');
  };

  // ---- 4. sql.js (SQLite-in-the-browser) lazy loading ----
  let sqlJsInstance = null;
  let sqlDb = null;
  let sqlJsLoadingPromise = null;

  const SEED_SQL = `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  salary REAL,
  hired_on TEXT
);

INSERT INTO employees (name, department, salary, hired_on) VALUES
  ('Ava Patel', 'Engineering', 95000, '2021-03-14'),
  ('Liam Chen', 'Engineering', 88000, '2022-07-01'),
  ('Sofia Rossi', 'Design', 78000, '2020-11-23'),
  ('Noah Kim', 'Sales', 65000, '2023-01-09'),
  ('Maya Singh', 'Engineering', 102000, '2019-06-18'),
  ('Ethan Brooks', 'Marketing', 72000, '2022-02-27');
`;

  function setSqlEngineStatus(html) {
    const el = document.getElementById('sqlEngineStatus');
    if (el) el.innerHTML = html;
  }

  function ensureSqlJsLoaded() {
    if (sqlDb || sqlJsLoadingPromise) return sqlJsLoadingPromise;

    setSqlEngineStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Loading SQL engine… (first time only)');
    const runBtn = document.getElementById('sqlRunBtn');
    if (runBtn) runBtn.disabled = true;

    sqlJsLoadingPromise = new Promise((resolve, reject) => {
      document.querySelectorAll('script[data-sqljs-loader]').forEach(s => s.remove());

      const script = document.createElement('script');
      script.dataset.sqljsLoader = 'true';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js';
      script.onload = async () => {
        try {
          sqlJsInstance = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`
          });
          sqlDb = new sqlJsInstance.Database();
          sqlDb.run(SEED_SQL);
          setSqlEngineStatus('<i class="fa-solid fa-circle-check"></i> SQLite ready');
          if (runBtn) runBtn.disabled = false;
          renderSqlSchema();
          resolve(sqlDb);
        } catch (err) {
          setSqlEngineStatus('<i class="fa-solid fa-triangle-exclamation"></i> Failed to start SQL engine — click Run to retry');
          sqlDb = null;
          sqlJsLoadingPromise = null;
          if (runBtn) runBtn.disabled = false;
          resolve(null);
        }
      };
      script.onerror = () => {
        setSqlEngineStatus('<i class="fa-solid fa-triangle-exclamation"></i> Could not load SQL engine — click Run to retry');
        sqlDb = null;
        sqlJsLoadingPromise = null;
        if (runBtn) runBtn.disabled = false;
        reject(new Error('Failed to load sql-wasm.js'));
      };
      document.head.appendChild(script);
    });

    return sqlJsLoadingPromise;
  }

  window.resetSQLDatabase = function resetSQLDatabase() {
    if (!sqlDb) {
      showNotification && showNotification('SQL engine is still loading…');
      return;
    }
    sqlDb.close();
    sqlDb = new sqlJsInstance.Database();
    sqlDb.run(SEED_SQL);
    renderSqlSchema();
    showSqlEmptyState('Database reset. A fresh sample employees table is ready.');
    showNotification && showNotification('Database reset to the sample dataset');
  };

  function showSqlEmptyState(message) {
    const empty = document.getElementById('sqlResultEmpty');
    const wrapper = document.getElementById('sqlTableWrapper');
    empty.hidden = false;
    empty.innerHTML = message;
    wrapper.hidden = true;
    wrapper.innerHTML = '';
  }

  function renderSqlSchema() {
    const list = document.getElementById('sqlSchemaList');
    if (!sqlDb) {
      list.innerHTML = '<div class="console-empty">SQL engine not loaded yet.</div>';
      return;
    }
    try {
      const res = sqlDb.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      if (!res.length || res[0].values.length === 0) {
        list.innerHTML = '<div class="console-empty">No tables yet. Use CREATE TABLE to add one.</div>';
        return;
      }
      list.innerHTML = res[0].values.map(([name, sql]) => {
        const escaped = (sql || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="schema-table-card">
          <div class="schema-table-name"><i class="fa-solid fa-table"></i> ${name}</div>
          <pre class="schema-table-sql">${escaped}</pre>
        </div>`;
      }).join('');
    } catch (e) {
      list.innerHTML = `<div class="console-empty">Could not read schema: ${e.message}</div>`;
    }
  }

  // ---- 5. Run SQL ----
  window.runSQL = function runSQL() {
    const runBtn = document.getElementById('sqlRunBtn');

    const execute = () => {
      if (!sqlDb) {
        showSqlEmptyState('SQL engine failed to load. Check your connection and reopen the SQL tab.');
        return;
      }

      const query = sqlCode.value.trim();
      if (!query) {
        showSqlEmptyState('Write a query above and hit Run.');
        return;
      }

      try {
        const results = sqlDb.exec(query);
        renderSqlSchema(); // schema may have changed (CREATE/DROP/ALTER)

        if (results.length === 0) {
          // Statement ran but returned no rows (INSERT/UPDATE/DELETE/CREATE etc.)
          const changes = sqlDb.getRowsModified();
          showSqlEmptyState(`Query executed successfully.${changes ? ` ${changes} row(s) affected.` : ''}`);
          showNotification && showNotification('Query executed');
          return;
        }

        renderSqlTable(results[0]);
      } catch (err) {
        showSqlEmptyState(`<span style="color:#f87171"><i class="fa-solid fa-circle-xmark"></i> ${err.message}</span>`);
      }
    };

    if (!sqlDb) {
      if (runBtn) runBtn.disabled = true;
      ensureSqlJsLoaded().then(() => {
        if (runBtn) runBtn.disabled = false;
        execute();
      }).catch(() => {
        if (runBtn) runBtn.disabled = false;
        showSqlEmptyState('Could not load the SQL engine. Check your connection and try again.');
      });
    } else {
      execute();
    }
  };

  function renderSqlTable(result) {
    const empty = document.getElementById('sqlResultEmpty');
    const wrapper = document.getElementById('sqlTableWrapper');
    empty.hidden = true;
    wrapper.hidden = false;

    const { columns, values } = result;
    const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = `<div class="sql-row-count">${values.length} row${values.length === 1 ? '' : 's'}</div>`;
    html += '<table class="sql-table"><thead><tr>';
    columns.forEach(col => { html += `<th>${escape(col)}</th>`; });
    html += '</tr></thead><tbody>';
    values.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        const display = cell === null ? '<span class="sql-null">NULL</span>' : escape(cell);
        html += `<td>${display}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    wrapper.innerHTML = html;
  }

  // ---- 6. Wire up output view tabs (Result / Schema) + find & replace ----
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#sqlOutputPanel .output-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.sqlview;
        document.querySelectorAll('#sqlOutputPanel .output-tab').forEach(t => {
          const active = t === tab;
          t.classList.toggle('active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.getElementById('sqlResultView').hidden = view !== 'result';
        document.getElementById('sqlSchemaView').hidden = view !== 'schema';
      });
    });

    setupSimpleFindBar('findBarSql', sqlCode, () => sqlEditorHandle);
  });

  // ---- 7. Hook for the shared mode-switcher in script.js ----
  window.onSqlModeActivated = function onSqlModeActivated() {
    ensureSqlJsLoaded();
    sqlEditorHandle && sqlEditorHandle.refresh();
  };
})();