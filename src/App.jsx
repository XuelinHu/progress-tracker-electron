import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Keyboard,
  Plus,
  RotateCcw,
  Search,
  Save,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import DateHistoryField from "./components/DateHistoryField.jsx";
import StatusHistoryPopover from "./components/StatusHistoryPopover.jsx";
import PortalPopover from "./components/PortalPopover.jsx";
import CopyIconButton from "./components/CopyIconButton.jsx";
import KnowledgeGraph from "./components/KnowledgeGraph.jsx";
import { CATEGORIES, CATEGORY_BY_ID } from "./data/categories.js";
import { seedRecords } from "./data/seed.js";
import { STATUSES } from "./data/statuses.js";

const STORAGE_KEY = "progress-tracker-records-v7";
const GRAPH_STORAGE_KEY = "progress-tracker-graph-v2";
const STATUS_CONFIG_STORAGE_KEY = "progress-tracker-status-config-v1";
const DEFAULT_MISSING_STAGE_DATE = "2026-06-01";
const GRAPH_CATEGORY = {
  id: "graph",
  name: "知识图谱",
  shortcut: "5",
  accent: "#0891b2",
  tint: "#cffafe",
};
const STATUS_CONFIG_PAGE = {
  id: "status-config",
  name: "优先级配置",
  shortcut: "6",
  accent: "#2563eb",
  tint: "#dbeafe",
};
const NAVIGATION_ITEMS = [...CATEGORIES, GRAPH_CATEGORY, STATUS_CONFIG_PAGE];

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function createId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeRecord(record) {
  const rawTodo = Array.isArray(record.todoHistory) ? record.todoHistory : [];
  const normalizedDate =
    record.categoryId === "contest"
      ? { registrationDate: record.registrationDate || DEFAULT_MISSING_STAGE_DATE }
      : { stageDate: record.stageDate || DEFAULT_MISSING_STAGE_DATE };
  return {
    ...record,
    ...normalizedDate,
    history: Array.isArray(record.history) ? record.history : [],
    dateHistory:
      record.dateHistory && typeof record.dateHistory === "object"
        ? record.dateHistory
        : {},
    todoHistory: rawTodo.map((e) => ({
      id: e.id,
      addedDate: e.addedDate || "",
      item: e.item || "",
      doneDate: e.doneDate || (!e.addedDate && e.date ? e.date : null),
    })),
  };
}

function mergeMissingSeedRecords(records) {
  const existingIds = new Set(records.map((record) => record.id));
  const missingRecords = seedRecords
    .filter((record) => !existingIds.has(record.id))
    .map(normalizeRecord);
  return [...records, ...missingRecords];
}

function loadRecords() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) {
      return seedRecords;
    }

    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) {
      return mergeMissingSeedRecords(parsed.map(normalizeRecord));
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return mergeMissingSeedRecords(seedRecords.map(normalizeRecord));
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

function normalizeStatusConfig(items) {
  const source = Array.isArray(items) && items.length > 0 ? items : STATUSES;
  const seenIds = new Set();
  const normalized = source
    .map((item, index) => {
      const label = String(item?.label ?? item?.id ?? "").trim();
      if (!label) {
        return null;
      }

      let id = String(item?.id ?? label).trim() || label;
      if (seenIds.has(id)) {
        id = `${id}-${index + 1}`;
      }
      seenIds.add(id);

      return {
        id,
        label,
        priority: Number.isFinite(Number(item?.priority))
          ? Number(item.priority)
          : (index + 1) * 10,
        color: item?.color || "#273449",
        bg: item?.bg || "#eef2ff",
        border: item?.border || "#c7d2fe",
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : STATUSES;
}

function sortStatusConfig(items) {
  return normalizeStatusConfig(items).sort(
    (left, right) =>
      left.priority - right.priority ||
      left.label.localeCompare(right.label, "zh-Hans-CN"),
  );
}

function loadStatusConfig() {
  try {
    const cached = localStorage.getItem(STATUS_CONFIG_STORAGE_KEY);
    if (!cached) {
      return sortStatusConfig(STATUSES);
    }

    return sortStatusConfig(JSON.parse(cached));
  } catch {
    localStorage.removeItem(STATUS_CONFIG_STORAGE_KEY);
    return sortStatusConfig(STATUSES);
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

function estimateTextRows(value, fieldKey = "") {
  const text = String(value ?? "");
  const charsPerLine =
    fieldKey === "title" ? 16 : fieldKey === "description" ? 18 : 42;
  const inferredRows = text
    .split(/\r\n|\r|\n/)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.max(2, inferredRows);
}

function daysFromToday(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today - d) / 86400000);
}

function DaysSince({ dateField, record }) {
  const key = dateField?.key;
  if (!key) return null;
  const val = record?.[key];
  const days = daysFromToday(val);
  return (
    <span className="row-days-since" title={val ? `阶段日期: ${val}` : "无阶段日期"}>
      {days > 0 ? `${days}d` : "0d"}
    </span>
  );
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusSortDirection, setStatusSortDirection] = useState("asc");
  const [initialGraph] = useState(loadGraph);
  const [graphNodes, setGraphNodes] = useState(initialGraph.nodes);
  const [graphEdges, setGraphEdges] = useState(initialGraph.edges);
  const fileInputRef = useRef(null);
  const [pageLoadTime, setPageLoadTime] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [statusOptions, setStatusOptions] = useState(loadStatusConfig);
  const [statusDraft, setStatusDraft] = useState(() => loadStatusConfig());
  const [statusConfigMessage, setStatusConfigMessage] = useState("");
  const [backupList, setBackupList] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);

  const isGraphView = activeCategoryId === GRAPH_CATEGORY.id;
  const isStatusConfigView = activeCategoryId === STATUS_CONFIG_PAGE.id;
  const activeCategory = CATEGORY_BY_ID[activeCategoryId] ?? CATEGORIES[0];
  const activeNavigationItem = isGraphView
    ? GRAPH_CATEGORY
    : isStatusConfigView
      ? STATUS_CONFIG_PAGE
      : activeCategory;
  const tableTemplate = ["58px", ...activeCategory.fields.map((field) => field.width)].join(" ");
  const statusById = useMemo(
    () => Object.fromEntries(statusOptions.map((status) => [status.id, status])),
    [statusOptions],
  );
  const statusPriority = useMemo(
    () => new Map(statusOptions.map((status) => [status.id, status.priority])),
    [statusOptions],
  );

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
      const leftOrder = statusPriority.get(left.status) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = statusPriority.get(right.status) ?? Number.MAX_SAFE_INTEGER;
      const orderDiff =
        leftOrder - rightOrder ||
        String(left.status ?? "").localeCompare(String(right.status ?? ""), "zh-Hans-CN") ||
        String(left.title ?? "").localeCompare(String(right.title ?? ""), "zh-Hans-CN");

      return statusSortDirection === "asc" ? orderDiff : -orderDiff;
    });
  }, [
    activeCategory.fields,
    categoryRecords,
    searchTerm,
    statusFilter,
    statusSortDirection,
    statusPriority,
  ]);

  const categoryStats = useMemo(() => {
    return statusOptions.map((status) => ({
      ...status,
      count: categoryRecords.filter((record) => record.status === status.id).length,
    }));
  }, [categoryRecords, statusOptions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(STATUS_CONFIG_STORAGE_KEY, JSON.stringify(statusOptions));
  }, [statusOptions]);

  useEffect(() => {
    if (statusFilter !== "all" && !statusOptions.some((status) => status.id === statusFilter)) {
      setStatusFilter("all");
    }
  }, [statusFilter, statusOptions]);

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
        setStatusSortDirection("asc");
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    setPageLoadTime(Date.now());
  }, []);

  useEffect(() => {
    loadBackupList();
  }, []);

  function updateRecord(recordId, patch) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const nextRecord = {
          ...record,
          ...patch,
        };
        if (patch.status && patch.status !== record.status) {
          const previousStatus =
            statusById[record.status]?.label || record.status || "未设置";
          const nextStatus = statusById[patch.status]?.label || patch.status;
          nextRecord.history = [
            ...(record.history ?? []),
            {
              id: createId("history"),
              date: today(),
              status: patch.status,
              owner: "",
              summary: `状态由"${previousStatus}"变更为"${nextStatus}"`,
            },
          ];
        }

        return nextRecord;
      }),
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

  function syncTodoItems(recordId, todoText) {
    const lines = (todoText ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const oldHistory = record.todoHistory ?? [];
        const oldById = new Map(oldHistory.map((e) => [e.item, e]));
        const nextHistory = lines.map((item) => {
          const existing = oldById.get(item);
          if (existing) return existing;
          return { id: createId("todo-hist"), addedDate: today(), item, doneDate: null };
        });
        return { ...record, todoHistory: nextHistory };
      }),
    );
  }

  function toggleTodoItem(recordId, lineText) {
    const text = lineText.trim();
    if (!text) return;
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const todoHistory = (record.todoHistory ?? []).map((e) =>
          e.item === text ? { ...e, doneDate: e.doneDate ? null : today() } : e,
        );
        return { ...record, todoHistory };
      }),
    );
  }

  function deleteTodoItem(recordId, lineText) {
    const text = lineText.trim();
    if (!text) return;
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const todoText = record.todo ?? "";
        const lines = todoText.split(/\r?\n/);
        const newText = lines.filter((l) => l.trim() !== text).join("\n");
        const todoHistory = (record.todoHistory ?? []).filter((e) => e.item !== text);
        return { ...record, todo: newText, todoHistory };
      }),
    );
  }

  function deleteDateHistoryItem(recordId, fieldKey, historyId) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const dateHistory = record.dateHistory ?? {};
        return {
          ...record,
          dateHistory: {
            ...dateHistory,
            [fieldKey]: (dateHistory[fieldKey] ?? []).filter((e) => e.id !== historyId),
          },
        };
      }),
    );
  }

  function deleteStatusHistoryItem(recordId, historyId) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        return { ...record, history: (record.history ?? []).filter((e) => e.id !== historyId) };
      }),
    );
  }

  function updateStatusHistoryItem(recordId, historyId, summary) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        return {
          ...record,
          history: (record.history ?? []).map((entry) =>
            entry.id === historyId ? { ...entry, summary } : entry,
          ),
        };
      }),
    );
  }

  function deleteTodoHistoryItem(recordId, historyId) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        return { ...record, todoHistory: (record.todoHistory ?? []).filter((e) => e.id !== historyId) };
      }),
    );
  }

  function updateTodoHistoryItem(recordId, historyId, item) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const target = (record.todoHistory ?? []).find((entry) => entry.id === historyId);
        const oldItem = target?.item ?? "";
        const todo = oldItem
          ? (record.todo ?? "")
              .split(/\r?\n/)
              .map((line) => (line.trim() === oldItem ? item : line))
              .join("\n")
          : record.todo;
        return {
          ...record,
          todo,
          todoHistory: (record.todoHistory ?? []).map((entry) =>
            entry.id === historyId ? { ...entry, item } : entry,
          ),
        };
      }),
    );
  }

  function buildRecord(categoryId) {
    const category = CATEGORY_BY_ID[categoryId] ?? CATEGORIES[0];
    const defaultStatus = statusOptions[0]?.id ?? "进行中";
    return category.fields.reduce(
      (draft, field) => {
        if (field.key === "status") {
          draft.status = defaultStatus;
          return draft;
        }

        if (field.type === "date") {
          draft[field.key] = today();
          return draft;
        }

        draft[field.key] = field.key === "title" ? `${category.name}新记录` : "";
        return draft;
      },
      {
        id: createId(categoryId),
        categoryId,
        dateHistory: {},
        history: [
          {
            id: createId("history"),
            date: today(),
            status: defaultStatus,
            owner: "",
            summary: `新建科研元素：${category.name}新记录`,
          },
        ],
      },
    );
  }

  function addRecord() {
    const record = buildRecord(activeCategoryId);
    setRecords((current) => [record, ...current]);
    setSelectedId(record.id);
  }

  function duplicateRecord(sourceRecord) {
    const nextRecord = {
      ...structuredClone(sourceRecord),
      id: createId(sourceRecord.categoryId),
      title: `${getRecordTitle(sourceRecord)} 副本`,
      history: [
        ...(sourceRecord.history ?? []).map((entry) => ({
          ...entry,
          id: createId("history"),
        })),
        {
          id: createId("history"),
          date: today(),
          status: sourceRecord.status,
          owner: "",
          summary: `复制自"${getRecordTitle(sourceRecord)}"`,
        },
      ],
      dateHistory: Object.fromEntries(
        Object.entries(sourceRecord.dateHistory ?? {}).map(([fieldKey, entries]) => [
          fieldKey,
          (entries ?? []).map((entry) => ({ ...entry, id: createId("date-history") })),
        ]),
      ),
      todoHistory: (sourceRecord.todoHistory ?? []).map((entry) => ({
        ...entry,
        id: createId("todo-hist"),
      })),
    };

    setRecords((current) => {
      const index = current.findIndex((record) => record.id === sourceRecord.id);
      if (index < 0) {
        return [nextRecord, ...current];
      }
      return [
        ...current.slice(0, index + 1),
        nextRecord,
        ...current.slice(index + 1),
      ];
    });
    setSelectedId(nextRecord.id);
  }

  function addRecordFromGraph(categoryId, position, sourceNodeId) {
    const record = buildRecord(categoryId);
    const nodeId = `node-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    setRecords((current) => [record, ...current]);

    setGraphNodes((current) => [
      ...current,
      {
        id: nodeId,
        position,
        data: { recordId: record.id, categoryId },
      },
    ]);

    if (sourceNodeId) {
      setGraphEdges((current) => [
        ...current,
        {
          id: `edge-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          source: sourceNodeId,
          target: nodeId,
          type: "smoothstep",
          data: { relationType: "衍生出", label: "", description: "" },
        },
      ]);
    }
  }

  function deleteRecord(recordId) {
    const record = records.find((item) => item.id === recordId);
    const title = record ? getRecordTitle(record) : "这条记录";
    if (!window.confirm(`确认删除"${title}"吗？此操作会同步移除对应的知识图谱节点。`)) {
      return;
    }

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
    setStatusSortDirection("asc");
  }

  function buildFullDataPayload() {
    return {
      version: 5,
      exportedAt: new Date().toISOString(),
      scope: "pages-1-6",
      includes: ["software", "patent", "paper", "contest", "graph", "status-config"],
      statusOptions,
      records,
      graph: {
        nodes: graphNodes,
        edges: graphEdges,
      },
    };
  }

  function applyFullDataPayload(parsed) {
    const nextRecords = Array.isArray(parsed) ? parsed : parsed.records;
    let recordCount = 0;
    let graphNodeCount = 0;
    let graphEdgeCount = 0;

    if (Array.isArray(nextRecords)) {
      const normalized = nextRecords.map(normalizeRecord);
      setRecords(normalized);
      recordCount = normalized.length;
      setSelectedId(null);
    }

    if (!Array.isArray(parsed) && parsed.graph) {
      const nodes = Array.isArray(parsed.graph.nodes) ? parsed.graph.nodes : [];
      const edges = Array.isArray(parsed.graph.edges) ? parsed.graph.edges : [];
      setGraphNodes(nodes);
      setGraphEdges(edges);
      graphNodeCount = nodes.length;
      graphEdgeCount = edges.length;
    }

    if (!Array.isArray(parsed) && Array.isArray(parsed.statusOptions)) {
      const importedStatuses = sortStatusConfig(parsed.statusOptions);
      setStatusOptions(importedStatuses);
      setStatusDraft(importedStatuses);
    }

    setStatusFilter("all");
    setStatusSortDirection("asc");
    return { recordCount, graphNodeCount, graphEdgeCount };
  }

  function exportJson() {
    downloadBlob(
      "科研进度管理平台-全部数据.json",
      JSON.stringify(buildFullDataPayload(), null, 2),
      "application/json;charset=utf-8",
    );
  }

  const ALL_CSV_FIELDS = [
    { key: "categoryName", label: "类别" },
    { key: "status", label: "状态" },
    { key: "title", label: "项目名称" },
    { key: "description", label: "中文解释" },
    { key: "stageDate", label: "阶段日期" },
    { key: "registrationDate", label: "报名日期" },
    { key: "endDate", label: "结束日期" },
    { key: "windowsPath", label: "Windows路径" },
    { key: "linuxPath", label: "Linux路径" },
    { key: "serverPath", label: "服务器路径" },
    { key: "githubUrl", label: "GitHub地址" },
    { key: "platformUrl", label: "平台网址" },
    { key: "officialUrl", label: "官网" },
    { key: "todo", label: "Todo" },
  ];

  function resolveStatusLabel(statusId) {
    return statusById[statusId]?.label ?? statusId ?? "";
  }

  function exportAllCsv() {
    const categoryGroups = CATEGORIES.map((cat) => ({
      category: cat,
      records: records.filter((r) => r.categoryId === cat.id),
    }));

    const headerRow = [...ALL_CSV_FIELDS.map((f) => f.label), "历史记录数", "Todo完成数"];
    const dataRows = categoryGroups.flatMap(({ category, records: catRecords }) =>
      catRecords.map((record) => [
        ...ALL_CSV_FIELDS.map((field) => {
          if (field.key === "categoryName") return category.name;
          if (field.key === "status") return resolveStatusLabel(record[field.key]);
          return record[field.key] ?? "";
        }),
        record.history?.length ?? 0,
        (record.todoHistory ?? []).filter((t) => t.doneDate).length,
      ]),
    );

    const csv = [headerRow, ...dataRows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");

    downloadBlob("科研进度管理平台-全部类别.csv", "﻿" + csv, "text/csv;charset=utf-8");
  }

  function exportCategoryCsv() {
    const rows = [
      [...activeCategory.fields.map((field) => field.label), "历史记录数"],
      ...categoryRecords.map((record) => [
        ...activeCategory.fields.map((field) => record[field.key]),
        record.history?.length ?? 0,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    downloadBlob(`${activeCategory.name}进度台账.csv`, "﻿" + csv, "text/csv;charset=utf-8");
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
        const { recordCount, graphNodeCount, graphEdgeCount } = applyFullDataPayload(parsed);

        setImportStatus({
          success: true,
          message: `导入成功：${recordCount} 条记录、${graphNodeCount} 个图谱节点、${graphEdgeCount} 条连线`,
        });
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err) {
        setImportStatus({
          success: false,
          message: `导入失败：${err.message || "文件格式错误"}`,
        });
        setTimeout(() => setImportStatus(null), 5000);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function loadBackupList() {
    try {
      const response = await fetch("/api/backups");
      if (!response.ok) {
        throw new Error("备份服务不可用");
      }
      const data = await response.json();
      const backups = Array.isArray(data.backups) ? data.backups : [];
      setBackupList(backups);
      setSelectedBackup((current) =>
        current && backups.some((backup) => backup.name === current)
          ? current
          : backups[0]?.name ?? "",
      );
      return backups;
    } catch {
      setBackupList([]);
      setSelectedBackup("");
      return [];
    }
  }

  async function createServerBackup() {
    setBackupBusy(true);
    setStatusConfigMessage("");
    try {
      const response = await fetch("/api/backups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildFullDataPayload()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "服务器本地备份失败");
      }
      const backups = await loadBackupList();
      setSelectedBackup(data.backup?.name || backups[0]?.name || "");
      setStatusConfigMessage("已创建服务器本地备份，包含 1-6 页面全部数据");
    } catch (error) {
      setStatusConfigMessage(error.message || "服务器本地备份失败");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreServerBackup() {
    if (!selectedBackup) {
      setStatusConfigMessage("请先选择要恢复的备份");
      return;
    }
    if (!window.confirm("确认恢复所选备份吗？当前 1-6 页面数据会被备份内容覆盖。")) {
      return;
    }

    setBackupBusy(true);
    setStatusConfigMessage("");
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(selectedBackup)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.data) {
        throw new Error(data.error || "读取备份失败");
      }
      const { recordCount, graphNodeCount, graphEdgeCount } = applyFullDataPayload(data.data);
      setStatusConfigMessage(
        `已恢复备份：${recordCount} 条记录、${graphNodeCount} 个图谱节点、${graphEdgeCount} 条连线`,
      );
    } catch (error) {
      setStatusConfigMessage(error.message || "恢复备份失败");
    } finally {
      setBackupBusy(false);
    }
  }

  function formatBackupLabel(backup) {
    const created = backup.createdAt || backup.mtime;
    const timeText = created ? new Date(created).toLocaleString() : backup.name;
    const recordCount = Number.isFinite(Number(backup.recordCount))
      ? `${backup.recordCount}条`
      : "未知条数";
    return `${timeText} · ${recordCount}`;
  }

  function updateStatusDraft(statusId, patch) {
    setStatusDraft((current) => {
      const next = current.map((status) => (status.id === statusId ? { ...status, ...patch } : status));
      return Object.prototype.hasOwnProperty.call(patch, "priority")
        ? sortStatusConfig(next)
        : next;
    });
  }

  function addStatusDraft() {
    const nextPriority =
      Math.max(0, ...statusDraft.map((status) => Number(status.priority) || 0)) + 10;
    setStatusDraft((current) =>
      sortStatusConfig([
        ...current,
        {
          id: createId("status"),
          label: "新状态",
          priority: nextPriority,
          color: "#2563eb",
          bg: "#dbeafe",
          border: "#93c5fd",
        },
      ]),
    );
    setStatusConfigMessage("");
  }

  function duplicateStatusDraft(status) {
    setStatusDraft((current) =>
      sortStatusConfig([
        ...current,
        {
          ...status,
          id: createId("status"),
          label: `${status.label} 副本`,
          priority: Number(status.priority) + 1,
        },
      ]),
    );
    setStatusConfigMessage("");
  }

  function removeStatusDraft(statusId) {
    setStatusDraft((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((status) => status.id !== statusId);
    });
    setStatusConfigMessage("");
  }

  function resetStatusDraft() {
    setStatusDraft(sortStatusConfig(STATUSES));
    setStatusConfigMessage("已恢复默认草稿，点击生效后更新下拉选项");
  }

  function applyStatusDraft() {
    const nextOptions = sortStatusConfig(statusDraft);
    const nextIds = new Set(nextOptions.map((status) => status.id));
    const fallbackStatus = nextOptions[0]?.id ?? "";

    setStatusOptions(nextOptions);
    setStatusDraft(nextOptions);
    setRecords((current) =>
      current.map((record) =>
        nextIds.has(record.status) || !fallbackStatus
          ? record
          : { ...record, status: fallbackStatus },
      ),
    );
    setStatusConfigMessage("配置已生效，状态下拉和优先级排序已更新");
  }

  function renderStatusConfig() {
    return (
      <section className="workspace status-config-page">
          <div className="config-header">
            <div>
              <h2>优先级配置</h2>
              <p>修改状态选项和排序优先级，点击生效后同步到所有状态下拉和排序规则。</p>
            </div>
            <div className="config-actions">
              <button className="icon-button" type="button" onClick={addStatusDraft}>
                <Plus size={16} />
                <span>新增状态</span>
              </button>
              <button className="icon-button" type="button" onClick={resetStatusDraft}>
                <RotateCcw size={16} />
                <span>恢复默认</span>
              </button>
              <button className="icon-button" type="button" onClick={applyStatusDraft}>
                <Save size={16} />
                <span>生效</span>
              </button>
        </div>
      </div>

      <div className="backup-panel">
        <div>
          <strong>服务器本地备份</strong>
          <span>备份 1-6 页面：软著、专利、论文、比赛、知识图谱、优先级配置。</span>
        </div>
        <div className="backup-actions">
          <button
            className="icon-button"
            type="button"
            onClick={createServerBackup}
            disabled={backupBusy}
          >
            <Save size={16} />
            <span>一键备份</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={loadBackupList}
            disabled={backupBusy}
          >
            <RotateCcw size={16} />
            <span>刷新备份</span>
          </button>
          <select
            className="backup-select"
            value={selectedBackup}
            onChange={(event) => setSelectedBackup(event.target.value)}
            disabled={backupBusy || backupList.length === 0}
            aria-label="选择服务器本地备份"
          >
            {backupList.length === 0 ? (
              <option value="">暂无服务器本地备份</option>
            ) : (
              backupList.map((backup) => (
                <option key={backup.name} value={backup.name}>
                  {formatBackupLabel(backup)}
                </option>
              ))
            )}
          </select>
          <button
            className="text-button"
            type="button"
            onClick={restoreServerBackup}
            disabled={backupBusy || !selectedBackup}
          >
            恢复备份
          </button>
        </div>
      </div>

      {statusConfigMessage && <div className="config-message">{statusConfigMessage}</div>}

          <div className="status-config-table">
            <div className="status-config-row status-config-head">
              <span>状态名称</span>
              <span>优先级</span>
              <span>文字</span>
              <span>背景</span>
              <span>边框</span>
              <span>预览</span>
              <span>操作</span>
            </div>
            {statusDraft.map((status) => (
              <div className="status-config-row" key={status.id}>
                <input
                  className="config-input"
                  value={status.label}
                  onChange={(event) => updateStatusDraft(status.id, { label: event.target.value })}
                  aria-label="状态名称"
                />
                <input
                  className="config-input"
                  type="number"
                  value={status.priority}
                  onChange={(event) =>
                    updateStatusDraft(status.id, { priority: Number(event.target.value) })
                  }
                  aria-label={`${status.label} 优先级`}
                />
                <input
                  className="config-color"
                  type="color"
                  value={status.color}
                  onChange={(event) => updateStatusDraft(status.id, { color: event.target.value })}
                  aria-label={`${status.label} 文字颜色`}
                />
                <input
                  className="config-color"
                  type="color"
                  value={status.bg}
                  onChange={(event) => updateStatusDraft(status.id, { bg: event.target.value })}
                  aria-label={`${status.label} 背景颜色`}
                />
                <input
                  className="config-color"
                  type="color"
                  value={status.border}
                  onChange={(event) => updateStatusDraft(status.id, { border: event.target.value })}
                  aria-label={`${status.label} 边框颜色`}
                />
                <span
                  className="status-chip config-preview"
                  style={{
                    "--status-bg": status.bg,
                    "--status-color": status.color,
                    "--status-border": status.border,
                  }}
                >
                  {status.label || "未命名"}
                  <strong>{status.priority}</strong>
                </span>
                <div className="status-config-actions-cell">
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    onClick={() => removeStatusDraft(status.id)}
                    disabled={statusDraft.length <= 1}
                    title="删除状态"
                  >
                    <X size={16} />
                  </button>
                  <button
                    className="icon-button copy-icon"
                    type="button"
                    onClick={() => duplicateStatusDraft(status)}
                    title="复制状态"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
      </section>
    );
  }

  function renderCell(record, field) {
    if (field.type === "status") {
      const status = statusById[record.status] ?? statusOptions[0];
      return (
        <PortalPopover
          className="status-history-field"
          popover={
                      <StatusHistoryPopover
                        history={record.history}
                        todoHistory={record.todoHistory}
                        onDeleteStatus={(historyId) => deleteStatusHistoryItem(record.id, historyId)}
                        onDeleteTodo={(historyId) => deleteTodoHistoryItem(record.id, historyId)}
                        onUpdateStatus={(historyId, summary) =>
                          updateStatusHistoryItem(record.id, historyId, summary)
                        }
                        onUpdateTodo={(historyId, item) =>
                          updateTodoHistoryItem(record.id, historyId, item)
                        }
                      />
          }
        >
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
            {statusOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </PortalPopover>
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
          onDeleteHistory={(historyId) =>
            deleteDateHistoryItem(record.id, field.key, historyId)
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
                rows={estimateTextRows(record[field.key], field.key)}
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

    if (field.type === "path") {
      return (
        <div className="path-cell">
          <textarea
            className="cell-input cell-textarea"
                rows={estimateTextRows(record[field.key], field.key)}
            value={record[field.key] ?? ""}
            onFocus={() => setSelectedId(record.id)}
            onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
            aria-label={`${getRecordTitle(record)} ${field.label}`}
          />
          <CopyIconButton value={record[field.key]} label={field.label} />
        </div>
      );
    }

    if (field.key === "todo") {
      const todoText = record.todo ?? "";
      const lines = todoText.split(/\r?\n/).filter((l) => l.trim());
      const todoHistory = record.todoHistory ?? [];
      const histByItem = new Map(todoHistory.map((e) => [e.item, e]));
      function addTodoLine(text) {
        const val = text.trim();
        if (!val) return;
        const newText = todoText ? todoText + "\n" + val : val;
        updateRecord(record.id, { todo: newText });
        syncTodoItems(record.id, newText);
      }
      function handleTodoKeydown(event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          addTodoLine(event.target.value);
          event.target.value = "";
        }
      }
      const doneItems = lines.filter((l) => histByItem.get(l)?.doneDate != null);
      const activeItems = lines.filter((l) => !histByItem.get(l)?.doneDate);
      return (
        <div className="todo-cell">
          <div className="todo-list">
            {activeItems.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              return (
                <label key={`a-${idx}-${trimmed.substring(0, 12)}`} className="todo-item">
                  <button
                    className="todo-delete-btn"
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteTodoItem(record.id, trimmed); }}
                    title="删除此项"
                  >×</button>
                  <input
                    type="checkbox"
                    className="todo-checkbox"
                    onChange={() => toggleTodoItem(record.id, trimmed)}
                  />
                  <span className="todo-text">{trimmed}</span>
                  <span className="todo-date">{histByItem.get(trimmed)?.addedDate || ""}</span>
                </label>
              );
            })}
          </div>
          {doneItems.length > 0 && (
            <div
              className="todo-done-popover"
              ref={(el) => {
                if (!el) return;
                const rect = el.parentElement?.getBoundingClientRect();
                if (!rect) return;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const pw = 240;
                const ph = Math.min(180, doneItems.length * 28 + 30);
                let left = rect.right + 6;
                let top = rect.top;
                if (left + pw > vw - 10) left = rect.left - pw - 6;
                if (top + ph > vh - 10) top = vh - ph - 10;
                if (top < 0) top = 4;
                el.style.top = top + "px";
                el.style.left = left + "px";
              }}
            >
              <div className="todo-done-title">已完成 ({doneItems.length})</div>
              {doneItems.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                const hist = histByItem.get(trimmed);
                return (
                  <label key={`d-${idx}-${trimmed.substring(0, 12)}`} className="todo-item done">
                    <input
                      type="checkbox"
                      className="todo-checkbox"
                      checked={true}
                      onChange={() => toggleTodoItem(record.id, trimmed)}
                    />
                    <span className="todo-text">{trimmed}</span>
                    <span className="todo-date">{hist?.doneDate || ""}</span>
                  </label>
                );
              })}
            </div>
          )}
          <textarea
            className="cell-input cell-textarea todo-new-input"
            rows={1}
            onFocus={() => setSelectedId(record.id)}
            onKeyDown={handleTodoKeydown}
            placeholder="输入待办，回车添加"
            aria-label={`${getRecordTitle(record)} 新增待办`}
          />
        </div>
      );
    }

    return (
      <textarea
        className="cell-input cell-textarea"
        rows={estimateTextRows(record[field.key], field.key)}
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
          <h1>科研进度管理平台</h1>
            <div className="shortcut-hint">
              <Keyboard size={15} />
              <span>按 1 / 2 / 3 / 4 / 5 / 6 切换页面</span>
              {pageLoadTime && (
                <span className="load-time-badge" title={`页面刷新时间: ${new Date(pageLoadTime).toLocaleTimeString()}`}>
                  已刷新
                </span>
              )}
            </div>
          </div>

          <div className="global-data-actions">
            <button
              className="icon-button"
              type="button"
              onClick={exportJson}
              title="一键导出五个栏目的全部数据（含历史记录和知识图谱）"
            >
              <Download size={17} />
              <span>一键导出 JSON</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={exportAllCsv}
              title="一键导出四个栏目的全部记录为 CSV"
            >
              <FileDown size={17} />
              <span>导出全部 CSV</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="一键导入五个栏目的全部数据"
            >
              <Upload size={17} />
              <span>导入 JSON</span>
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

        {importStatus && (
          <div className={`import-toast ${importStatus.success ? "success" : "error"}`}>
            {importStatus.message}
          </div>
        )}

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
                setStatusSortDirection("asc");
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
            statusOptions={statusOptions}
            updateRecord={updateRecord}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            setGraphNodes={setGraphNodes}
            setGraphEdges={setGraphEdges}
            openExternalUrl={openExternalUrl}
            updateRecordDate={updateRecordDate}
            updateDateHistoryItem={updateDateHistoryItem}
            addRecordFromGraph={addRecordFromGraph}
            toggleTodoItem={toggleTodoItem}
            deleteTodoItem={deleteTodoItem}
            deleteDateHistoryItem={deleteDateHistoryItem}
            deleteStatusHistoryItem={deleteStatusHistoryItem}
            deleteTodoHistoryItem={deleteTodoHistoryItem}
            updateStatusHistoryItem={updateStatusHistoryItem}
            updateTodoHistoryItem={updateTodoHistoryItem}
            syncTodoItems={syncTodoItems}
          />
        ) : isStatusConfigView ? (
          renderStatusConfig()
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
              {statusOptions.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>

            <button className="icon-button primary" type="button" onClick={addRecord} title="新增记录">
              <Plus size={18} />
              <span>新增</span>
            </button>

            <button className="icon-button" type="button" onClick={exportCategoryCsv} title="导出当前类别 CSV">
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
                <div key={field.key} className={`table-head field-${field.key}`}>
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
                <button
                  className="row-copy-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    duplicateRecord(record);
                  }}
                  title="复制这一行"
                  aria-label={`复制 ${getRecordTitle(record)}`}
                >
                  <Copy size={12} />
                </button>
                <DaysSince dateField={activeCategory.fields.find((f) => f.type === "date")} record={record} />
              </div>
                {activeCategory.fields.map((field) => (
                  <div key={field.key} className={`table-cell field-${field.key}`}>
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
