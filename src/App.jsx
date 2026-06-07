import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileDown,
  History,
  Keyboard,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { CATEGORIES, CATEGORY_BY_ID } from "./data/categories.js";
import { seedRecords } from "./data/seed.js";
import { STATUSES, STATUS_BY_ID } from "./data/statuses.js";

const STORAGE_KEY = "progress-tracker-records-v2";

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function createId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function loadRecords() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) {
      return seedRecords;
    }

    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return seedRecords;
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const fileInputRef = useRef(null);

  const activeCategory = CATEGORY_BY_ID[activeCategoryId];
  const tableTemplate = activeCategory.fields.map((field) => field.width).join(" ");

  const categoryRecords = useMemo(
    () => records.filter((record) => record.categoryId === activeCategoryId),
    [records, activeCategoryId],
  );

  const visibleRecords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return categoryRecords.filter((record) => {
      const matchStatus = statusFilter === "all" || record.status === statusFilter;
      if (!keyword) {
        return matchStatus;
      }
      const haystack = [
        record.title,
        record.status,
        record.owner,
        record.currentProgress,
        record.nextAction,
        record.remarks,
      ]
        .join(" ")
        .toLowerCase();
      return matchStatus && haystack.includes(keyword);
    });
  }, [categoryRecords, searchTerm, statusFilter]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  );

  const categoryStats = useMemo(() => {
    return STATUSES.map((status) => ({
      ...status,
      count: categoryRecords.filter((record) => record.status === status.id).length,
    }));
  }, [categoryRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    if (categoryRecords.length === 0) {
      setSelectedId(null);
      return;
    }

    const selectedInCategory = categoryRecords.some((record) => record.id === selectedId);
    if (!selectedInCategory) {
      setSelectedId(categoryRecords[0].id);
    }
  }, [categoryRecords, selectedId]);

  useEffect(() => {
    function handleKeydown(event) {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']");

      if (isEditing) {
        return;
      }

      const category = CATEGORIES.find((item) => item.shortcut === event.key);
      if (category) {
        setActiveCategoryId(category.id);
        setStatusFilter("all");
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  function updateRecord(recordId, patch) {
    setRecords((current) =>
      current.map((record) =>
        record.id === recordId
          ? {
              ...record,
              ...patch,
            }
          : record,
      ),
    );
  }

  function addRecord() {
    const record = {
      id: createId(activeCategoryId),
      categoryId: activeCategoryId,
      title: `${activeCategory.name}新进程`,
      status: "开发中",
      startDate: today(),
      endDate: today(14),
      owner: "",
      currentProgress: "",
      nextAction: "",
      remarks: "",
      history: [
        {
          id: createId("history"),
          date: today(),
          status: "开发中",
          owner: "",
          summary: "创建进程记录",
        },
      ],
    };

    setRecords((current) => [record, ...current]);
    setSelectedId(record.id);
  }

  function deleteRecord(recordId) {
    setRecords((current) => current.filter((record) => record.id !== recordId));
  }

  function updateHistoryItem(recordId, historyId, patch) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        return {
          ...record,
          history: (record.history ?? []).map((entry) =>
            entry.id === historyId ? { ...entry, ...patch } : entry,
          ),
        };
      }),
    );
  }

  function addHistoryItem(recordId) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const entry = {
          id: createId("history"),
          date: today(),
          status: record.status,
          owner: record.owner,
          summary: "",
        };

        return {
          ...record,
          history: [...(record.history ?? []), entry],
        };
      }),
    );
  }

  function deleteHistoryItem(recordId, historyId) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        return {
          ...record,
          history: (record.history ?? []).filter((entry) => entry.id !== historyId),
        };
      }),
    );
  }

  function resetRecords() {
    setRecords(seedRecords);
    setSelectedId(null);
    setSearchTerm("");
    setStatusFilter("all");
  }

  function exportJson() {
    downloadBlob(
      "项目进度台账.json",
      JSON.stringify(records, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportCsv() {
    const rows = [
      [...activeCategory.fields.map((field) => field.label), "历史记录数"],
      ...categoryRecords.map((record) => [
        ...activeCategory.fields.map((field) => record[field.key]),
        record.history?.length ?? 0,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    downloadBlob(`${activeCategory.name}进度台账.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const nextRecords = Array.isArray(parsed) ? parsed : parsed.records;
        if (Array.isArray(nextRecords)) {
          setRecords(nextRecords);
          setSelectedId(null);
        }
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function renderCell(record, field) {
    if (field.type === "status") {
      const status = STATUS_BY_ID[record.status] ?? STATUSES[0];
      return (
        <select
          className="cell-input status-select"
          style={{
            "--status-bg": status.bg,
            "--status-color": status.color,
            "--status-border": status.border,
          }}
          value={record.status}
          onFocus={() => setSelectedId(record.id)}
          onChange={(event) => updateRecord(record.id, { status: event.target.value })}
          aria-label={`${record.title} 状态`}
        >
          {STATUSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "date") {
      return (
        <input
          className="cell-input"
          type="date"
          value={record[field.key] ?? ""}
          onFocus={() => setSelectedId(record.id)}
          onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
          aria-label={`${record.title} ${field.label}`}
        />
      );
    }

    return (
      <input
        className="cell-input"
        type="text"
        value={record[field.key] ?? ""}
        onFocus={() => setSelectedId(record.id)}
        onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
        aria-label={`${record.title} ${field.label}`}
      />
    );
  }

  function renderEditorField(record, field) {
    if (field.type === "status") {
      const status = STATUS_BY_ID[record.status] ?? STATUSES[0];
      return (
        <select
          className="form-control status-select"
          style={{
            "--status-bg": status.bg,
            "--status-color": status.color,
            "--status-border": status.border,
          }}
          value={record.status}
          onChange={(event) => updateRecord(record.id, { status: event.target.value })}
        >
          {STATUSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "date") {
      return (
        <input
          className="form-control"
          type="date"
          value={record[field.key] ?? ""}
          onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
        />
      );
    }

    if (field.key === "currentProgress" || field.key === "nextAction" || field.key === "remarks") {
      return (
        <textarea
          className="form-control textarea"
          value={record[field.key] ?? ""}
          onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
        />
      );
    }

    return (
      <input
        className="form-control"
        type="text"
        value={record[field.key] ?? ""}
        onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
      />
    );
  }

  return (
    <div className="app-shell" style={{ "--category-accent": activeCategory.accent }}>
      <header className="topbar">
        <div>
          <h1>项目进度台账</h1>
          <div className="shortcut-hint">
            <Keyboard size={15} />
            <span>按 1 / 2 / 3 / 4 切换类别</span>
          </div>
        </div>

        <nav className="category-tabs" aria-label="类别切换">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`category-tab ${category.id === activeCategoryId ? "active" : ""}`}
              style={{
                "--tab-accent": category.accent,
                "--tab-tint": category.tint,
              }}
              type="button"
              onClick={() => {
                setActiveCategoryId(category.id);
                setStatusFilter("all");
              }}
            >
              <span className="shortcut-key">{category.shortcut}</span>
              {category.name}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-area">
        <section className="workspace">
          <div className="toolbar">
            <label className="search-box">
              <Search size={17} />
              <input
                type="search"
                placeholder="搜索进程、负责人、进度"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="状态筛选"
            >
              <option value="all">全部状态</option>
              {STATUSES.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>

            <button className="icon-button primary" type="button" onClick={addRecord} title="新增进程">
              <Plus size={18} />
              <span>新增</span>
            </button>

            <button className="icon-button" type="button" onClick={exportCsv} title="导出当前类别 CSV">
              <FileDown size={18} />
              <span>CSV</span>
            </button>

            <button className="icon-button" type="button" onClick={exportJson} title="导出 JSON">
              <Download size={18} />
              <span>JSON</span>
            </button>

            <button
              className="icon-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="导入 JSON"
            >
              <Upload size={18} />
              <span>导入</span>
            </button>

            <button className="icon-button muted" type="button" onClick={resetRecords} title="恢复默认数据">
              <RotateCcw size={18} />
              <span>重置</span>
            </button>

            <input
              ref={fileInputRef}
              className="hidden-input"
              type="file"
              accept="application/json,.json"
              onChange={importJson}
            />
          </div>

          <div className="status-strip">
            {categoryStats.map((status) => (
              <button
                key={status.id}
                type="button"
                className={`status-chip ${statusFilter === status.id ? "selected" : ""}`}
                style={{
                  "--status-bg": status.bg,
                  "--status-color": status.color,
                  "--status-border": status.border,
                }}
                onClick={() => setStatusFilter(statusFilter === status.id ? "all" : status.id)}
              >
                <span>{status.label}</span>
                <strong>{status.count}</strong>
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <div className="table-grid header-row" style={{ gridTemplateColumns: tableTemplate }}>
              {activeCategory.fields.map((field, index) => (
                <div key={field.key} className="table-head">
                  {index + 1}. {field.label}
                </div>
              ))}
            </div>

            <div className="table-body">
              {visibleRecords.map((record) => (
                <div
                  key={record.id}
                  className={`table-grid data-row ${record.id === selectedId ? "selected" : ""}`}
                  style={{ gridTemplateColumns: tableTemplate }}
                  onClick={() => setSelectedId(record.id)}
                >
                  {activeCategory.fields.map((field) => (
                    <div key={field.key} className="table-cell">
                      {renderCell(record, field)}
                    </div>
                  ))}
                </div>
              ))}

              {visibleRecords.length === 0 && (
                <div className="empty-state">当前筛选条件下没有进程记录</div>
              )}
            </div>
          </div>
        </section>

        <aside className="editor-panel">
          {selectedRecord ? (
            <>
              <div className="editor-header">
                <div>
                  <p>{activeCategory.name}进程</p>
                  <h2>{selectedRecord.title || "未命名进程"}</h2>
                </div>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => deleteRecord(selectedRecord.id)}
                  title="删除当前进程"
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="editor-form">
                {activeCategory.fields.map((field) => (
                  <label
                    key={field.key}
                    className={`form-field ${
                      field.key === "currentProgress" ||
                      field.key === "nextAction" ||
                      field.key === "remarks"
                        ? "wide"
                        : ""
                    }`}
                  >
                    <span>{field.label}</span>
                    {renderEditorField(selectedRecord, field)}
                  </label>
                ))}
              </div>

              <section className="history-section">
                <div className="section-title">
                  <History size={18} />
                  <h3>历史记录</h3>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => addHistoryItem(selectedRecord.id)}
                  >
                    <Plus size={16} />
                    添加
                  </button>
                </div>

                <div className="history-list">
                  {(selectedRecord.history ?? []).map((entry) => {
                    const status = STATUS_BY_ID[entry.status] ?? STATUSES[0];
                    return (
                      <div key={entry.id} className="history-item">
                        <input
                          className="form-control"
                          type="date"
                          value={entry.date ?? ""}
                          onChange={(event) =>
                            updateHistoryItem(selectedRecord.id, entry.id, {
                              date: event.target.value,
                            })
                          }
                          aria-label="历史日期"
                        />
                        <select
                          className="form-control status-select"
                          style={{
                            "--status-bg": status.bg,
                            "--status-color": status.color,
                            "--status-border": status.border,
                          }}
                          value={entry.status}
                          onChange={(event) =>
                            updateHistoryItem(selectedRecord.id, entry.id, {
                              status: event.target.value,
                            })
                          }
                          aria-label="历史状态"
                        >
                          {STATUSES.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="form-control"
                          type="text"
                          value={entry.owner ?? ""}
                          onChange={(event) =>
                            updateHistoryItem(selectedRecord.id, entry.id, {
                              owner: event.target.value,
                            })
                          }
                          placeholder="负责人"
                          aria-label="历史负责人"
                        />
                        <textarea
                          className="form-control textarea history-summary"
                          value={entry.summary ?? ""}
                          onChange={(event) =>
                            updateHistoryItem(selectedRecord.id, entry.id, {
                              summary: event.target.value,
                            })
                          }
                          placeholder="进展说明"
                          aria-label="历史进展说明"
                        />
                        <button
                          className="danger-button small"
                          type="button"
                          onClick={() => deleteHistoryItem(selectedRecord.id, entry.id)}
                          title="删除历史记录"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}

                  {(selectedRecord.history ?? []).length === 0 && (
                    <div className="empty-history">暂无历史记录</div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="editor-empty">选择或新增一条进程后编辑</div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
