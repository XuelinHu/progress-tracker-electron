import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Award,
  BarChart3,
  CalendarDays,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileDown,
  FileText,
  FolderKanban,
  Keyboard,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Save,
  Share2,
  Trophy,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import DateHistoryField from "./components/DateHistoryField.jsx";
import StatusHistoryPopover from "./components/StatusHistoryPopover.jsx";
import PortalPopover from "./components/PortalPopover.jsx";
import CopyIconButton from "./components/CopyIconButton.jsx";
import CopyableControl from "./components/CopyableControl.jsx";
import InlineEditableText from "./components/InlineEditableText.jsx";
import CalendarBoard from "./components/CalendarBoard.jsx";
import KnowledgeGraph from "./components/KnowledgeGraph.jsx";
import StatisticsBoard from "./components/StatisticsBoard.jsx";
import { CATEGORIES, CATEGORY_BY_ID } from "./data/categories.js";
import { seedRecords } from "./data/seed.js";
import { STATUSES } from "./data/statuses.js";
import {
  BASE_RECORD_DEFAULTS,
  RECORD_ITEM_TYPES,
  buildRecordItemsFromLegacy,
  createRecordItem,
  syncTodoItemsLegacy,
  withSyncedRecordItems,
} from "./models/progressRecord.js";

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
const STATISTICS_CATEGORY = {
  id: "statistics",
  name: "统计",
  accent: "#0f766e",
  tint: "#ccfbf1",
};
const STATUS_CONFIG_PAGE = {
  id: "status-config",
  name: "优先级配置",
  shortcut: "8",
  accent: "#2563eb",
  tint: "#dbeafe",
};
const TODO_ITEMS_PAGE = {
  id: "todo-items",
  itemCategoryId: "other",
  name: "Todo事项",
  shortcut: "7",
  accent: "#0f766e",
  tint: "#ccfbf1",
};
const CREATE_ASSIST_HINT =
  "粘贴项目名称、状态、日期、预计耗时、GitHub 地址、路径、Todo 或备注，点击自动识别后会填充到左侧表单。";
const CALENDAR_DONE_STATUS = {
  id: "已完成",
  label: "已完成",
  priority: 990,
  color: "#334155",
  bg: "#e2e8f0",
  border: "#94a3b8",
};
const CALENDAR_ITEM_FIELD_KEYS = [
  "todo",
  "githubUrl",
  "platformUrl",
  "officialUrl",
  "windowsPath",
  "linuxPath",
  "serverPath",
];
const PROJECT_CATEGORY_ID = "project";
const ACTIVITY_CATEGORY_ID = "activity";
const PROJECT_NAVIGATION_ITEM = CATEGORY_BY_ID[PROJECT_CATEGORY_ID]
  ? { ...CATEGORY_BY_ID[PROJECT_CATEGORY_ID], shortcut: "5" }
  : null;
const ACTIVITY_NAVIGATION_ITEM = CATEGORY_BY_ID[ACTIVITY_CATEGORY_ID]
  ? { ...CATEGORY_BY_ID[ACTIVITY_CATEGORY_ID], shortcut: "6" }
  : null;
const TODO_NAVIGATION_ITEM = { ...TODO_ITEMS_PAGE, shortcut: "7" };
const NAVIGATION_ICONS = {
  software: FileCode2,
  patent: Award,
  paper: FileText,
  contest: Trophy,
  project: FolderKanban,
  activity: CalendarDays,
  "todo-items": ListTodo,
};
const NAVIGATION_ITEMS = [
  ...CATEGORIES.filter(
    (category) =>
      category.id !== PROJECT_CATEGORY_ID && category.id !== ACTIVITY_CATEGORY_ID,
  ),
  PROJECT_NAVIGATION_ITEM,
  ACTIVITY_NAVIGATION_ITEM,
  TODO_NAVIGATION_ITEM,
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

function sortTimelineEntries(entries = []) {
  const seen = new Set();
  return [...entries]
    .filter((entry) => entry && (entry.summary || entry.item || entry.date || entry.createdAt))
    .filter((entry) => {
      const key = entry.id || [entry.summary || entry.item, entry.status, entry.createdAt || entry.date].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      String(left.createdAt || left.updatedAt || left.date || "").localeCompare(
        String(right.createdAt || right.updatedAt || right.date || ""),
      ),
    );
}

function normalizeRecord(record) {
  const rawTodo = Array.isArray(record.todoHistory) ? record.todoHistory : [];
  const recordItems = Array.isArray(record.items) ? record.items : [];
  const derivedDateHistory = recordItems
    .filter((item) => item?.type === RECORD_ITEM_TYPES.TODO && item?.sourceField)
    .reduce((groups, item) => {
      const sourceField = item.sourceField;
      groups[sourceField] = [
        ...(groups[sourceField] ?? []),
        {
          id: item.id,
          date: item.date || "",
          item: item.text || "",
          details: item.details || "",
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      ];
      return groups;
    }, {});
  const normalizedStartDate =
    record.startDate || record.registrationDate || record.stageDate || today();
  const normalizedEndDate = record.endDate || normalizedStartDate || today();
  const normalized = {
    ...BASE_RECORD_DEFAULTS,
    ...record,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    history: sortTimelineEntries(Array.isArray(record.history) ? record.history : []),
    dateHistory: Object.keys(derivedDateHistory).length > 0
      ? derivedDateHistory
      : record.dateHistory && typeof record.dateHistory === "object"
        ? record.dateHistory
        : {},
    todoHistory: rawTodo.map((e) => ({
      id: e.id,
      addedDate: e.addedDate || e.date || today(),
      item: e.item || "",
      details: e.details || e.description || record.description || "",
      sourceField: e.sourceField || "",
      doneDate: e.doneDate || (!e.addedDate && e.date ? e.date : null),
      addedAt: e.addedAt || e.createdAt || e.addedDate || e.date || today(),
      doneAt: e.doneAt || null,
      createdAt: e.createdAt || e.addedAt || e.addedDate || e.date || today(),
      updatedAt: e.updatedAt || e.doneAt || e.createdAt || e.addedDate || e.date || today(),
    })),
  };
  return syncTodoItemsLegacy(normalized, buildRecordItemsFromLegacy(normalized));
}

function createHistoryEntry({ date = today(), status = "", summary = "" } = {}) {
  const now = new Date().toISOString();
  return {
    id: createId("history"),
    date,
    status,
    owner: "",
    summary,
    createdAt: now,
    updatedAt: now,
  };
}

function getFieldLabel(record, fieldKey) {
  const category = CATEGORY_BY_ID[record?.categoryId] ?? CATEGORIES[0];
  return category.fields.find((field) => field.key === fieldKey)?.label || fieldKey;
}

function buildAddedTodoHistoryEntries(record, nextTodoHistory = []) {
  const oldIds = new Set((record?.todoHistory ?? []).map((entry) => entry.id).filter(Boolean));
  const oldItems = new Set((record?.todoHistory ?? []).map((entry) => entry.item).filter(Boolean));
  return nextTodoHistory
    .filter((entry) => {
      const item = String(entry?.item ?? "").trim();
      return item && !(entry.id && oldIds.has(entry.id)) && !oldItems.has(item);
    })
    .map((entry) =>
      createHistoryEntry({
        date: entry.addedDate || today(),
        status: record?.status || "",
        summary: `新增Todo：${entry.item}`,
      }),
    );
}

function buildAddedDateHistoryEntries(record, nextDateHistory = {}) {
  const entries = [];
  const oldIds = new Set(
    Object.values(record?.dateHistory ?? {})
      .flatMap((items) => (Array.isArray(items) ? items : []))
      .map((entry) => entry.id)
      .filter(Boolean),
  );

  Object.entries(nextDateHistory ?? {}).forEach(([fieldKey, items]) => {
    if (!Array.isArray(items)) {
      return;
    }
    items.forEach((entry) => {
      if (entry?.id && oldIds.has(entry.id)) {
        return;
      }
      const item = String(entry?.item ?? "").trim();
      entries.push(
        createHistoryEntry({
          date: today(),
          status: record?.status || "",
          summary: `新增${getFieldLabel(record, fieldKey)}事项：${item || entry?.date || "未填写事项"}`,
        }),
      );
    });
  });

  return entries;
}

function appendRecordHistory(record, entries = []) {
  const usefulEntries = entries.filter((entry) => String(entry.summary ?? "").trim());
  if (usefulEntries.length === 0) {
    return record;
  }
  return {
    ...record,
    history: [...(record.history ?? []), ...usefulEntries],
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
    !hasText(record.startDate) &&
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
        .map((item) => {
          const normalized = {
            id: String(item?.id || createId("calendar-item")),
            date: String(item?.date || ""),
            startDate: String(item?.startDate || item?.date || today()),
            endDate: String(item?.endDate || item?.startDate || item?.date || today()),
            title: String(item?.title || "其他事项"),
            description: String(item?.description || ""),
            categoryId: item?.categoryId === "problem" ? "other" : item?.categoryId || "other",
            itemType: "todo",
            status: item?.status || CALENDAR_DONE_STATUS.id,
            recordId: String(item?.recordId || ""),
            todoId: String(item?.todoId || ""),
            durationMinutes: normalizeDurationMinutes(item?.durationMinutes),
            distanceKm: normalizeDistanceKm(item?.distanceKm),
            history: sortTimelineEntries([
              ...(Array.isArray(item?.history) ? item.history : []),
              ...(item?.categoryId === "problem"
                ? [{
                    id: `history-migrate-${item?.id || "legacy"}`,
                    date: String(item?.createdAt || item?.date || today()).slice(0, 10),
                    status: item?.status || "",
                    summary: "问题记录已合并为Todo事项",
                    createdAt: item?.createdAt || item?.date || new Date().toISOString(),
                    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
                  }]
                : []),
            ]),
            createdAt: item?.createdAt || new Date().toISOString(),
            updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
          };
          for (const key of CALENDAR_ITEM_FIELD_KEYS) {
            normalized[key] = String(item?.[key] ?? "");
          }
          return normalized;
        })
        .filter((item) => item.title)
    : [];
}

function normalizeDurationMinutes(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    return "";
  }
  const minutes = Number.parseInt(raw, 10);
  return Number.isFinite(minutes) && minutes > 0 ? String(minutes) : "";
}

function normalizeDistanceKm(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return "";
  }
  const distance = Number.parseFloat(raw);
  return Number.isFinite(distance) && distance > 0 ? String(distance) : "";
}

function isDistanceActivity(categoryId, title) {
  return categoryId === ACTIVITY_CATEGORY_ID && /骑行|游泳/.test(String(title ?? ""));
}

function getCalendarItemSharedFields(source = {}) {
  return Object.fromEntries(
    CALENDAR_ITEM_FIELD_KEYS.map((key) => [key, String(source?.[key] ?? "")]),
  );
}

function getCalendarItemPage(categoryId) {
  return TODO_ITEMS_PAGE;
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
  return Math.min(3, Math.max(2, inferredRows));
}

function itemAddedDate(item, fallback = "") {
  return String(item?.addedAt || item?.createdAt || item?.addedDate || fallback || "").slice(0, 10);
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

function buildDisplayFields(fields) {
  if (!Array.isArray(fields) || fields.length < 7) {
    return fields;
  }
  const mergeStartIndex = fields.length === 7 ? 5 : 6;
  const firstField = fields[mergeStartIndex];
  const secondField = fields[mergeStartIndex + 1];
  if (!firstField || !secondField) {
    return fields;
  }
  const tailFields = fields.slice(mergeStartIndex + 2);
  const shouldHideTail =
    tailFields.length === 1 &&
    ((firstField.type === "path" && secondField.type === "path" && tailFields[0].type === "path") ||
      (firstField.type === "url" && secondField.type === "url" && tailFields[0].type === "url"));
  return [
    ...fields.slice(0, mergeStartIndex),
    {
      key: `combined-${firstField.key}-${secondField.key}`,
      type: "combined",
      label: `${firstField.label} / ${secondField.label}`,
      width: "minmax(360px, 1.2fr)",
      fields: [firstField, secondField],
      displayLabel: `${mergeStartIndex + 1}/${mergeStartIndex + 2}. ${firstField.label} / ${secondField.label}`,
    },
    ...(shouldHideTail ? [] : tailFields),
  ];
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusSortDirection, setStatusSortDirection] = useState("asc");
  const [dateSortKey, setDateSortKey] = useState(null);
  const [dateSortDirection, setDateSortDirection] = useState("none");
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
  const operationStatusTimerRef = useRef(null);

  const isGraphView = activeCategoryId === GRAPH_CATEGORY.id;
  const isCalendarView = activeCategoryId === CALENDAR_CATEGORY.id;
  const isStatisticsView = activeCategoryId === STATISTICS_CATEGORY.id;
  const isTodoItemsView = activeCategoryId === TODO_ITEMS_PAGE.id;
  const isStatusConfigView = activeCategoryId === STATUS_CONFIG_PAGE.id;
  const activeCategory = CATEGORY_BY_ID[activeCategoryId] ?? CATEGORIES[0];
  const activeNavigationItem = isGraphView
    ? GRAPH_CATEGORY
    : isCalendarView
      ? CALENDAR_CATEGORY
      : isStatisticsView
        ? STATISTICS_CATEGORY
        : isTodoItemsView
          ? TODO_ITEMS_PAGE
          : isStatusConfigView
            ? STATUS_CONFIG_PAGE
            : activeCategory;
  const displayFields = useMemo(
    () => buildDisplayFields(activeCategory.fields).filter((field) => field.type !== "status"),
    [activeCategory.fields],
  );
  const tableTemplate = ["126px", ...displayFields.map((field) => field.width)].join(" ");
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
  const calendarQuickStatuses = useMemo(() => {
    const pickStatus = (label, fallback) =>
      calendarStatusOptions.find((status) => status.label === label || status.id === label) ?? fallback;
    return [
      pickStatus("进行中", {
        id: "进行中",
        label: "进行中",
        color: "#92400e",
        bg: "#fef3c7",
        border: "#f59e0b",
      }),
      pickStatus("已完成", CALENDAR_DONE_STATUS),
      pickStatus("结束", {
        id: "结束",
        label: "结束",
        color: "#44403c",
        bg: "#f5f5f4",
        border: "#a8a29e",
      }),
    ];
  }, [calendarStatusOptions]);
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
        record.githubUrl,
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

    if (dateSortKey && dateSortDirection !== "none") {
      return [...filteredRecords].sort((left, right) => {
        const leftDate = String(left[dateSortKey] ?? "");
        const rightDate = String(right[dateSortKey] ?? "");
        const orderDiff =
          leftDate.localeCompare(rightDate) ||
          String(left.title ?? "").localeCompare(String(right.title ?? ""), "zh-Hans-CN");
        return dateSortDirection === "asc" ? orderDiff : -orderDiff;
      });
    }

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
    dateSortKey,
    dateSortDirection,
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
    return getDefaultStatusId();
  }

  function resetTableSort() {
    setStatusSortDirection("asc");
    setDateSortKey(null);
    setDateSortDirection("none");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadServerState() {
      try {
        const response = await fetch("/api/state");
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || data.source !== "postgresql") {
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
      const requestId = globalThis.crypto?.randomUUID?.() || `save-${Date.now()}`;
      const payload = buildFullDataPayload();
      const summary = {
        records: payload.records?.length || 0,
        calendarItems: payload.calendarItems?.length || 0,
        graphNodes: payload.graph?.nodes?.length || 0,
        graphEdges: payload.graph?.edges?.length || 0,
      };
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json", "x-request-id": requestId },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || data.source !== "postgresql") {
          const error = new Error(data.error || `写入数据库状态失败（HTTP ${response.status}）`);
          error.status = response.status;
          throw error;
        }
        setServerSaveError("");
      } catch (error) {
        const message = error.message || "写入数据库状态失败";
        console.error("Database state save failed", { requestId, message, status: error.status || 0, summary });
        setServerSaveError(`${message}（请求 ${requestId}）`);
        fetch("/api/client-log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            level: "error",
            event: "state.save.failure",
            requestId,
            status: error.status || 0,
            message,
            summary,
          }),
          keepalive: true,
        }).catch(() => {});
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
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

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
        resetTableSort();
        return;
      }
      if (shortcut === "f") {
        setActiveCategoryId(GRAPH_CATEGORY.id);
        setStatusFilter("all");
        resetTableSort();
        return;
      }
      if (shortcut === "t") {
        setActiveCategoryId(STATISTICS_CATEGORY.id);
        setStatusFilter("all");
        resetTableSort();
        return;
      }

      const category = NAVIGATION_ITEMS.find((item) => item.shortcut === event.key);
      if (category) {
        setActiveCategoryId(category.id);
        setStatusFilter("all");
        resetTableSort();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    setPageLoadTime(Date.now());
  }, []);

  function updateRecord(recordId, patch) {
    const sourceRecord = records.find((record) => record.id === recordId);
    const statusChanged = Boolean(
      sourceRecord && patch.status && patch.status !== sourceRecord.status,
    );
    const previousStatusLabel = statusChanged
      ? statusById[sourceRecord.status]?.label || sourceRecord.status || "未设置"
      : "";
    const nextStatusLabel = statusChanged
      ? statusById[patch.status]?.label || patch.status
      : "";
    const statusTodoText = statusChanged
      ? `状态变更：${previousStatusLabel} -> ${nextStatusLabel}`
      : "";
    const statusTodo = statusChanged
      ? createRecordItem({
          id: createId("todo-status"),
          recordId,
          type: RECORD_ITEM_TYPES.TODO,
          text: statusTodoText,
          date: today(),
          status: "done",
          doneDate: today(),
          doneAt: new Date().toISOString(),
        })
      : null;
    if (statusTodo && sourceRecord) {
      addCalendarItem(today(), {
        title: statusTodo.text,
        categoryId: sourceRecord.categoryId,
        status: CALENDAR_DONE_STATUS.id,
        recordId: sourceRecord.id,
        todoId: statusTodo.id,
      });
    }
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const nextRecord = {
          ...record,
          ...patch,
        };
        if (statusTodo) {
          nextRecord.history = sortTimelineEntries([
            ...(record.history ?? []).filter(
              (entry) => !(entry.date === today() && entry.summary === statusTodoText),
            ),
            createHistoryEntry({
              date: today(),
              status: patch.status,
              summary: statusTodoText,
            }),
          ]);
          nextRecord.items = [
            ...(record.items ?? buildRecordItemsFromLegacy(record)),
            statusTodo,
          ];
        }

        const syncedRecord = statusTodo
          ? syncTodoItemsLegacy(nextRecord, nextRecord.items)
          : nextRecord;
        return normalizeRecord(
          appendRecordHistory(syncedRecord, [
            ...(Array.isArray(patch.todoHistory)
              ? buildAddedTodoHistoryEntries(record, patch.todoHistory)
              : []),
            ...(patch.dateHistory
              ? buildAddedDateHistoryEntries(record, patch.dateHistory)
              : []),
          ]),
        );
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

        const nextItems = [
          ...(record.items ?? buildRecordItemsFromLegacy(record)),
          createRecordItem({
            id: historyId,
            recordId: record.id,
            type: RECORD_ITEM_TYPES.TODO,
            text: item,
            details: item,
            date,
            sourceField: fieldKey,
          }),
        ];
        const dateHistory = record.dateHistory ?? {};
        return syncTodoItemsLegacy({
          ...record,
          history: [
            ...(record.history ?? []),
            createHistoryEntry({
              date: today(),
              status: record.status || "",
              summary: `新增${getFieldLabel(record, fieldKey)}事项：${item || date || "未填写事项"}`,
            }),
          ],
          [fieldKey]: date,
          dateHistory: {
            ...dateHistory,
            [fieldKey]: [
              ...(dateHistory[fieldKey] ?? []),
              {
                id: historyId,
                date,
                item,
                details: item,
              },
            ],
          },
        }, nextItems);
      }),
    );
    return historyId;
  }

  function removeRecordDate(recordId, fieldKey, date, historyId = "") {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const dateHistory = record.dateHistory ?? {};
        const nextHistory = historyId
          ? (dateHistory[fieldKey] ?? []).filter((entry) => entry.id !== historyId)
          : (dateHistory[fieldKey] ?? []).filter((entry) => entry.date !== date);
        const shouldClearDate = record[fieldKey] === date && (!historyId || historyId.endsWith("-primary"));
        const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).filter((entry) => {
          if (entry.type !== RECORD_ITEM_TYPES.TODO || entry.sourceField !== fieldKey) {
            return true;
          }
          return historyId ? entry.id !== historyId : entry.date !== date;
        });
        return syncTodoItemsLegacy({
          ...record,
          [fieldKey]: shouldClearDate ? "" : record[fieldKey],
          dateHistory: {
            ...dateHistory,
            [fieldKey]: nextHistory,
          },
        }, nextItems);
      }),
    );
  }

  function addCalendarItem(date, draft = {}) {
    const title = String(draft.title ?? "").trim();
    if (!title) {
      return;
    }
    const usesDistance = isDistanceActivity(draft.categoryId, title);
    setCalendarItems((current) => [
      ...current,
      {
        id: createId("calendar-item"),
        date: date || "",
        startDate: draft.startDate || today(),
        endDate: draft.endDate || draft.startDate || today(),
        title,
        description: String(draft.description ?? ""),
        categoryId: draft.categoryId || "other",
        status: draft.status || CALENDAR_DONE_STATUS.id,
        recordId: String(draft.recordId || ""),
        todoId: String(draft.todoId || ""),
        durationMinutes: normalizeDurationMinutes(draft.durationMinutes),
        distanceKm: usesDistance ? normalizeDistanceKm(draft.distanceKm || "1") : "",
        history: [
          createHistoryEntry({
            date: today(),
            status: draft.status || CALENDAR_DONE_STATUS.id,
            summary: `新增事项：${title}`,
          }),
        ],
        ...getCalendarItemSharedFields(draft),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  }

  function updateCalendarItem(itemId, patch) {
    const linkedItem = calendarItems.find((item) => item.id === itemId);
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
              status: patch.status || item.status || CALENDAR_DONE_STATUS.id,
              durationMinutes:
                patch.durationMinutes === undefined
                  ? normalizeDurationMinutes(item.durationMinutes)
                  : normalizeDurationMinutes(patch.durationMinutes),
              distanceKm: isDistanceActivity(
                patch.categoryId || item.categoryId,
                patch.title === undefined ? item.title : patch.title,
              )
                ? normalizeDistanceKm(patch.distanceKm === undefined ? item.distanceKm || "1" : patch.distanceKm || "1")
                : "",
              categoryId: patch.categoryId || item.categoryId || "other",
              recordId: patch.recordId === undefined ? item.recordId || "" : String(patch.recordId || ""),
              todoId: patch.todoId === undefined ? item.todoId || "" : String(patch.todoId || ""),
              history: Array.isArray(item.history) ? item.history : [],
              date: patch.date === undefined ? item.date || "" : patch.date || "",
              startDate:
                patch.startDate === undefined ? item.startDate || today() : patch.startDate || today(),
              endDate:
                patch.endDate === undefined
                  ? item.endDate || item.startDate || today()
                  : patch.endDate || patch.startDate || item.startDate || today(),
              ...Object.fromEntries(
                CALENDAR_ITEM_FIELD_KEYS.map((key) => [
                  key,
                  patch[key] === undefined ? String(item[key] ?? "") : String(patch[key] ?? ""),
                ]),
              ),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    if (linkedItem?.recordId && linkedItem.todoId && (patch.title !== undefined || patch.status !== undefined)) {
      const completed = patch.status === "已完成" || patch.status === "结束";
      const changedAt = new Date().toISOString();
      setRecords((current) =>
        current.map((record) => {
          if (record.id !== linkedItem.recordId) return record;
          const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).map((entry) =>
            entry.type === RECORD_ITEM_TYPES.TODO && entry.id === linkedItem.todoId
              ? {
                  ...entry,
                  text: patch.title === undefined ? entry.text : String(patch.title || "").trim() || entry.text,
                  status: patch.status === undefined ? entry.status : completed ? "done" : "active",
                  doneDate: patch.status === undefined ? entry.doneDate : completed ? today() : null,
                  doneAt: patch.status === undefined ? entry.doneAt : completed ? changedAt : null,
                  updatedAt: changedAt,
                }
              : entry,
          );
          return syncTodoItemsLegacy(record, nextItems);
        }),
      );
    }
  }

  function deleteCalendarItem(itemId) {
    const linkedItem = calendarItems.find((item) => item.id === itemId);
    setCalendarItems((current) => current.filter((item) => item.id !== itemId));
    if (linkedItem?.recordId && linkedItem.todoId) {
      setRecords((current) =>
        current.map((record) => {
          if (record.id !== linkedItem.recordId) return record;
          const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).filter(
            (entry) => entry.type !== RECORD_ITEM_TYPES.TODO || entry.id !== linkedItem.todoId,
          );
          return syncTodoItemsLegacy(record, nextItems);
        }),
      );
    }
  }

  function copyCalendarItem(item) {
    if (!item?.title) {
      return;
    }
    openCalendarItemModal(item.date || "", {
      title: item.title,
      description: item.description,
      categoryId: item.categoryId,
      status: item.status || CALENDAR_DONE_STATUS.id,
      durationMinutes: normalizeDurationMinutes(item.durationMinutes),
      distanceKm: normalizeDistanceKm(item.distanceKm),
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      ...getCalendarItemSharedFields(item),
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
      status: CALENDAR_DONE_STATUS.id,
    });
    setOtherItemDraft((current) => ({
      ...current,
      title: "",
      description: "",
    }));
  }

  function buildCalendarItemDraft(date = today(), overrides = {}) {
    const defaultDate = date || today();
    return {
      date: defaultDate,
      startDate: defaultDate,
      endDate: defaultDate,
      title: "",
      description: "",
      categoryId: "other",
      status: CALENDAR_DONE_STATUS.id,
      durationMinutes: "30",
      distanceKm: "",
      ...getCalendarItemSharedFields(overrides),
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
      date: date || "",
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
          status: CALENDAR_DONE_STATUS.id,
          date: today(),
          startDate: today(),
          endDate: today(),
          title: "今天要处理的事项",
          durationMinutes: "30",
          todo: "待办事项1\n待办事项2",
          platformUrl: "https://example.com/platform",
          officialUrl: "https://example.com/official",
          githubUrl: "https://github.com/example/project",
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
          status: CALENDAR_DONE_STATUS.id,
          date: today(),
          startDate: today(),
          endDate: today(),
          title: "完成铁路数据清洗",
          durationMinutes: "45",
          todo: "核对异常样本\n记录未完成原因",
          platformUrl: "https://example.com/platform",
          officialUrl: "https://example.com/official",
          githubUrl: "https://github.com/XuelinHu/railway-example-project",
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
        example.githubUrl = "https://github.com/XuelinHu/railway-example-project";
      } else if (field.key === "description") {
        example[field.key] = `${category.name}示例项目说明`;
      } else if (field.key === "todo") {
        example[field.key] = "整理需求\n补充 README\n提交 GitHub";
      } else if (field.key === "serverPath" || field.key === "linuxPath") {
        example[field.key] = "/ds1/workspace/ai/railway-example-project";
      } else if (field.key === "windowsPath") {
        example[field.key] = "D:\\workspace\\ai\\railway-example-project";
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
          { key: "startDate", label: "开始日期", type: "date" },
          { key: "endDate", label: "结束日期", type: "date" },
          { key: "title", label: "事项名称", type: "text" },
          { key: "durationMinutes", label: "预计耗时", type: "number" },
          { key: "description", label: "注意事项", type: "textarea" },
          { key: "todo", label: "Todo", type: "textarea" },
          { key: "githubUrl", label: "仓库地址", type: "url" },
          { key: "platformUrl", label: "平台网址", type: "url" },
          { key: "officialUrl", label: "官网", type: "url" },
          { key: "windowsPath", label: "Windows路径", type: "path" },
          { key: "linuxPath", label: "Linux路径", type: "path" },
          { key: "serverPath", label: "服务器绝对路径", type: "path" },
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
      patch.startDate =
        extractLabeledValue(lines, ["开始日期", "开始时间", "startDate"]) ||
        createDraft.startDate ||
        "";
      patch.endDate =
        extractLabeledValue(lines, ["结束日期", "结束时间", "endDate"]) ||
        createDraft.endDate ||
        "";
      patch.title =
        extractLabeledValue(lines, ["事项", "标题", "名称", "title"]) ||
        createDraft.title ||
        lines[0] ||
        "";
      patch.description =
        extractLabeledValue(lines, ["备注", "说明", "注意事项", "todo", "description"]) ||
        createDraft.description ||
        lines.slice(1).join("\n");
      patch.todo =
        extractLabeledValue(lines, ["Todo", "todo", "待办", "待办事项"]) ||
        createDraft.todo ||
        "";
      const duration =
        extractLabeledValue(lines, ["预计耗时", "耗时", "分钟", "durationMinutes", "duration"]) ||
        text.match(/(?:预计耗时|耗时)\s*[:：=]?\s*(\d+)\s*分钟?/i)?.[1] ||
        text.match(/\b(\d+)\s*分钟\b/)?.[1] ||
        "";
      if (duration) {
        patch.durationMinutes = normalizeDurationMinutes(duration);
      }
      if (urls.length > 0) {
        patch.githubUrl =
          extractLabeledValue(lines, ["GitHub", "GitHub地址", "仓库地址", "githubUrl"]) ||
          urls.find((url) => url.toLowerCase().includes("github.com")) ||
          createDraft.githubUrl ||
          "";
        patch.platformUrl =
          extractLabeledValue(lines, ["平台网址", "平台链接", "platformUrl"]) ||
          urls[0] ||
          createDraft.platformUrl ||
          "";
        patch.officialUrl =
          extractLabeledValue(lines, ["官网", "官方页面", "officialUrl"]) ||
          urls[1] ||
          createDraft.officialUrl ||
          "";
      }
      if (paths.length > 0) {
        patch.windowsPath =
          extractLabeledValue(lines, ["Windows路径", "windowsPath"]) ||
          paths.find((path) => /^[A-Za-z]:\\/.test(path)) ||
          createDraft.windowsPath ||
          "";
        const unixPaths = paths.filter((path) => path.startsWith("/"));
        patch.linuxPath =
          extractLabeledValue(lines, ["Linux路径", "linuxPath"]) ||
          unixPaths[0] ||
          createDraft.linuxPath ||
          "";
        patch.serverPath =
          extractLabeledValue(lines, ["服务器绝对路径", "服务器路径", "serverPath"]) ||
          unixPaths[1] ||
          createDraft.serverPath ||
          "";
      }
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
          date: createDraft.date || "",
          title,
          description: String(createDraft.description ?? "").trim(),
          categoryId: createDraft.categoryId || "other",
          status: createDraft.status || CALENDAR_DONE_STATUS.id,
          durationMinutes: normalizeDurationMinutes(createDraft.durationMinutes),
          distanceKm: isDistanceActivity(createDraft.categoryId, title)
            ? normalizeDistanceKm(createDraft.distanceKm || "1")
            : "",
          startDate: createDraft.startDate || today(),
          endDate: createDraft.endDate || createDraft.startDate || today(),
          ...getCalendarItemSharedFields(createDraft),
        });
      } else {
        addCalendarItem(createDraft.date || "", {
          title,
          description: String(createDraft.description ?? "").trim(),
          categoryId: createDraft.categoryId || "other",
          status: createDraft.status || CALENDAR_DONE_STATUS.id,
          durationMinutes: normalizeDurationMinutes(createDraft.durationMinutes),
          distanceKm: isDistanceActivity(createDraft.categoryId, title)
            ? normalizeDistanceKm(createDraft.distanceKm || "1")
            : "",
          startDate: createDraft.startDate || today(),
          endDate: createDraft.endDate || createDraft.startDate || today(),
          ...getCalendarItemSharedFields(createDraft),
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
        const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).map((entry) =>
          entry.id === historyId && entry.type === RECORD_ITEM_TYPES.TODO
            ? { ...entry, text: item, details: item, updatedAt: new Date().toISOString() }
            : entry,
        );
        return syncTodoItemsLegacy({
          ...record,
          dateHistory: {
            ...dateHistory,
            [fieldKey]: (dateHistory[fieldKey] ?? []).map((entry) =>
              entry.id === historyId ? { ...entry, item } : entry,
            ),
          },
        }, nextItems);
      }),
    );
  }

  function syncLinkedTodoCalendarItems(record, todoItems) {
    setCalendarItems((current) => {
      const retained = current.filter((item) => item.recordId !== record.id || !item.todoId);
      const existingByTodoId = new Map(
        current
          .filter((item) => item.recordId === record.id && item.todoId)
          .map((item) => [item.todoId, item]),
      );
      const linkedItems = todoItems.map((todoItem) => {
        const existing = existingByTodoId.get(todoItem.id);
        const completed = Boolean(todoItem.doneDate);
        const now = new Date().toISOString();
        return {
          ...(existing ?? {}),
          id: existing?.id || createId("calendar-item"),
          recordId: record.id,
          todoId: todoItem.id,
          date: existing?.date || todoItem.date || today(),
          startDate: existing?.startDate || todoItem.date || today(),
          endDate: existing?.endDate || todoItem.date || today(),
          title: todoItem.text,
          description: existing?.description ?? "",
          categoryId: record.categoryId || "other",
          status: completed ? CALENDAR_DONE_STATUS.id : "进行中",
          durationMinutes: normalizeDurationMinutes(existing?.durationMinutes),
          distanceKm: normalizeDistanceKm(existing?.distanceKm),
          history: Array.isArray(existing?.history)
            ? existing.history
            : [
                createHistoryEntry({
                  date: todoItem.date || today(),
                  status: completed ? CALENDAR_DONE_STATUS.id : "进行中",
                  summary: `由 Todo 自动生成：${todoItem.text}`,
                }),
              ],
          ...getCalendarItemSharedFields(existing),
          createdAt: existing?.createdAt || todoItem.createdAt || now,
          updatedAt: now,
        };
      });
      return [...retained, ...linkedItems];
    });
  }

  function syncTodoItems(recordId, todoText) {
    const lines = (todoText ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sourceRecord = records.find((record) => record.id === recordId);
    if (!sourceRecord) return;
    const oldHistory = sourceRecord.todoHistory ?? [];
    const oldById = new Map(oldHistory.map((entry) => [entry.item, entry]));
    const nextItems = lines.map((item) => {
      const existing = oldById.get(item);
      return createRecordItem({
        id: existing?.id || createId("todo-hist"),
        recordId: sourceRecord.id,
        type: RECORD_ITEM_TYPES.TODO,
        text: item,
        date: existing?.addedDate || today(),
        status: existing?.doneDate ? "done" : "active",
        doneDate: existing?.doneDate || null,
        doneAt: existing?.doneAt || null,
        details: existing?.details || sourceRecord.description || "",
        sourceField: existing?.sourceField || "",
        createdAt: existing?.createdAt || existing?.addedAt || existing?.addedDate,
        updatedAt: existing?.updatedAt,
      });
    });
    syncLinkedTodoCalendarItems(sourceRecord, nextItems);
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const nextTodoHistory = nextItems.map((item) => ({
          id: item.id,
          addedDate: item.date || "",
          item: item.text,
          doneDate: item.doneDate || null,
          addedAt: item.createdAt,
          doneAt: item.doneAt || null,
          details: item.details || "",
          sourceField: item.sourceField || "",
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
        return syncTodoItemsLegacy(
          appendRecordHistory(record, buildAddedTodoHistoryEntries(record, nextTodoHistory)),
          nextItems,
        );
      }),
    );
  }

  function toggleTodoItem(recordId, lineText) {
    const text = lineText.trim();
    if (!text) return;
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const changedAt = new Date().toISOString();
        const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).map((entry) =>
          entry.type === RECORD_ITEM_TYPES.TODO && entry.text === text
            ? {
                ...entry,
                status: entry.doneDate ? "active" : "done",
                doneDate: entry.doneDate ? null : today(),
                doneAt: entry.doneDate ? null : changedAt,
                updatedAt: changedAt,
              }
            : entry,
        );
        return syncTodoItemsLegacy(record, nextItems);
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
        const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).filter(
          (entry) => entry.type !== RECORD_ITEM_TYPES.TODO || entry.text !== text,
        );
        return syncTodoItemsLegacy({ ...record, todo: newText }, nextItems);
      }),
    );
  }

  function deleteDateHistoryItem(recordId, fieldKey, historyId) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const dateHistory = record.dateHistory ?? {};
        const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).filter(
          (entry) => entry.id !== historyId || entry.type !== RECORD_ITEM_TYPES.TODO,
        );
        return syncTodoItemsLegacy({
          ...record,
          dateHistory: {
            ...dateHistory,
            [fieldKey]: (dateHistory[fieldKey] ?? []).filter((e) => e.id !== historyId),
          },
        }, nextItems);
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
            entry.id === historyId ? { ...entry, summary, updatedAt: new Date().toISOString() } : entry,
          ),
        };
      }),
    );
  }

  function deleteTodoHistoryItem(recordId, historyId) {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).filter(
          (entry) => entry.id !== historyId || entry.type !== RECORD_ITEM_TYPES.TODO,
        );
        return syncTodoItemsLegacy({
          ...record,
          todoHistory: (record.todoHistory ?? []).filter((e) => e.id !== historyId),
        }, nextItems);
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
        const nextItems = (record.items ?? buildRecordItemsFromLegacy(record)).map((entry) =>
          entry.id === historyId && entry.type === RECORD_ITEM_TYPES.TODO
            ? { ...entry, text: item, updatedAt: new Date().toISOString() }
            : entry,
        );
        return {
          ...syncTodoItemsLegacy(record, nextItems),
          todo,
          todoHistory: (record.todoHistory ?? []).map((entry) =>
            entry.id === historyId ? { ...entry, item, updatedAt: new Date().toISOString() } : entry,
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
          createHistoryEntry({
            date: today(),
            status: defaultStatus,
            summary: `新建科研元素：${category.name}新记录`,
          }),
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
    const category = CATEGORY_BY_ID[record.categoryId] ?? CATEGORIES[0];
    const recordHistory = Array.isArray(record.history) && record.history.length > 0
      ? record.history
      : [
          createHistoryEntry({
            date: today(),
            status: record.status || getDefaultStatusId(),
            summary: `新建科研元素：${category.name}${String(record.title ?? "").trim() || "未命名记录"}`,
          }),
        ];
    const normalizedRecord = normalizeRecord({
      ...record,
      history: recordHistory,
      title: String(record.title ?? "").trim() || "未命名记录",
      todo: String(record.todo ?? "").trim(),
    });
    setRecords((current) => [normalizedRecord, ...current]);
    const todoItems = (normalizedRecord.items ?? []).filter(
      (item) => item.type === RECORD_ITEM_TYPES.TODO && item.text,
    );
    if (todoItems.length > 0) {
      syncLinkedTodoCalendarItems(normalizedRecord, todoItems);
    }
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
      items: [],
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
    resetTableSort();
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
    setDateSortKey(null);
    setDateSortDirection("none");
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

  function cycleDateSort(fieldKey) {
    setStatusSortDirection("none");
    setDateSortKey((currentKey) => {
      if (currentKey !== fieldKey) {
        setDateSortDirection("asc");
        return fieldKey;
      }
      setDateSortDirection((currentDirection) => {
        if (currentDirection === "none") {
          return "asc";
        }
        if (currentDirection === "asc") {
          return "desc";
        }
        return "none";
      });
      return fieldKey;
    });
  }

  function getDateSortTitle(field) {
    if (dateSortKey !== field.key || dateSortDirection === "none") {
      return `点击按${field.label}排序`;
    }
    return dateSortDirection === "asc"
      ? `${field.label}升序，点击切换为降序`
      : `${field.label}降序，点击取消排序`;
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
    resetTableSort();
  }

  function buildFullDataPayload() {
    return {
      version: 7,
      exportedAt: new Date().toISOString(),
      scope: "pages-1-8",
      includes: [
        "software",
        "patent",
        "paper",
        "contest",
        "graph",
        "calendar",
        "project",
        "problem",
        "activity",
        "other",
        "status-config",
      ],
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
    resetTableSort();
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
    { key: "startDate", label: "开始日期" },
    { key: "endDate", label: "结束日期" },
    { key: "description", label: "中文解释" },
    { key: "stageDate", label: "阶段日期" },
    { key: "registrationDate", label: "报名日期" },
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
    const exportFields = activeCategory.fields.flatMap((field) =>
      field.key === "title"
        ? [field, { key: "githubUrl", label: "GitHub地址" }]
        : [field],
    );
    const rows = [
      [...exportFields.map((field) => field.label), "历史记录数"],
      ...categoryRecords.map((record) => [
        ...exportFields.map((field) => record[field.key]),
        record.history?.length ?? 0,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    downloadBlob(`${activeCategory.name}进度台账.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  }

  function showOperationStatus(success, message, timeout = 4000) {
    window.clearTimeout(operationStatusTimerRef.current);
    setImportStatus({ success, message });
    operationStatusTimerRef.current = window.setTimeout(() => setImportStatus(null), timeout);
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

  async function syncDavBackup() {
    setBackupBusy(true);
    setStatusConfigMessage("");
    try {
      const response = await fetch("/api/dav/sync", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || data.source !== "postgresql") {
        throw new Error(data.error || "WebDAV 同步失败");
      }
      setStatusConfigMessage(
        `已同步到云端：${data.sync?.project || "progress-tracker"}/${data.sync?.latestName || "latest.json"}`,
      );
      showOperationStatus(true, "已同步云端", 2000);
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
      const response = await fetch("/api/dav/restore", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || data.source !== "postgresql" || !data.state) {
        throw new Error(data.error || "读取云端数据失败");
      }
      const { recordCount, graphNodeCount, graphEdgeCount } = applyFullDataPayload(data.state);
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
    const usesDistance = isCalendarItem && isDistanceActivity(createDraft.categoryId, createDraft.title);
    const category = isCalendarItem
      ? getCalendarItemPage(createDraft.categoryId)
      : CATEGORY_BY_ID[createModal.categoryId] ?? CATEGORIES[0];
    const fields = isCalendarItem ? [] : category.fields;
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
              <span>{isCalendarItem ? `新建日历中的${category.name}` : "填写左侧表单，右侧可粘贴文本自动补充"}</span>
            </div>
            <button className="danger-button small" type="button" onClick={closeCreateModal} title="关闭">
              <X size={15} />
            </button>
          </div>

          <div className="create-modal-body">
            <div className={`create-form-fields ${isCalendarItem ? "calendar-item-form" : ""}`}>
              {isCalendarItem ? (
                <>
                  <div className="calendar-status-field">
                    <span>归属类别</span>
                    <div className="calendar-quick-statuses">
                      {[...CATEGORIES, TODO_ITEMS_PAGE].map((item) => {
                        const selected = createDraft.categoryId === item.itemCategoryId || createDraft.categoryId === item.id;
                        const categoryId = item.itemCategoryId || item.id;
                        return (
                          <button
                            key={categoryId}
                            className={`calendar-status-button${selected ? " selected" : ""}`}
                            type="button"
                            onClick={() => updateCreateDraft("categoryId", categoryId)}
                            style={{
                              "--status-bg": item.tint,
                              "--status-color": item.accent,
                              "--status-border": item.accent,
                            }}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="calendar-status-field">
                    <span>默认状态</span>
                    <div className="calendar-quick-statuses">
                      {calendarQuickStatuses.map((status) => {
                        const selected = createDraft.status === status.id;
                        return (
                          <button
                            key={status.id}
                            className={`calendar-status-button${selected ? " selected" : ""}`}
                            type="button"
                            onClick={() => updateCreateDraft("status", status.id)}
                            style={{
                              "--status-bg": status.bg || "#eef2ff",
                              "--status-color": status.color || "#334155",
                              "--status-border": status.border || "#cbd5e1",
                            }}
                          >
                            {status.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="calendar-date-duration-row">
                    {[
                      { key: "date", label: "日期", type: "date" },
                      { key: "startDate", label: "开始日期", type: "date" },
                      { key: "endDate", label: "结束日期", type: "date" },
                      usesDistance
                        ? { key: "distanceKm", label: "距离（公里）", type: "number", step: "0.1" }
                        : { key: "durationMinutes", label: "预计耗时", type: "number", step: "5" },
                    ].map((field) => (
                      <label className="create-field" key={field.key}>
                        <span>{field.label}</span>
                        <input
                          className="form-control create-control"
                          type={field.type}
                          min={field.type === "number" ? field.key === "distanceKm" ? "0.1" : "5" : undefined}
                          step={field.type === "number" ? field.step : undefined}
                          inputMode={field.type === "number" ? "decimal" : undefined}
                          value={createDraft[field.key] ?? ""}
                          onChange={(event) =>
                            updateCreateDraft(
                              field.key,
                              field.type === "number"
                                ? field.key === "distanceKm"
                                  ? event.target.value.replace(/[^\d.]/g, "")
                                  : event.target.value.replace(/\D/g, "")
                                : event.target.value,
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div className="calendar-title-note-row">
                    <label className="create-field">
                      <span>事项名称</span>
                      <input
                        className="form-control create-control"
                        value={createDraft.title ?? ""}
                        onChange={(event) => updateCreateDraft("title", event.target.value)}
                      />
                    </label>
                    <label className="create-field">
                      <span>注意事项</span>
                      <textarea
                        className="form-control create-control create-textarea compact"
                        rows={2}
                        value={createDraft.description ?? ""}
                        onChange={(event) => updateCreateDraft("description", event.target.value)}
                      />
                    </label>
                  </div>

                  <label className="create-field calendar-wide-field">
                    <span>Todo</span>
                    <textarea
                      className="form-control create-control create-textarea"
                      rows={4}
                      value={createDraft.todo ?? ""}
                      onChange={(event) => updateCreateDraft("todo", event.target.value)}
                    />
                  </label>

                  <div className="calendar-project-fields-grid">
                    {[
                      { key: "githubUrl", label: "仓库地址" },
                      { key: "platformUrl", label: "平台网址" },
                      { key: "officialUrl", label: "官网" },
                      { key: "windowsPath", label: "Windows路径" },
                      { key: "linuxPath", label: "Linux路径" },
                      { key: "serverPath", label: "服务器绝对路径" },
                    ].map((field) => (
                      <label className="create-field" key={field.key}>
                        <span>{field.label}</span>
                        <input
                          className="form-control create-control"
                          value={createDraft[field.key] ?? ""}
                          onChange={(event) => updateCreateDraft(field.key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                fields.map((field) => {
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

                if (field.type === "number") {
                  return (
                    <label className="create-field" key={field.key}>
                      <span>{field.label}</span>
                      <input
                        className="form-control create-control"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={createDraft[field.key] ?? ""}
                        onChange={(event) =>
                          updateCreateDraft(field.key, event.target.value.replace(/\D/g, ""))
                        }
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
                })
              )}
              <label className="create-field create-assist-input-field">
                <span>自动识别文本</span>
                <textarea
                  ref={createAssistRef}
                  className="form-control create-assist-textarea"
                  value={createAssistText}
                  onChange={(event) => setCreateAssistText(event.target.value)}
                  placeholder="粘贴项目名称、状态、日期、开始日期、结束日期、预计耗时、GitHub 地址、路径、Todo 或备注"
                />
              </label>
              <button className="icon-button" type="button" onClick={autoFillCreateDraft}>
                <Search size={16} />
                <span>自动识别 / 自动补充</span>
              </button>
            </div>

            <div className="create-assist-panel">
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
              {isCalendarItem && createModal.itemId ? <Save size={16} /> : <Plus size={16} />}
              <span>{isCalendarItem && createModal.itemId ? "更新" : "新增"}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  function renderStatusConfig() {
    const statusColumnSize = Math.ceil(statusDraft.length / 4);
    const statusColumns = Array.from({ length: 4 }, (_, index) =>
      statusDraft.slice(index * statusColumnSize, (index + 1) * statusColumnSize),
    ).filter((column) => column.length > 0);

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

      {statusConfigMessage && <div className="config-message">{statusConfigMessage}</div>}

          <div className="status-config-table">
            {statusColumns.map((column, columnIndex) => (
              <div className="status-config-column" key={`status-column-${columnIndex}`}>
                <div className="status-config-row status-config-head">
                  <span>状态名称</span>
                  <span>优先级</span>
                  <span>文字</span>
                  <span>背景</span>
                  <span>边框</span>
                  <span>预览</span>
                  <span>操作</span>
                </div>
                {column.map((status) => (
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
            ))}
          </div>
      </section>
    );
  }

  function renderCalendarItemPage(page) {
    const sortedItems = calendarItems
      .filter((item) => (item.categoryId || "other") === page.itemCategoryId)
      .sort(
      (left, right) =>
        String(left.date).localeCompare(String(right.date)) ||
        String(left.title).localeCompare(String(right.title), "zh-Hans-CN"),
    );

    return (
      <section className="workspace other-items-page">
        <div className="other-items-header">
          <div>
            <h2>{page.name}</h2>
            <p>管理日历中的{page.name}。这里的新建、复制和删除都会保存到 PostgreSQL。</p>
          </div>
        </div>

        <div className="other-item-form">
          <button
            className="icon-button primary"
            type="button"
            onClick={() => openCalendarItemModal(today(), { categoryId: page.itemCategoryId })}
          >
            <Plus size={16} />
            <span>新增{page.name}</span>
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
              <span className="other-item-desc">
                {[
                  item.distanceKm ? `${item.distanceKm}公里` : item.durationMinutes ? `预计${item.durationMinutes}分钟` : "",
                  item.description || "无备注",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <div className="other-item-actions">
                <button
                  className="row-edit-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCalendarItemModal(item.date, item, { itemId: item.id });
                  }}
                  title="编辑这个事项"
                  aria-label={`编辑 ${item.title}`}
                >
                  <Pencil size={12} />
                </button>
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
          {sortedItems.length === 0 && <div className="empty-state">暂无{page.name}</div>}
        </div>
      </section>
    );
  }

  function renderCell(record, field) {
    if (field.type === "combined") {
      return (
        <div className="combined-field-cell">
          {field.fields.map((childField) => {
            const externalUrl =
              childField.type === "url"
                ? normalizeExternalUrl(record[childField.key])
                : "";
            return (
              <div
                className="combined-field-row"
                key={childField.key}
              >
                <CopyableControl
                  value={record[childField.key]}
                  label={childField.label}
                  className="cell-copyable-control combined-copyable-control"
                  action={
                    childField.type === "url" ? (
                      <button
                        className="url-open-button"
                        type="button"
                        disabled={!externalUrl}
                        onClick={(event) => {
                          event.stopPropagation();
                          openExternalUrl(record[childField.key]);
                        }}
                        title={externalUrl ? `打开${childField.label}` : "没有可打开的网址"}
                        aria-label={`打开 ${getRecordTitle(record)} ${childField.label}`}
                      >
                        <ExternalLink size={10} />
                      </button>
                    ) : null
                  }
                >
                  <textarea
                    className="cell-input cell-textarea combined-field-input"
                    rows={childField.type === "textarea" ? estimateTextRows(record[childField.key], childField.key) : 2}
                    value={record[childField.key] ?? ""}
                    onFocus={() => setSelectedId(record.id)}
                    onChange={(event) =>
                      updateRecord(record.id, { [childField.key]: event.target.value })
                    }
                    aria-label={`${getRecordTitle(record)} ${childField.label}`}
                    placeholder={childField.label}
                  />
                </CopyableControl>
              </div>
            );
          })}
        </div>
      );
    }

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
          showHistory={false}
          label={`${getRecordTitle(record)} ${field.label}`}
          resetKey={`${record.id}-${field.key}`}
          inputClassName="cell-input date-input"
          itemClassName="cell-input date-item-input"
          onFocus={() => setSelectedId(record.id)}
          onDateValueChange={(date) => updateRecord(record.id, { [field.key]: date })}
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
            action={
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
                <ExternalLink size={10} />
              </button>
            }
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

    if (field.key === "title") {
      const githubUrl = normalizeExternalUrl(record.githubUrl);
      return (
        <div className="title-github-cell">
          <CopyableControl
            value={record.title}
            label="项目名称"
            className="cell-copyable-control title-copyable-control"
          >
            <textarea
              className="cell-input cell-textarea"
              rows={estimateTextRows(record.title, "title")}
              value={record.title ?? ""}
              onFocus={() => setSelectedId(record.id)}
              onChange={(event) => updateRecord(record.id, { title: event.target.value })}
              aria-label={`${getRecordTitle(record)} 项目名称`}
            />
          </CopyableControl>
          <CopyableControl
            value={record.githubUrl}
            label="仓库地址"
            className="cell-copyable-control title-copyable-control"
            action={
              <button
                className="url-open-button"
                type="button"
                disabled={!githubUrl}
                onClick={(event) => {
                  event.stopPropagation();
                  openExternalUrl(record.githubUrl);
                }}
                title={githubUrl ? "打开仓库地址" : "没有可打开的网址"}
                aria-label={`打开 ${getRecordTitle(record)} 仓库地址`}
              >
                <ExternalLink size={10} />
              </button>
            }
          >
            <textarea
              className="cell-input cell-textarea title-github-url-input"
              rows={2}
              value={record.githubUrl ?? ""}
              onFocus={() => setSelectedId(record.id)}
              onChange={(event) => updateRecord(record.id, { githubUrl: event.target.value })}
              aria-label={`${getRecordTitle(record)} 仓库地址`}
              placeholder="仓库地址"
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
      const completionRate = lines.length ? Math.round((doneItems.length / lines.length) * 100) : 0;
      return (
        <div className="todo-cell">
          <div className="todo-list">
            {lines.length > 0 && (
              <div
                className="todo-completed-summary"
                title={`已完成 ${doneItems.length} / 共 ${lines.length} 项 Todo，完成率 ${completionRate}%`}
              >
                <strong>已完成 {doneItems.length} / 共 {lines.length} 项 · 完成率 {completionRate}%</strong>
              </div>
            )}
            {activeItems.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              const hist = histByItem.get(trimmed);
              const addedDate = itemAddedDate(hist);
              return (
                <div
                  key={`a-${idx}-${trimmed.substring(0, 12)}`}
                  className="todo-item"
                  title={`添加日期：${addedDate || "未知"}；详情：${hist?.details || "无"}`}
                >
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
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleTodoItem(record.id, trimmed)}
                  />
                  <InlineEditableText
                    value={trimmed}
                    className="todo-text"
                    inputClassName="todo-inline-edit"
                    title={`添加日期：${addedDate || "未知"}；双击编辑`}
                    onCommit={(nextText) => hist?.id && updateTodoHistoryItem(record.id, hist.id, nextText)}
                  />
                  <span className="todo-date">{addedDate}</span>
                </div>
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
                const pw = Math.min(480, vw - 20);
                const ph = Math.min(180, doneItems.length * 28 + 30);
                let left = rect.right + 6;
                let top = rect.top;
                if (left + pw > vw - 10) left = rect.left - pw - 6;
                left = Math.min(Math.max(10, left), vw - pw - 10);
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
                const addedDate = itemAddedDate(hist);
                return (
                  <div
                    key={`d-${idx}-${trimmed.substring(0, 12)}`}
                    className="todo-item done"
                    title={`添加日期：${addedDate || "未知"}；完成日期：${hist?.doneDate || "未知"}；详情：${hist?.details || "无"}`}
                  >
                    <CopyIconButton
                      value={trimmed}
                      label="Todo"
                      className="todo-copy-button"
                    />
                    <input
                      type="checkbox"
                      className="todo-checkbox"
                      checked={true}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleTodoItem(record.id, trimmed)}
                    />
                    <InlineEditableText
                      value={trimmed}
                      className="todo-text"
                      inputClassName="todo-inline-edit"
                      title={`添加日期：${addedDate || "未知"}；完成日期：${hist?.doneDate || "未知"}；双击编辑`}
                      onCommit={(nextText) => hist?.id && updateTodoHistoryItem(record.id, hist.id, nextText)}
                    />
                    <span className="todo-date todo-date-stack">
                      <span>添 {addedDate || "-"}</span>
                      <span>完 {hist?.doneDate || "-"}</span>
                    </span>
                  </div>
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
              <span>按 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 切换数据页</span>
              {pageLoadTime && (
                <span className="load-time-badge" title={`页面刷新时间: ${new Date(pageLoadTime).toLocaleTimeString()}`}>
                  已刷新
                </span>
              )}
            </div>
          </div>

          <div className="global-data-actions">
            <div className="global-data-primary-actions">
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
                resetTableSort();
              }}
              title="打开优先级配置"
            >
              <Settings2 size={17} />
              <span>优先级配置</span>
            </button>
            </div>
            <div className="global-view-actions">
            <button
              className="icon-button global-action calendar-action"
              type="button"
              onClick={() => {
                setActiveCategoryId(CALENDAR_CATEGORY.id);
                setStatusFilter("all");
                resetTableSort();
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
                resetTableSort();
              }}
              title="打开知识图谱"
            >
              <Share2 size={17} />
              <span>知识图谱(F)</span>
            </button>
            <button
              className="icon-button global-action statistics-action"
              type="button"
              onClick={() => {
                setActiveCategoryId(STATISTICS_CATEGORY.id);
                setStatusFilter("all");
                resetTableSort();
              }}
              title="打开完成统计"
            >
              <BarChart3 size={15} />
              <span>统计</span>
            </button>
            </div>
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
          {NAVIGATION_ITEMS.map((category) => {
            const CategoryIcon = NAVIGATION_ICONS[category.id] || ListTodo;
            return (
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
                resetTableSort();
              }}
            >
              <span className="shortcut-key">{category.shortcut}</span>
              <CategoryIcon size={14} />
              <span>{category.name}</span>
              </button>
            );
          })}
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
        ) : isStatisticsView ? (
          <StatisticsBoard
            records={records}
            calendarItems={calendarItems}
            statusOptions={calendarStatusOptions}
          />
        ) : isTodoItemsView ? (
          renderCalendarItemPage(TODO_ITEMS_PAGE)
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

            <button className="icon-button primary toolbar-add" type="button" onClick={addRecord} title="新增记录">
              <Plus size={18} />
              <span>新增</span>
            </button>

            <button className="icon-button toolbar-export" type="button" onClick={exportCategoryCsv} title="导出当前类别 CSV">
              <FileDown size={18} />
              <span>CSV</span>
            </button>

            <button className="icon-button muted toolbar-reset" type="button" onClick={resetRecords} title="恢复默认数据">
              <RotateCcw size={18} />
              <span>重置</span>
            </button>
          </div>

          <div className="status-strip">
            {categoryStats.map((status) => (
              <button
                key={status.id}
                type="button"
                className={`status-chip ${status.id === "已提交系统" ? "status-chip-system" : ""} ${statusFilter === status.id ? "selected" : ""}`}
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
              <div className="table-head action-head">
                <button
                  className={`head-sort-button ${statusSortDirection !== "none" ? "active" : ""}`}
                  type="button"
                  onClick={cycleStatusSort}
                  title={statusSortTitle}
                  aria-label={statusSortTitle}
                >
                  <span>1. 状态</span>
                  <ArrowDownUp size={13} />
                </button>
              </div>
              {displayFields.map((field, index) => (
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
                        {index + 2}. {field.label}
                      </span>
                      <ArrowDownUp size={13} />
                    </button>
                  ) : field.type === "date" ? (
                    <button
                      className={`head-sort-button ${
                        dateSortKey === field.key && dateSortDirection !== "none" ? "active" : ""
                      }`}
                      type="button"
                      onClick={() => cycleDateSort(field.key)}
                      title={getDateSortTitle(field)}
                      aria-label={getDateSortTitle(field)}
                    >
                      <span>
                        {index + 2}. {field.label}
                      </span>
                      <ArrowDownUp size={13} />
                    </button>
                  ) : (
                    <>
                      {field.displayLabel ?? `${index + 2}. ${field.label}`}
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
                    <div className="row-status-control">
                      {renderCell(record, activeCategory.fields.find((field) => field.type === "status"))}
                    </div>
                    <div className="row-action-buttons">
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
                        <Trash2 size={15} />
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
                        <Copy size={15} />
                      </button>
                      <DaysSince
                        dateField={activeCategory.fields.find((field) => field.type === "date")}
                        record={record}
                      />
                    </div>
                  </div>
                  {displayFields.map((field) => (
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
