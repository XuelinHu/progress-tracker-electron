import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Keyboard,
  Plus,
  RotateCcw,
  Search,
  Settings2,
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
import CopyableControl from "./components/CopyableControl.jsx";
import CalendarBoard from "./components/CalendarBoard.jsx";
import KnowledgeGraph from "./components/KnowledgeGraph.jsx";
import { CATEGORIES, CATEGORY_BY_ID } from "./data/categories.js";
import { seedRecords } from "./data/seed.js";
import { STATUSES } from "./data/statuses.js";

const EMPTY_CONTEST_PLACEHOLDER_IDS = new Set([
  "contest-5",
  "contest-6",
  "contest-7",
  "contest-8",
  "contest-9",
]);
const GRAPH_CATEGORY = {
  id: "graph",
  name: "知识图谱",
  shortcut: "F",
  accent: "#0891b2",
  tint: "#cffafe",
};
const CALENDAR_CATEGORY = {
  id: "calendar",
  name: "日历",
  shortcut: "G",
  accent: "#7c3aed",
  tint: "#f3e8ff",
};
const STATUS_CONFIG_PAGE = {
  id: "status-config",
  name: "优先级配置",
  shortcut: "8",
  accent: "#2563eb",
  tint: "#dbeafe",
};
const OTHER_ITEMS_PAGE = {
  id: "other-items",
  name: "其他事项",
  shortcut: "7",
  accent: "#64748b",
  tint: "#f1f5f9",
};
const CREATE_ASSIST_HINT =
  "粘贴项目名称、状态、日期、GitHub 地址、路径、Todo 或备注，点击自动识别后会填充到左侧表单。";
const CALENDAR_DONE_STATUS = {
  id: "已完成",
  label: "已完成",
  priority: 990,
  color: "#334155",
  bg: "#e2e8f0",
  border: "#94a3b8",
};
const PROJECT_CATEGORY_ID = "project";
const PROJECT_NAVIGATION_ITEM = CATEGORY_BY_ID[PROJECT_CATEGORY_ID]
  ? { ...CATEGORY_BY_ID[PROJECT_CATEGORY_ID], shortcut: "5" }
  : null;
const OTHER_NAVIGATION_ITEM = { ...OTHER_ITEMS_PAGE, shortcut: "6" };
const NAVIGATION_ITEMS = [
  ...CATEGORIES.filter((category) => category.id !== PROJECT_CATEGORY_ID),
  PROJECT_NAVIGATION_ITEM,
  OTHER_NAVIGATION_ITEM,
].filter(Boolean);

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeRecord(record) {
  const rawTodo = Array.isArray(record.todoHistory) ? record.todoHistory : [];
  const normalizedDate =
    record.categoryId === "contest" || record.categoryId === PROJECT_CATEGORY_ID
      ? { registrationDate: record.registrationDate || today() }
      : { stageDate: record.stageDate || today() };
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
      addedDate: e.addedDate || e.date || today(),
      item: e.item || "",
      doneDate: e.doneDate || (!e.addedDate && e.date ? e.date : null),
    })),
  };
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function hasDateHistory(record) {
  return Object.values(record.dateHistory ?? {}).some(
    (entries) => Array.isArray(entries) && entries.length > 0,
  );
}

function isEmptyContestPlaceholder(record) {
  if (record.categoryId !== "contest" || !EMPTY_CONTEST_PLACEHOLDER_IDS.has(record.id)) {
    return false;
  }

  return (
    !hasText(record.title) &&
    !hasText(record.platformUrl) &&
    !hasText(record.officialUrl) &&
    !hasText(record.registrationDate) &&
    !hasText(record.endDate) &&
    !hasText(record.todo) &&
    !(Array.isArray(record.history) && record.history.length > 0) &&
    !(Array.isArray(record.todoHistory) && record.todoHistory.length > 0) &&
    !hasDateHistory(record)
  );
}

function removeEmptyContestPlaceholders(records) {
  return records.filter((record) => !isEmptyContestPlaceholder(record));
}

function mergeMissingSeedRecords(records) {
  const cleanedRecords = removeEmptyContestPlaceholders(records);
  const existingIds = new Set(cleanedRecords.map((record) => record.id));
  const missingRecords = seedRecords
    .filter((record) => !existingIds.has(record.id))
    .map(normalizeRecord);
  return [...cleanedRecords, ...removeEmptyContestPlaceholders(missingRecords)];
}

function loadRecords() {
  return mergeMissingSeedRecords(seedRecords.map(normalizeRecord));
}

function loadGraph() {
  return { nodes: [], edges: [] };
}

function normalizeCalendarItems(items) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          id: String(item?.id || createId("calendar-item")),
          date: String(item?.date || today()),
          title: String(item?.title || "其他事项"),
          description: String(item?.description || ""),
          categoryId: item?.categoryId || "other",
          status: item?.status || CALENDAR_DONE_STATUS.id,
          createdAt: item?.createdAt || new Date().toISOString(),
        }))
        .filter((item) => item.date && item.title)
    : [];
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

  const defaultStatuses = STATUSES.filter(
    (status) => !normalized.some((item) => item.id === status.id),
  );
  const merged = [...normalized, ...defaultStatuses];
  return merged.length > 0 ? merged : STATUSES;
}

function sortStatusConfig(items) {
  return normalizeStatusConfig(items).sort(
    (left, right) =>
      left.priority - right.priority ||
      left.label.localeCompare(right.label, "zh-Hans-CN"),
  );
}

function loadStatusConfig() {
  return sortStatusConfig(STATUSES);
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
  const [calendarItems, setCalendarItems] = useState([]);
  const fileInputRef = useRef(null);
  const [pageLoadTime, setPageLoadTime] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [statusOptions, setStatusOptions] = useState(loadStatusConfig);
  const [statusDraft, setStatusDraft] = useState(() => loadStatusConfig());
  const [statusConfigMessage, setStatusConfigMessage] = useState("");
  const [backupList, setBackupList] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [otherItemDraft, setOtherItemDraft] = useState(() => ({
    date: today(),
    title: "",
    description: "",
  }));
  const [createModal, setCreateModal] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [createAssistText, setCreateAssistText] = useState("");
  const [createAssistIssues, setCreateAssistIssues] = useState([]);
  const createAssistRef = useRef(null);
  const [serverStateReady, setServerStateReady] = useState(false);
  const [serverSaveError, setServerSaveError] = useState("");
  const saveTimerRef = useRef(null);

  const isGraphView = activeCategoryId === GRAPH_CATEGORY.id;
  const isCalendarView = activeCategoryId === CALENDAR_CATEGORY.id;
  const isOtherItemsView = activeCategoryId === OTHER_ITEMS_PAGE.id;
  const isStatusConfigView = activeCategoryId === STATUS_CONFIG_PAGE.id;
  const activeCategory = CATEGORY_BY_ID[activeCategoryId] ?? CATEGORIES[0];
  const activeNavigationItem = isGraphView
    ? GRAPH_CATEGORY
    : isCalendarView
      ? CALENDAR_CATEGORY
      : isOtherItemsView
        ? OTHER_ITEMS_PAGE
        : isStatusConfigView
          ? STATUS_CONFIG_PAGE
          : activeCategory;
  const tableTemplate = ["58px", ...activeCategory.fields.map((field) => field.width)].join(" ");
  const statusById = useMemo(
    () => Object.fromEntries(statusOptions.map((status) => [status.id, status])),
    [statusOptions],
  );
  const calendarStatusOptions = useMemo(
    () =>
      statusOptions.some((status) => status.id === CALENDAR_DONE_STATUS.id)
        ? statusOptions
        : [CALENDAR_DONE_STATUS, ...statusOptions],
    [statusOptions],
  );
  const calendarStatusById = useMemo(
    () => Object.fromEntries(calendarStatusOptions.map((status) => [status.id, status])),
    [calendarStatusOptions],
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

  function getDefaultStatusId() {
    return (
      statusOptions.find((status) => status.id === "进行中" || status.label === "进行中")?.id ??
      statusOptions[0]?.id ??
      "进行中"
    );
  }

  function getDefaultCalendarStatusId() {
    return CALENDAR_DONE_STATUS.id;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadServerState() {
      try {
        const response = await fetch("/api/state");
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "读取数据库状态失败");
        }
        if (!cancelled && data.state) {
          applyFullDataPayload(data.state);
        }
        if (!cancelled) {
          setServerSaveError("");
          setServerStateReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setServerSaveError(error.message || "读取数据库状态失败");
          setServerStateReady(true);
        }
      }
    }

    loadServerState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!serverStateReady) {
      return undefined;
    }

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildFullDataPayload()),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "写入数据库状态失败");
        }
        setServerSaveError("");
      } catch (error) {
        setServerSaveError(error.message || "写入数据库状态失败");
      }
    }, 450);

    return () => window.clearTimeout(saveTimerRef.current);
  }, [calendarItems, graphEdges, graphNodes, records, serverStateReady, statusOptions]);

  useEffect(() => {
    if (statusFilter !== "all" && !statusOptions.some((status) => status.id === statusFilter)) {
      setStatusFilter("all");
    }
  }, [statusFilter, statusOptions]);

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

      const shortcut = event.key.toLowerCase();
      if (shortcut === "g") {
        setActiveCategoryId(CALENDAR_CATEGORY.id);
        setStatusFilter("all");
        setStatusSortDirection("asc");
        return;
      }
      if (shortcut === "f") {
        setActiveCategoryId(GRAPH_CATEGORY.id);
        setStatusFilter("all");
        setStatusSortDirection("asc");
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

  function removeRecordDate(recordId, fieldKey, date) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const dateHistory = record.dateHistory ?? {};
        return {
          ...record,
          [fieldKey]: "",
          dateHistory: {
            ...dateHistory,
            [fieldKey]: (dateHistory[fieldKey] ?? []).filter(
              (entry) =>
                entry.date !== date || !String(entry.item ?? "").includes("安排："),
            ),
          },
        };
      }),
    );
  }

  function addCalendarItem(date, draft = {}) {
    const title = String(draft.title ?? "").trim();
    if (!date || !title) {
      return;
    }
    setCalendarItems((current) => [
      ...current,
      {
        id: createId("calendar-item"),
        date,
        title,
        description: String(draft.description ?? ""),
        categoryId: draft.categoryId || "other",
        status: draft.status || getDefaultCalendarStatusId(),
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function updateCalendarItem(itemId, patch) {
    setCalendarItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              title: String(patch.title ?? item.title ?? "").trim() || item.title,
              description:
                patch.description === undefined
                  ? item.description
                  : String(patch.description ?? ""),
              status: patch.status || item.status || getDefaultCalendarStatusId(),
              categoryId: patch.categoryId || item.categoryId || "other",
              date: patch.date || item.date || today(),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function deleteCalendarItem(itemId) {
    setCalendarItems((current) => current.filter((item) => item.id !== itemId));
  }

  function copyCalendarItem(item) {
    if (!item?.date || !item?.title) {
      return;
    }
    openCalendarItemModal(item.date, {
      title: item.title,
      description: item.description,
      categoryId: item.categoryId,
      status: item.status || getDefaultCalendarStatusId(),
    });
  }

  function submitOtherItem(event) {
    event.preventDefault();
    const title = otherItemDraft.title.trim();
    if (!title) {
      return;
    }
    addCalendarItem(otherItemDraft.date || today(), {
      title,
      description: otherItemDraft.description.trim(),
      categoryId: "other",
      status: getDefaultCalendarStatusId(),
    });
    setOtherItemDraft((current) => ({
      ...current,
      title: "",
      description: "",
    }));
  }

  function buildCalendarItemDraft(date = today(), overrides = {}) {
    return {
      date: date || today(),
      title: "",
      description: "",
      categoryId: "other",
      status: getDefaultCalendarStatusId(),
      ...overrides,
    };
  }

  function openCreateRecordModal(categoryId, context = {}) {
    const category = CATEGORY_BY_ID[categoryId] ?? CATEGORIES[0];
    setCreateModal({
      mode: "record",
      categoryId: category.id,
      graphPosition: context.graphPosition,
      sourceNodeId: context.sourceNodeId,
    });
    setCreateDraft(buildRecord(category.id));
    setCreateAssistText("");
    setCreateAssistIssues([]);
  }

  function openCalendarItemModal(date = today(), overrides = {}, context = {}) {
    setCreateModal({
      mode: "calendar",
      categoryId: "other",
      date,
      itemId: context.itemId || null,
    });
    setCreateDraft(buildCalendarItemDraft(date, overrides));
    setCreateAssistText("");
    setCreateAssistIssues([]);
  }

  function closeCreateModal() {
    setCreateModal(null);
    setCreateDraft(null);
    setCreateAssistText("");
    setCreateAssistIssues([]);
  }

  function updateCreateDraft(fieldKey, value) {
    setCreateDraft((current) => ({ ...(current ?? {}), [fieldKey]: value }));
  }

  function parseDateFromText(text) {
    const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    }
    const monthDay = text.match(/\b(\d{1,2})月(\d{1,2})[日号]?\b/);
    if (monthDay) {
      const year = new Date().getFullYear();
      return `${year}-${monthDay[1].padStart(2, "0")}-${monthDay[2].padStart(2, "0")}`;
    }
    return "";
  }

  function extractLabeledValue(lines, labels) {
    for (const line of lines) {
      for (const label of labels) {
        const pattern = new RegExp(`^${label}\\s*[:：=]\\s*(.+)$`, "i");
        const match = line.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
    }
    return "";
  }

  function buildCreateJsonTemplate() {
    if (!createModal) {
      return "{}";
    }
    if (createModal.mode === "calendar") {
      return JSON.stringify(
        {
          status: getDefaultCalendarStatusId(),
          date: today(),
          title: "今天要处理的事项",
          description: "注意事项或补充说明",
        },
        null,
        2,
      );
    }

    const category = CATEGORY_BY_ID[createModal.categoryId] ?? CATEGORIES[0];
    const template = {};
    for (const field of category.fields) {
      if (field.key === "status") {
        template[field.key] = getDefaultStatusId();
      } else if (field.type === "date") {
        template[field.key] = today();
      } else if (field.key === "title") {
        template[field.key] = `${category.name}项目名称`;
      } else if (field.key === "todo") {
        template[field.key] = "待办事项1\n待办事项2";
      } else {
        template[field.key] = "";
      }
    }
    return JSON.stringify(template, null, 2);
  }

  function buildCreateJsonExample() {
    if (!createModal) {
      return "{}";
    }
    if (createModal.mode === "calendar") {
      return JSON.stringify(
        {
          status: getDefaultCalendarStatusId(),
          date: today(),
          title: "完成铁路数据清洗",
          description: "今天重点核对异常样本，记录未完成原因",
        },
        null,
        2,
      );
    }

    const category = CATEGORY_BY_ID[createModal.categoryId] ?? CATEGORIES[0];
    const example = {};
    for (const field of category.fields) {
      if (field.key === "status") {
        example[field.key] = "进行中";
      } else if (field.type === "date") {
        example[field.key] = today();
      } else if (field.key === "title") {
        example[field.key] = "railway-example-project";
      } else if (field.key === "description") {
        example[field.key] = `${category.name}示例项目说明`;
      } else if (field.key === "todo") {
        example[field.key] = "整理需求\n补充 README\n提交 GitHub";
      } else if (field.key === "serverPath" || field.key === "linuxPath") {
        example[field.key] = "/ds1/workspace/ai/railway-example-project";
      } else if (field.key === "windowsPath") {
        example[field.key] = "D:\\workspace\\ai\\railway-example-project";
      } else if (field.key === "githubUrl") {
        example[field.key] = "https://github.com/XuelinHu/railway-example-project";
      } else if (field.key === "platformUrl") {
        example[field.key] = "https://example.com/platform";
      } else if (field.key === "officialUrl") {
        example[field.key] = "https://example.com/official";
      } else {
        example[field.key] = "";
      }
    }
    return JSON.stringify(example, null, 2);
  }

  function parseJsonAssist(text, fields) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) {
      return null;
    }
    const parsed = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("JSON 顶层必须是一个对象");
    }

    const patch = {};
    for (const field of fields) {
      const rawValue = parsed[field.key] ?? parsed[field.label];
      if (rawValue !== undefined && rawValue !== null) {
        patch[field.key] = String(rawValue);
      }
    }
    if (parsed.status !== undefined || parsed["状态"] !== undefined) {
      patch.status = String(parsed.status ?? parsed["状态"]);
    }
    return patch;
  }

  function autoFillCreateDraft() {
    const text = (createAssistRef.current?.value || createAssistText).trim();
    if (!text || !createDraft || !createModal) {
      setCreateAssistIssues(["请先在右侧文本框粘贴文本或 JSON。"]);
      return;
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const isCalendarAssist = createModal.mode === "calendar";
    const assistFields = isCalendarAssist
      ? [
          { key: "status", label: "状态", type: "status" },
          { key: "date", label: "日期", type: "date" },
          { key: "title", label: "事项名称", type: "text" },
          { key: "description", label: "注意事项", type: "textarea" },
        ]
      : (CATEGORY_BY_ID[createModal.categoryId] ?? CATEGORIES[0]).fields;
    const patch = {};
    try {
      const jsonPatch = parseJsonAssist(text, assistFields);
      if (jsonPatch) {
        const validKeys = new Set(assistFields.map((field) => field.key));
        const acceptedPatch = Object.fromEntries(
          Object.entries(jsonPatch).filter(([key, value]) => validKeys.has(key) && String(value).trim()),
        );
        if (Object.keys(acceptedPatch).length === 0) {
          setCreateAssistIssues(["JSON 已解析，但没有匹配到当前弹框字段。请使用下方 JSON 模板中的字段名。"]);
          return;
        }
        setCreateDraft((current) => ({ ...current, ...acceptedPatch }));
        setCreateAssistIssues([]);
        return;
      }
    } catch (error) {
      setCreateAssistIssues([`JSON 解析失败：${error.message || "格式不正确"}`, "请检查双引号、逗号和大括号是否完整。"]);
      return;
    }

    const matchedStatus = statusOptions.find(
      (status) => text.includes(status.label) || text.includes(status.id),
    );
    if (matchedStatus) {
      patch.status = matchedStatus.id;
    }

    const date = parseDateFromText(text);
    const urls = text.match(/https?:\/\/[^\s，。；;]+|github\.com\/[^\s，。；;]+/gi) ?? [];
    const paths = text.match(/[A-Za-z]:\\[^\n，。；;]+|\/(?:[\w.\-]+\/?)+/g) ?? [];

    if (createModal.mode === "calendar") {
      patch.date = extractLabeledValue(lines, ["日期", "时间", "date"]) || date || createDraft.date;
      patch.title =
        extractLabeledValue(lines, ["事项", "标题", "名称", "title"]) ||
        createDraft.title ||
        lines[0] ||
        "";
      patch.description =
        extractLabeledValue(lines, ["备注", "说明", "注意事项", "todo", "description"]) ||
        createDraft.description ||
        lines.slice(1).join("\n");
      const meaningfulKeys = Object.entries(patch).filter(
        ([key, value]) => key !== "date" && String(value ?? "").trim(),
      );
      if (meaningfulKeys.length === 0) {
        setCreateAssistIssues(["未识别到事项名称、备注或状态。", "建议粘贴 JSON，或使用“事项：xxx”“备注：xxx”“日期：2026-07-01”这样的格式。"]);
        return;
      }
      setCreateDraft((current) => ({ ...current, ...patch }));
      setCreateAssistIssues([]);
      return;
    }

    const category = CATEGORY_BY_ID[createModal.categoryId] ?? CATEGORIES[0];
    const fieldByKey = Object.fromEntries(category.fields.map((field) => [field.key, field]));
    for (const field of category.fields) {
      const labeled = extractLabeledValue(lines, [field.label, field.key]);
      if (labeled) {
        patch[field.key] = labeled;
      }
    }

    if (!patch.title) {
      patch.title =
        extractLabeledValue(lines, ["GitHub项目名称", "项目名称", "名称", "标题", "title"]) ||
        createDraft.title ||
        lines[0] ||
        "";
    }
    if (fieldByKey.description && !patch.description) {
      patch.description =
        extractLabeledValue(lines, ["中文解释", "说明", "描述", "description"]) ||
        createDraft.description ||
        lines.slice(1, 3).join("\n");
    }
    if (fieldByKey.todo && !patch.todo) {
      patch.todo =
        extractLabeledValue(lines, ["Todo", "todo", "待办", "事项", "注意事项"]) ||
        createDraft.todo ||
        "";
    }
    const firstDateField = category.fields.find((field) => field.type === "date");
    if (firstDateField && date && !patch[firstDateField.key]) {
      patch[firstDateField.key] = date;
    }
    if (fieldByKey.githubUrl && urls.length > 0 && !patch.githubUrl) {
      patch.githubUrl = urls.find((url) => url.toLowerCase().includes("github.com")) || urls[0];
    }
    if (fieldByKey.platformUrl && urls.length > 0 && !patch.platformUrl) {
      patch.platformUrl = urls[0];
    }
    if (fieldByKey.officialUrl && urls.length > 1 && !patch.officialUrl) {
      patch.officialUrl = urls[1];
    }
    if (paths.length > 0) {
      if (fieldByKey.windowsPath && !patch.windowsPath) {
        patch.windowsPath = paths.find((path) => /^[A-Za-z]:\\/.test(path)) || createDraft.windowsPath;
      }
      if (fieldByKey.linuxPath && !patch.linuxPath) {
        patch.linuxPath = paths.find((path) => path.startsWith("/")) || createDraft.linuxPath;
      }
      if (fieldByKey.serverPath && !patch.serverPath) {
        patch.serverPath = paths.find((path) => path.startsWith("/")) || createDraft.serverPath;
      }
    }

    const meaningfulKeys = Object.entries(patch).filter(
      ([key, value]) =>
        String(value ?? "").trim() &&
        !(key === "title" && value === createDraft.title) &&
        !(key === "description" && value === createDraft.description),
    );
    if (meaningfulKeys.length === 0) {
      setCreateAssistIssues(["未识别到当前项目字段。", "建议粘贴 JSON，或使用“GitHub项目名称：xxx”“状态：进行中”“阶段日期：2026-07-01”“服务器绝对路径：/path”这样的格式。"]);
      return;
    }
    setCreateDraft((current) => ({ ...current, ...patch }));
    setCreateAssistIssues([]);
  }

  function submitCreateModal(event) {
    event.preventDefault();
    if (!createDraft || !createModal) {
      return;
    }

    if (createModal.mode === "calendar") {
      const title = String(createDraft.title ?? "").trim();
      if (!title) {
        return;
      }
      if (createModal.itemId) {
        updateCalendarItem(createModal.itemId, {
          date: createDraft.date || today(),
          title,
          description: String(createDraft.description ?? "").trim(),
          categoryId: createDraft.categoryId || "other",
          status: createDraft.status || getDefaultCalendarStatusId(),
        });
      } else {
        addCalendarItem(createDraft.date || today(), {
          title,
          description: String(createDraft.description ?? "").trim(),
          categoryId: createDraft.categoryId || "other",
          status: createDraft.status || getDefaultCalendarStatusId(),
        });
      }
      closeCreateModal();
      return;
    }

    const graphContext = createModal.graphPosition
      ? { position: createModal.graphPosition, sourceNodeId: createModal.sourceNodeId }
      : null;
    insertRecord(createDraft, graphContext);
    closeCreateModal();
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

  function buildRecord(categoryId, overrides = {}) {
    const category = CATEGORY_BY_ID[categoryId] ?? CATEGORIES[0];
    const defaultStatus = getDefaultStatusId();
    const record = category.fields.reduce(
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
    return { ...record, ...overrides };
  }

  function createGraphNodeForRecord(record, position, sourceNodeId) {
    const nodeId = `node-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setGraphNodes((current) => [
      ...current,
      {
        id: nodeId,
        position,
        data: { recordId: record.id, categoryId: record.categoryId },
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

    setSelectedId(record.id);
  }

  function insertRecord(record, graphContext = null) {
    const normalizedRecord = normalizeRecord({
      ...record,
      title: String(record.title ?? "").trim() || "未命名记录",
      todo: String(record.todo ?? "").trim(),
    });
    setRecords((current) => [normalizedRecord, ...current]);
    setSelectedId(normalizedRecord.id);
    if (graphContext?.position) {
      createGraphNodeForRecord(
        normalizedRecord,
        graphContext.position,
        graphContext.sourceNodeId,
      );
    }
    return normalizedRecord;
  }

  function addRecord() {
    openCreateRecordModal(activeCategoryId);
  }

  function duplicateRecord(sourceRecord) {
    const category = CATEGORY_BY_ID[sourceRecord.categoryId] ?? CATEGORIES[0];
    const nextRecord = {
      ...structuredClone(sourceRecord),
      id: createId(sourceRecord.categoryId),
      title: `${getRecordTitle(sourceRecord)} 副本`,
      todo: "",
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
      dateHistory: {},
      todoHistory: [],
    };
    category.fields.forEach((field) => {
      if (field.type === "date") {
        nextRecord[field.key] = today();
      }
      if (field.key === "todo") {
        nextRecord[field.key] = "";
      }
    });

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

  function openRecordFromCalendar(record) {
    if (!record?.categoryId) {
      return;
    }
    setActiveCategoryId(record.categoryId);
    setSelectedId(record.id);
    setStatusFilter("all");
    setStatusSortDirection("asc");
  }

  function addRecordFromGraph(categoryId, position, sourceNodeId) {
    openCreateRecordModal(categoryId, { graphPosition: position, sourceNodeId });
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
    setCalendarItems([]);
    setSelectedId(null);
    setSearchTerm("");
    setStatusFilter("all");
    setStatusSortDirection("asc");
  }

  function buildFullDataPayload() {
    return {
      version: 5,
      exportedAt: new Date().toISOString(),
      scope: "pages-1-8",
      includes: ["software", "patent", "paper", "contest", "graph", "calendar", "project", "status-config"],
      statusOptions,
      records,
      graph: {
        nodes: graphNodes,
        edges: graphEdges,
      },
      calendarItems,
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

    if (!Array.isArray(parsed)) {
      setCalendarItems(normalizeCalendarItems(parsed.calendarItems));
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

  function showOperationStatus(success, message, timeout = 4000) {
    setImportStatus({ success, message });
    window.setTimeout(() => setImportStatus(null), timeout);
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

        showOperationStatus(
          true,
          `导入成功：${recordCount} 条记录、${graphNodeCount} 个图谱节点、${graphEdgeCount} 条连线`,
        );
      } catch (err) {
        showOperationStatus(false, `导入失败：${err.message || "文件格式错误"}`, 5000);
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
      setStatusConfigMessage("已创建服务器本地备份，包含 1-8 页面全部数据");
    } catch (error) {
      setStatusConfigMessage(error.message || "服务器本地备份失败");
    } finally {
      setBackupBusy(false);
    }
  }

  async function syncDavBackup() {
    setBackupBusy(true);
    setStatusConfigMessage("");
    try {
      const response = await fetch("/api/dav/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildFullDataPayload()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "WebDAV 同步失败");
      }
      setStatusConfigMessage(
        `已同步到云端：${data.sync?.project || "progress-tracker"}/${data.sync?.latestName || "latest.json"}`,
      );
      showOperationStatus(true, "已同步到云端");
    } catch (error) {
      setStatusConfigMessage(error.message || "WebDAV 同步失败");
      showOperationStatus(false, error.message || "WebDAV 同步失败", 5000);
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreDavBackup() {
    if (!window.confirm("确认从云端同步最新数据到本地吗？云端数据将覆盖当前数据库数据。")) {
      return;
    }
    setBackupBusy(true);
    setStatusConfigMessage("");
    try {
      const response = await fetch("/api/dav/latest");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.latest?.data) {
        throw new Error(data.error || "读取云端数据失败");
      }
      const { recordCount, graphNodeCount, graphEdgeCount } = applyFullDataPayload(data.latest.data);
      setStatusConfigMessage(
        `已按云端优先恢复：${recordCount} 条记录、${graphNodeCount} 个图谱节点、${graphEdgeCount} 条连线`,
      );
      showOperationStatus(
        true,
        `云端同步本地成功：${recordCount} 条记录、${graphNodeCount} 个图谱节点、${graphEdgeCount} 条连线`,
      );
    } catch (error) {
      setStatusConfigMessage(error.message || "从云端恢复失败");
      showOperationStatus(false, error.message || "从云端恢复失败", 5000);
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreServerBackup() {
    if (!selectedBackup) {
      setStatusConfigMessage("请先选择要恢复的备份");
      return;
    }
    if (!window.confirm("确认恢复所选备份吗？当前 1-8 页面数据会被备份内容覆盖。")) {
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

  async function deleteServerBackup(name) {
    if (!name) {
      return;
    }
    const backup = backupList.find((item) => item.name === name);
    const label = backup ? formatBackupLabel(backup) : name;
    if (!window.confirm(`确认删除备份"${label}"吗？删除后无法恢复。`)) {
      return;
    }

    setBackupBusy(true);
    setStatusConfigMessage("");
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "删除备份失败");
      }
      await loadBackupList();
      setStatusConfigMessage("已删除所选服务器本地备份");
    } catch (error) {
      setStatusConfigMessage(error.message || "删除备份失败");
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

  function renderCreateModal() {
    if (!createModal || !createDraft) {
      return null;
    }

    const isCalendarItem = createModal.mode === "calendar";
    const category = isCalendarItem
      ? OTHER_ITEMS_PAGE
      : CATEGORY_BY_ID[createModal.categoryId] ?? CATEGORIES[0];
    const fields = isCalendarItem
      ? [
          { key: "status", label: "默认状态", type: "status" },
          { key: "date", label: "日期", type: "date" },
          { key: "title", label: "事项名称", type: "text" },
          { key: "description", label: "注意事项", type: "textarea" },
        ]
      : category.fields;
    const jsonTemplate = buildCreateJsonTemplate();
    const jsonExample = buildCreateJsonExample();

    return (
      <div className="create-modal-backdrop" role="presentation" onMouseDown={closeCreateModal}>
        <form
          className="create-modal"
          onSubmit={submitCreateModal}
          onMouseDown={(event) => event.stopPropagation()}
          style={{ "--category-accent": category.accent, "--category-tint": category.tint }}
        >
          <div className="create-modal-head">
            <div>
              <strong>
                {isCalendarItem && createModal.itemId ? "编辑" : "新增"}
                {category.name}
              </strong>
              <span>{isCalendarItem ? "新建日历中的其他事项" : "填写左侧表单，右侧可粘贴文本自动补充"}</span>
            </div>
            <button className="danger-button small" type="button" onClick={closeCreateModal} title="关闭">
              <X size={15} />
            </button>
          </div>

          <div className="create-modal-body">
            <div className="create-form-fields">
              {fields.map((field) => {
                if (field.type === "status") {
                  const selectStatusOptions = isCalendarItem ? calendarStatusOptions : statusOptions;
                  const selectStatusById = isCalendarItem ? calendarStatusById : statusById;
                  const selectedStatus =
                    selectStatusById[createDraft.status] ?? selectStatusOptions[0];
                  return (
                    <label className="create-field" key={field.key}>
                      <span>{field.label}</span>
                      <select
                        className="form-control create-control status-select"
                        value={createDraft.status ?? ""}
                        onChange={(event) => updateCreateDraft("status", event.target.value)}
                        style={{
                          "--status-bg": selectedStatus?.bg || "#eef2ff",
                          "--status-color": selectedStatus?.color || "#334155",
                          "--status-border": selectedStatus?.border || "#cbd5e1",
                        }}
                      >
                        {selectStatusOptions.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.type === "date") {
                  return (
                    <label className="create-field" key={field.key}>
                      <span>{field.label}</span>
                      <input
                        className="form-control create-control"
                        type="date"
                        value={createDraft[field.key] ?? ""}
                        onChange={(event) => updateCreateDraft(field.key, event.target.value)}
                      />
                    </label>
                  );
                }

                const isLong = field.type === "textarea" || field.key === "todo" || field.key === "description";
                return (
                  <label className="create-field" key={field.key}>
                    <span>{field.label}</span>
                    {isLong ? (
                      <textarea
                        className="form-control create-control create-textarea"
                        rows={field.key === "todo" ? 4 : 3}
                        value={createDraft[field.key] ?? ""}
                        onChange={(event) => updateCreateDraft(field.key, event.target.value)}
                      />
                    ) : (
                      <input
                        className="form-control create-control"
                        value={createDraft[field.key] ?? ""}
                        onChange={(event) => updateCreateDraft(field.key, event.target.value)}
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="create-assist-panel">
              <label className="create-field">
                <span>自动识别文本</span>
                <textarea
                  ref={createAssistRef}
                  className="form-control create-assist-textarea"
                  value={createAssistText}
                  onChange={(event) => setCreateAssistText(event.target.value)}
                  placeholder="粘贴项目名称、状态、日期、GitHub 地址、路径、Todo 或备注"
                />
              </label>
              <button className="icon-button" type="button" onClick={autoFillCreateDraft}>
                <Search size={16} />
                <span>自动识别 / 自动补充</span>
              </button>
              <div className="create-assist-hint">
                <CopyIconButton
                  value={CREATE_ASSIST_HINT}
                  label="自动识别提示"
                  className="create-assist-copy"
                />
                <span>({CREATE_ASSIST_HINT})</span>
              </div>
              {createAssistIssues.length > 0 && (
                <div className="create-assist-errors" role="alert">
                  <strong>自动识别失败</strong>
                  {createAssistIssues.map((issue, index) => (
                    <span key={`${issue}-${index}`}>{issue}</span>
                  ))}
                </div>
              )}
              <div className="create-json-template">
                <div>
                  <strong>JSON 导入模板</strong>
                  <CopyIconButton
                    value={jsonTemplate}
                    label="JSON 导入模板"
                    className="create-assist-copy"
                  />
                </div>
                <pre>{jsonTemplate}</pre>
              </div>
              <div className="create-json-template">
                <div>
                  <strong>JSON 示例</strong>
                  <CopyIconButton
                    value={jsonExample}
                    label="JSON 示例"
                    className="create-assist-copy"
                  />
                </div>
                <pre>{jsonExample}</pre>
              </div>
            </div>
          </div>

          <div className="create-modal-foot">
            <button className="text-button" type="button" onClick={closeCreateModal}>
              取消
            </button>
            <button className="icon-button primary" type="submit">
              <Plus size={16} />
              <span>新增</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  function renderStatusConfig() {
    const selectedBackupInfo = backupList.find((backup) => backup.name === selectedBackup);
    const selectedBackupLabel = selectedBackupInfo
      ? formatBackupLabel(selectedBackupInfo)
      : backupList.length === 0
        ? "暂无服务器本地备份"
        : "请选择服务器本地备份";

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
          <span>备份 1-8 页面：软著、专利、论文、比赛、知识图谱、日历、项目、优先级配置。</span>
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
            <details className="backup-dropdown">
              <summary
                className={`backup-select ${backupList.length === 0 ? "empty" : ""}`}
                aria-label="选择服务器本地备份"
              >
                {selectedBackupLabel}
              </summary>
              <div className="backup-menu">
                {backupList.length === 0 ? (
                  <div className="backup-empty">暂无服务器本地备份</div>
                ) : (
                  backupList.map((backup) => (
                    <div
                      key={backup.name}
                      className={`backup-menu-item ${backup.name === selectedBackup ? "selected" : ""}`}
                    >
                      <button
                        className="backup-option-button"
                        type="button"
                        onClick={(event) => {
                          setSelectedBackup(backup.name);
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                        title={backup.name}
                      >
                        {formatBackupLabel(backup)}
                      </button>
                      <button
                        className="backup-delete-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteServerBackup(backup.name);
                        }}
                        disabled={backupBusy}
                        title="删除这个备份"
                        aria-label={`删除备份 ${formatBackupLabel(backup)}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </details>
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

  function renderOtherItems() {
    const sortedItems = [...calendarItems].sort(
      (left, right) =>
        String(left.date).localeCompare(String(right.date)) ||
        String(left.title).localeCompare(String(right.title), "zh-Hans-CN"),
    );

    return (
      <section className="workspace other-items-page">
        <div className="other-items-header">
          <div>
            <h2>其他事项</h2>
            <p>管理日历中的独立事项。这里的新建、复制和删除都会保存到 PostgreSQL。</p>
          </div>
        </div>

        <div className="other-item-form">
          <button
            className="icon-button primary"
            type="button"
            onClick={() => openCalendarItemModal(today())}
          >
            <Plus size={16} />
            <span>新增其他事项</span>
          </button>
        </div>

        <div className="other-items-list">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="other-item-row"
              onClick={() => openCalendarItemModal(item.date, item, { itemId: item.id })}
            >
              <span className="other-item-date">{item.date}</span>
              <strong>{item.title}</strong>
              <span
                className="status-chip other-item-status"
                style={{
                  "--status-bg":
                    calendarStatusById[item.status]?.bg || CALENDAR_DONE_STATUS.bg,
                  "--status-color":
                    calendarStatusById[item.status]?.color || CALENDAR_DONE_STATUS.color,
                  "--status-border":
                    calendarStatusById[item.status]?.border || CALENDAR_DONE_STATUS.border,
                }}
              >
                {calendarStatusById[item.status]?.label || item.status || CALENDAR_DONE_STATUS.label}
              </span>
              <span className="other-item-desc">{item.description || "无备注"}</span>
              <div className="other-item-actions">
                <button
                  className="row-copy-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    copyCalendarItem(item);
                  }}
                  title="复制这个事项"
                  aria-label={`复制 ${item.title}`}
                >
                  <Copy size={12} />
                </button>
                <button
                  className="row-delete-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteCalendarItem(item.id);
                  }}
                  title="删除这个事项"
                  aria-label={`删除 ${item.title}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {sortedItems.length === 0 && <div className="empty-state">暂无其他事项</div>}
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
          <CopyableControl
            value={record[field.key]}
            label={field.label}
            className="cell-copyable-control"
          >
            <textarea
              className="cell-input cell-textarea"
                  rows={estimateTextRows(record[field.key], field.key)}
              value={record[field.key] ?? ""}
              onFocus={() => setSelectedId(record.id)}
              onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
              aria-label={`${getRecordTitle(record)} ${field.label}`}
            />
          </CopyableControl>
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
          <CopyableControl
            value={record[field.key]}
            label={field.label}
            className="cell-copyable-control"
          >
            <textarea
              className="cell-input cell-textarea"
                  rows={estimateTextRows(record[field.key], field.key)}
              value={record[field.key] ?? ""}
              onFocus={() => setSelectedId(record.id)}
              onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
              aria-label={`${getRecordTitle(record)} ${field.label}`}
            />
          </CopyableControl>
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
                  <CopyIconButton
                    value={trimmed}
                    label="Todo"
                    className="todo-copy-button"
                  />
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
                    <CopyIconButton
                      value={trimmed}
                      label="Todo"
                      className="todo-copy-button"
                    />
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
          <CopyableControl
            value={todoText}
            label={`${getRecordTitle(record)} Todo`}
            className="cell-copyable-control todo-copyable-control"
          >
            <textarea
              className="cell-input cell-textarea todo-new-input"
              rows={1}
              onFocus={() => setSelectedId(record.id)}
              onKeyDown={handleTodoKeydown}
              placeholder="输入待办，回车添加"
              aria-label={`${getRecordTitle(record)} 新增待办`}
            />
          </CopyableControl>
        </div>
      );
    }

    return (
      <CopyableControl
        value={record[field.key]}
        label={field.label}
        className="cell-copyable-control"
      >
        <textarea
          className="cell-input cell-textarea"
          rows={estimateTextRows(record[field.key], field.key)}
          value={record[field.key] ?? ""}
          onFocus={() => setSelectedId(record.id)}
          onChange={(event) => updateRecord(record.id, { [field.key]: event.target.value })}
          aria-label={`${getRecordTitle(record)} ${field.label}`}
        />
      </CopyableControl>
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
              <span>按 1 / 2 / 3 / 4 / 5 / 6 切换数据页，G 打开日历，F 打开知识图谱</span>
              {pageLoadTime && (
                <span className="load-time-badge" title={`页面刷新时间: ${new Date(pageLoadTime).toLocaleTimeString()}`}>
                  已刷新
                </span>
              )}
            </div>
          </div>

          <div className="global-data-actions">
            <button
              className="icon-button global-action data-export"
              type="button"
              onClick={exportJson}
              title="一键导出八个页面的全部数据（含历史记录、知识图谱和日历排期）"
            >
              <Download size={17} />
              <span>一键导出 JSON</span>
            </button>
            <button
              className="icon-button global-action data-csv"
              type="button"
              onClick={exportAllCsv}
              title="一键导出五个数据栏目的全部记录为 CSV"
            >
              <FileDown size={17} />
              <span>导出全部 CSV</span>
            </button>
            <button
              className="icon-button global-action data-import"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="一键导入八个页面的全部数据"
            >
              <Upload size={17} />
              <span>导入 JSON</span>
            </button>
            <button
              className="icon-button global-action cloud-sync"
              type="button"
              onClick={syncDavBackup}
              disabled={backupBusy}
              title="将当前数据库中的最新数据同步到 WebDAV 云端"
            >
              <Upload size={17} />
              <span>同步云端</span>
            </button>
            <button
              className="icon-button global-action cloud-restore"
              type="button"
              onClick={restoreDavBackup}
              disabled={backupBusy}
              title="从 WebDAV 云端最新版本同步到本地数据库"
            >
              <Download size={17} />
              <span>云端同步本地</span>
            </button>
            <button
              className="icon-button global-action config-action"
              type="button"
              onClick={() => {
                setActiveCategoryId(STATUS_CONFIG_PAGE.id);
                setStatusFilter("all");
                setStatusSortDirection("asc");
              }}
              title="打开优先级配置"
            >
              <Settings2 size={17} />
              <span>优先级配置</span>
            </button>
            <button
              className="icon-button global-action calendar-action"
              type="button"
              onClick={() => {
                setActiveCategoryId(CALENDAR_CATEGORY.id);
                setStatusFilter("all");
                setStatusSortDirection("asc");
              }}
              title="打开日历排期"
            >
              <CalendarDays size={17} />
              <span>日历(G)</span>
            </button>
            <button
              className="icon-button global-action graph-action"
              type="button"
              onClick={() => {
                setActiveCategoryId(GRAPH_CATEGORY.id);
                setStatusFilter("all");
                setStatusSortDirection("asc");
              }}
              title="打开知识图谱"
            >
              <Share2 size={17} />
              <span>知识图谱(F)</span>
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

        {(importStatus || serverSaveError) && (
          <div className={`import-toast ${importStatus?.success ? "success" : "error"}`}>
            {importStatus?.message || `数据库保存失败：${serverSaveError}`}
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
        ) : isCalendarView ? (
          <CalendarBoard
            records={records}
            calendarItems={calendarItems}
            statusOptions={calendarStatusOptions}
            updateRecord={updateRecord}
            updateRecordDate={updateRecordDate}
            removeRecordDate={removeRecordDate}
            addCalendarItem={addCalendarItem}
            updateCalendarItem={updateCalendarItem}
            deleteCalendarItem={deleteCalendarItem}
            copyCalendarItem={copyCalendarItem}
            openCalendarItemModal={openCalendarItemModal}
            openRecord={openRecordFromCalendar}
          />
        ) : isOtherItemsView ? (
          renderOtherItems()
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
      {renderCreateModal()}
    </div>
  );
}

export default App;
