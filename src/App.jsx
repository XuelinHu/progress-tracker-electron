import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Download,
  ExternalLink,
  FileDown,
  Keyboard,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import DateHistoryField from "./components/DateHistoryField.jsx";
import KnowledgeGraph from "./components/KnowledgeGraph.jsx";
import { CATEGORIES, CATEGORY_BY_ID } from "./data/categories.js";
import { seedRecords } from "./data/seed.js";
import { STATUSES, STATUS_BY_ID } from "./data/statuses.js";

const STORAGE_KEY = "progress-tracker-records-v7";
const GRAPH_STORAGE_KEY = "progress-tracker-graph-v2";
const STATUS_ORDER = new Map(STATUSES.map((status, index) => [status.id, index]));
const GRAPH_CATEGORY = {
  id: "graph",
  name: "知识图谱",
  shortcut: "5",
  accent: "#0891b2",
  tint: "#cffafe",
};
const NAVIGATION_ITEMS = [...CATEGORIES, GRAPH_CATEGORY];

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function createId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeRecord(record) {
  return {
    ...record,
    history: Array.isArray(record.history) ? record.history : [],
    dateHistory:
      record.dateHistory && typeof record.dateHistory === "object"
        ? record.dateHistory
        : {},
  };
}

function loadRecords() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) {
      return seedRecords;
    }

    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeRecord);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return seedRecords.map(normalizeRecord);
}

function loadGraph() {
  try {
    const cached = localStorage.getItem(GRAPH_STORAGE_KEY);
    if (!cached) {
      return { nodes: [], edges: [] };
    }

    const parsed = JSON.parse(cached);
    return {
      nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
    };
  } catch {
    localStorage.removeItem(GRAPH_STORAGE_KEY);
    return { nodes: [], edges: [] };
  }
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

function getRecordTitle(record) {
  return record.title?.trim() || "未命名记录";
}

function normalizeExternalUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function estimateTextRows(value) {
  const text = String(value ?? "");
  const explicitRows = text.split(/\r\n|\r|\n/).length;
  const inferredRows = Math.ceil(text.length / 42);
  return Math.min(5, Math.max(2, explicitRows, inferredRows));
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusSortDirection, setStatusSortDirection] = useState("none");
  const [initialGraph] = useState(loadGraph);
  const [graphNodes, setGraphNodes] = useState(initialGraph.nodes);
  const [graphEdges, setGraphEdges] = useState(initialGraph.edges);
  const fileInputRef = useRef(null);

  const isGraphView = activeCategoryId === GRAPH_CATEGORY.id;
  const activeCategory = CATEGORY_BY_ID[activeCategoryId] ?? CATEGORIES[0];
  const activeNavigationItem = isGraphView ? GRAPH_CATEGORY : activeCategory;
  const tableTemplate = ["34px", ...activeCategory.fields.map((field) => field.width)].join(" ");

  const categoryRecords = useMemo(
    () => records.filter((record) => record.categoryId === activeCategoryId),
    [records, activeCategoryId],
  );

  const visibleRecords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const filteredRecords = categoryRecords.filter((record) => {
      const matchStatus = statusFilter === "all" || record.status === statusFilter;
      if (!keyword) {
        return matchStatus;
      }
      const haystack = [
        ...activeCategory.fields.map((field) => record[field.key]),
        ...Object.values(record.dateHistory ?? {}).flatMap((entries) =>
          (entries ?? []).flatMap((entry) => [entry.date, entry.item]),
        ),
        ...(record.history ?? []).flatMap((entry) => [
          entry.date,
          entry.status,
          entry.owner,
          entry.summary,
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return matchStatus && haystack.includes(keyword);
    });

    if (statusSortDirection === "none") {
      return filteredRecords;
    }

    return [...filteredRecords].sort((left, right) => {
      const leftOrder = STATUS_ORDER.get(left.status) ?? STATUSES.length;
      const rightOrder = STATUS_ORDER.get(right.status) ?? STATUSES.length;
      const orderDiff =
        leftOrder - rightOrder ||
        String(left.status ?? "").localeCompare(String(right.status ?? ""), "zh-Hans-CN") ||
        String(left.title ?? "").localeCompare(String(right.title ?? ""), "zh-Hans-CN");

      return statusSortDirection === "asc" ? orderDiff : -orderDiff;
    });
  }, [activeCategory.fields, categoryRecords, searchTerm, statusFilter, statusSortDirection]);

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
    localStorage.setItem(
      GRAPH_STORAGE_KEY,
      JSON.stringify({
        nodes: graphNodes,
        edges: graphEdges,
      }),
    );
  }, [graphEdges, graphNodes]);

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

      const category = NAVIGATION_ITEMS.find((item) => item.shortcut === event.key);
      if (category) {
        setActiveCategoryId(category.id);
        setStatusFilter("all");
        setStatusSortDirection("none");
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

  function updateRecordDate(recordId, fieldKey, date, item) {
    const historyId = createId("date-history");
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const dateHistory = record.dateHistory ?? {};
        return {
          ...record,
          [fieldKey]: date,
          dateHistory: {
            ...dateHistory,
            [fieldKey]: [
              ...(dateHistory[fieldKey] ?? []),
              {
                id: historyId,
                date,
                item,
              },
            ],
          },
        };
      }),
    );
    return historyId;
  }

  function updateDateHistoryItem(recordId, fieldKey, historyId, item) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const dateHistory = record.dateHistory ?? {};
        return {
          ...record,
          dateHistory: {
            ...dateHistory,
            [fieldKey]: (dateHistory[fieldKey] ?? []).map((entry) =>
              entry.id === historyId ? { ...entry, item } : entry,
            ),
          },
        };
      }),
    );
  }

  function addRecord() {
    const defaultStatus = STATUSES[0]?.id ?? "进行中";
    const record = activeCategory.fields.reduce(
      (draft, field) => {
        if (field.key === "status") {
          draft.status = defaultStatus;
          return draft;
        }

        if (field.type === "date") {
          draft[field.key] = today();
          return draft;
        }

        draft[field.key] = field.key === "title" ? `${activeCategory.name}新记录` : "";
        return draft;
      },
      {
        id: createId(activeCategoryId),
        categoryId: activeCategoryId,
        dateHistory: {},
        history: [
          {
            id: createId("history"),
            date: today(),
            status: defaultStatus,
            owner: "",
            summary: "创建记录",
          },
        ],
      },
    );

    setRecords((current) => [record, ...current]);
    setSelectedId(record.id);
  }

  function deleteRecord(recordId) {
    setRecords((current) => current.filter((record) => record.id !== recordId));
    const removedNodeIds = new Set(
      graphNodes
        .filter((node) => node.data.recordId === recordId)
        .map((node) => node.id),
    );
    if (removedNodeIds.size > 0) {
      setGraphNodes((current) =>
        current.filter((node) => !removedNodeIds.has(node.id)),
      );
      setGraphEdges((current) =>
        current.filter(
          (edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
        ),
      );
    }
  }

  function cycleStatusSort() {
    setStatusSortDirection((current) => {
      if (current === "none") {
        return "asc";
      }
      if (current === "asc") {
        return "desc";
      }
      return "none";
    });
  }

  async function openExternalUrl(value) {
    const url = normalizeExternalUrl(value);
    if (!url) {
      return;
    }

    const openExternal = window.desktopApp?.openExternal;
    if (openExternal) {
      try {
        const opened = await openExternal(url);
        if (opened) {
          return;
        }
      } catch {
        // Browser preview does not expose the Electron bridge.
      }
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function resetRecords() {
    setRecords(seedRecords.map(normalizeRecord));
    setGraphNodes([]);
    setGraphEdges([]);
    setSelectedId(null);
    setSearchTerm("");
    setStatusFilter("all");
    setStatusSortDirection("none");
  }

  function exportJson() {
    downloadBlob(
      "项目进度台账-全部数据.json",
      JSON.stringify(
        {
          version: 3,
          records,
          graph: {
            nodes: graphNodes,
            edges: graphEdges,
          },
        },
        null,
        2,
      ),
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
          setRecords(nextRecords.map(normalizeRecord));
          setSelectedId(null);
        }
        if (!Array.isArray(parsed) && parsed.graph) {
          setGraphNodes(Array.isArray(parsed.graph.nodes) ? parsed.graph.nodes : []);
          setGraphEdges(Array.isArray(parsed.graph.edges) ? parsed.graph.edges : []);
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
          aria-label={`${getRecordTitle(record)} 状态`}
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
        <DateHistoryField
          value={record[field.key] ?? ""}
          history={record.dateHistory?.[field.key] ?? []}
          label={`${getRecordTitle(record)} ${field.label}`}
          resetKey={`${record.id}-${field.key}`}
          inputClassName="cell-input date-input"
          itemClassName="cell-input date-item-input"
          onFocus={() => setSelectedId(record.id)}
          onDateChange={(date, item) =>
            updateRecordDate(record.id, field.key, date, item)
          }
          onHistoryItemChange={(historyId, item) =>
            updateDateHistoryItem(record.id, field.key, historyId, item)
          }
        />
      );
    }

    if (field.type === "url") {
      const externalUrl = normalizeExternalUrl(record[field.key]);
      return (
        <div className="url-cell">
          <textarea
            className="cell-input cell-textarea"
            rows={estimateTextRows(record[field.key])}
            value={record[field.key] ?? ""}
            onFocus={() => setSelectedId(record.id)}
            onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
            aria-label={`${getRecordTitle(record)} ${field.label}`}
          />
          <button
            className="url-open-button"
            type="button"
            disabled={!externalUrl}
            onClick={(event) => {
              event.stopPropagation();
              openExternalUrl(record[field.key]);
            }}
            title={externalUrl ? "用默认浏览器打开" : "没有可打开的网址"}
            aria-label={`打开 ${getRecordTitle(record)} ${field.label}`}
          >
            <ExternalLink size={13} />
          </button>
        </div>
      );
    }

    return (
      <textarea
        className="cell-input cell-textarea"
        rows={estimateTextRows(record[field.key])}
        value={record[field.key] ?? ""}
        onFocus={() => setSelectedId(record.id)}
        onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
        aria-label={`${getRecordTitle(record)} ${field.label}`}
      />
    );
  }

  const statusSortTitle =
    statusSortDirection === "asc"
      ? "状态升序，点击切换为降序"
      : statusSortDirection === "desc"
        ? "状态降序，点击取消排序"
        : "点击按状态排序";

  return (
    <div className="app-shell" style={{ "--category-accent": activeNavigationItem.accent }}>
      <header className="topbar">
        <div className="topbar-brand">
          <div>
            <h1>项目进度台账</h1>
            <div className="shortcut-hint">
              <Keyboard size={15} />
              <span>按 1 / 2 / 3 / 4 / 5 切换类别</span>
            </div>
          </div>

          <div className="global-data-actions">
            <button
              className="icon-button"
              type="button"
              onClick={exportJson}
              title="一键导出五个栏目的全部数据"
            >
              <Download size={17} />
              <span>导出全部 JSON</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="一键导入五个栏目的全部数据"
            >
              <Upload size={17} />
              <span>导入全部 JSON</span>
            </button>
            <input
              ref={fileInputRef}
              className="hidden-input"
              type="file"
              accept="application/json,.json"
              onChange={importJson}
            />
          </div>
        </div>

        <nav className="category-tabs" aria-label="类别切换">
          {NAVIGATION_ITEMS.map((category) => (
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
                setStatusSortDirection("none");
              }}
            >
              <span className="shortcut-key">{category.shortcut}</span>
              {category.id === GRAPH_CATEGORY.id && <Share2 size={15} />}
              {category.name}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-area">
        {isGraphView ? (
          <KnowledgeGraph
            records={records}
            updateRecord={updateRecord}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            setGraphNodes={setGraphNodes}
            setGraphEdges={setGraphEdges}
            openExternalUrl={openExternalUrl}
            updateRecordDate={updateRecordDate}
            updateDateHistoryItem={updateDateHistoryItem}
          />
        ) : (
        <section className="workspace">
          <div className="toolbar">
            <label className="search-box">
              <Search size={17} />
              <input
                type="search"
                placeholder="搜索名称、说明、路径、地址"
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

            <button className="icon-button primary" type="button" onClick={addRecord} title="新增记录">
              <Plus size={18} />
              <span>新增</span>
            </button>

            <button className="icon-button" type="button" onClick={exportCsv} title="导出当前类别 CSV">
              <FileDown size={18} />
              <span>CSV</span>
            </button>

            <button className="icon-button muted" type="button" onClick={resetRecords} title="恢复默认数据">
              <RotateCcw size={18} />
              <span>重置</span>
            </button>
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
              <div className="table-head action-head" aria-hidden="true" />
              {activeCategory.fields.map((field, index) => (
                <div key={field.key} className="table-head">
                  {field.type === "status" ? (
                    <button
                      className={`head-sort-button ${statusSortDirection !== "none" ? "active" : ""}`}
                      type="button"
                      onClick={cycleStatusSort}
                      title={statusSortTitle}
                      aria-label={statusSortTitle}
                    >
                      <span>
                        {index + 1}. {field.label}
                      </span>
                      <ArrowDownUp size={13} />
                    </button>
                  ) : (
                    <>
                      {index + 1}. {field.label}
                    </>
                  )}
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
                  <div className="table-cell row-action-cell">
                    <button
                      className="row-delete-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteRecord(record.id);
                      }}
                      title="删除这一行"
                      aria-label={`删除 ${getRecordTitle(record)}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {activeCategory.fields.map((field) => (
                    <div key={field.key} className="table-cell">
                      {renderCell(record, field)}
                    </div>
                  ))}
                </div>
              ))}

              {visibleRecords.length === 0 && (
                <div className="empty-state">当前筛选条件下没有记录</div>
              )}
            </div>
          </div>
        </section>
        )}
      </main>
    </div>
  );
}

export default App;
