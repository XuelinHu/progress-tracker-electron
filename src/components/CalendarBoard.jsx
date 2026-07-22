import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus, Save, Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_BY_ID } from "../data/categories.js";
import {
  RECORD_ITEM_TYPES,
  buildRecordItemsFromLegacy,
  createRecordItem,
  syncTodoItemsLegacy,
} from "../models/progressRecord.js";

const DRAG_TYPE = "application/progress-calendar-record";
const CALENDAR_ITEM_DRAG_TYPE = "application/progress-calendar-item";
const TODO_DRAG_TYPE = "application/progress-calendar-todo";
const ACTIVE_STATUS = "进行中";
const DONE_STATUS = "已完成";
const OTHER_CATEGORY = {
  id: "other",
  name: "其他事项",
  accent: "#64748b",
  tint: "#f1f5f9",
};
const PROBLEM_CATEGORY = {
  id: "problem",
  name: "问题记录",
  accent: "#dc2626",
  tint: "#fee2e2",
};

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecordTitle(record) {
  return record?.title?.trim() || "未命名记录";
}

function getPrimaryDateField(record) {
  const category = CATEGORY_BY_ID[record?.categoryId] ?? CATEGORIES[0];
  return category.fields.find((field) => field.type === "date");
}

function getRecordDate(record) {
  const field = getPrimaryDateField(record);
  return field ? record?.[field.key] || "" : "";
}

function getCategory(categoryId) {
  if (categoryId === PROBLEM_CATEGORY.id) {
    return PROBLEM_CATEGORY;
  }
  return CATEGORY_BY_ID[categoryId] ?? OTHER_CATEGORY;
}

function getTodoLines(record) {
  return String(record?.todo ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanScheduleTodoItem(item) {
  return String(item ?? "")
    .replace(/^(今天|日历)事项：/, "")
    .replace(/；预计耗时：\d+分钟$/, "")
    .trim();
}

function buildTodoPatch(record, item, addedDate = today()) {
  const text = String(item ?? "").trim();
  if (!text) {
    return {};
  }
  const lines = getTodoLines(record);
  const todo = lines.includes(text) ? String(record?.todo ?? "") : [...lines, text].join("\n");
  const history = Array.isArray(record?.todoHistory) ? record.todoHistory : [];
  const hasHistory = history.some((entry) => entry.item === text);
  const nextItems = hasHistory
    ? record?.items ?? buildRecordItemsFromLegacy(record)
    : [
        ...(record?.items ?? buildRecordItemsFromLegacy(record)),
        createRecordItem({
          recordId: record?.id,
          type: RECORD_ITEM_TYPES.TODO,
          text,
          date: addedDate,
        }),
      ];
  const synced = syncTodoItemsLegacy({
    ...record,
    todo,
    todoHistory: hasHistory
      ? history
      : [
          ...history,
          {
            id: `todo-hist-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            item: text,
            addedDate,
            doneDate: null,
          },
        ],
  }, nextItems);
  return {
    todo: synced.todo,
    todoHistory: synced.todoHistory,
    items: synced.items,
  };
}

function getCalendarTodoItem(record, dateIso) {
  const prefix = `${dateIso} 日历事项：`;
  const history = Array.isArray(record?.todoHistory) ? record.todoHistory : [];
  const historyItem = history.find((entry) => String(entry.item ?? "").startsWith(prefix));
  if (historyItem?.item) {
    return historyItem.item;
  }
  const todoLine = getTodoLines(record).find((line) => line.startsWith(prefix));
  if (todoLine) {
    return todoLine;
  }
  const historyItems = new Set(history.map((entry) => entry.item));
  const dateHistoryItem = Object.values(record?.dateHistory ?? {})
    .flatMap((entries) => (Array.isArray(entries) ? entries : []))
    .find((entry) => entry.date === dateIso && historyItems.has(cleanScheduleTodoItem(entry.item)))
    ?.item;
  return dateHistoryItem ? cleanScheduleTodoItem(dateHistoryItem) : `${prefix}${getRecordTitle(record)}`;
}

function isCalendarTodoDone(record, item) {
  return (record?.todoHistory ?? []).some((entry) => entry.item === item && entry.doneDate);
}

function normalizeDurationMinutes(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    return "";
  }
  const minutes = Number.parseInt(raw, 10);
  return Number.isFinite(minutes) && minutes > 0 ? String(minutes) : "";
}

function formatScheduleItem(prefix, item, durationMinutes) {
  const duration = normalizeDurationMinutes(durationMinutes);
  return duration ? `${prefix}${item}；预计耗时：${duration}分钟` : `${prefix}${item}`;
}

function buildTodoDonePatch(record, item, dateIso) {
  return buildTodoCompletionPatch(record, item, dateIso, !isCalendarTodoDone(record, item));
}

function buildTodoCompletionPatch(record, item, dateIso, completed) {
  const text = String(item ?? "").trim();
  if (!text) {
    return {};
  }
  const lines = getTodoLines(record);
  const todo = lines.includes(text) ? String(record?.todo ?? "") : [...lines, text].join("\n");
  const history = Array.isArray(record?.todoHistory) ? record.todoHistory : [];
  const hasHistory = history.some((entry) => entry.item === text);
  const doneDate = completed ? dateIso : null;
  const changedAt = new Date().toISOString();
  const nextItems = hasHistory
    ? (record?.items ?? buildRecordItemsFromLegacy(record)).map((entry) =>
        entry.type === RECORD_ITEM_TYPES.TODO && entry.text === text
          ? {
              ...entry,
              status: completed ? "done" : "active",
              doneDate,
              doneAt: completed ? changedAt : null,
              updatedAt: changedAt,
            }
          : entry,
      )
    : [
        ...(record?.items ?? buildRecordItemsFromLegacy(record)),
        createRecordItem({
          recordId: record?.id,
          type: RECORD_ITEM_TYPES.TODO,
          text,
          date: dateIso,
          status: completed ? "done" : "active",
          doneDate,
        }),
      ];
  const synced = syncTodoItemsLegacy({
    ...record,
    todo,
    todoHistory: hasHistory
      ? history.map((entry) =>
          entry.item === text
            ? { ...entry, doneDate, doneAt: completed ? changedAt : null, updatedAt: changedAt }
            : entry,
        )
      : [
          ...history,
          {
            id: `todo-hist-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            item: text,
            addedDate: dateIso,
            doneDate,
            addedAt: changedAt,
            doneAt: completed ? changedAt : null,
            createdAt: changedAt,
            updatedAt: changedAt,
          },
        ],
  }, nextItems);
  return {
    todo: synced.todo,
    todoHistory: synced.todoHistory,
    items: synced.items,
  };
}

function getDayRecordDetails(record, dateIso, dateField) {
  const todoHistory = Array.isArray(record?.todoHistory) ? record.todoHistory : [];
  const doneTodos = todoHistory
    .filter((entry) => entry.doneDate === dateIso && entry.item)
    .map((entry) => entry.item);
  const doneSet = new Set(
    todoHistory.filter((entry) => entry.doneDate).map((entry) => entry.item),
  );
  const pendingTodos = getTodoLines(record)
    .filter((line) => !doneSet.has(line))
    .slice(0, 4);
  const dateEntries = (record?.dateHistory?.[dateField?.key] ?? [])
    .filter((entry) => entry.date === dateIso && String(entry.item ?? "").trim())
    .map((entry) => entry.item.trim());

  return {
    arrangements: dateEntries.length > 0 ? dateEntries : [`进行：${getRecordTitle(record)}`],
    doneTodos,
    pendingTodos,
    notes: [record?.description, record?.todo]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .slice(0, 2),
  };
}

function DetailSection({ title, items, emptyText }) {
  const visibleItems = items.filter(Boolean);
  return (
    <span className="calendar-info-section">
      <b>{title}</b>
      {visibleItems.length > 0 ? (
        visibleItems.slice(0, 4).map((item, index) => <em key={`${title}-${index}`}>{item}</em>)
      ) : (
        <em>{emptyText}</em>
      )}
    </span>
  );
}

function CalendarTooltipEditor({
  status,
  statusOptions,
  text,
  onStatusChange,
  onTextSave,
}) {
  const [draft, setDraft] = useState(text || "");
  const savedTextRef = useRef(String(text || ""));

  function saveText() {
    const nextText = draft.trim();
    if (nextText && nextText !== savedTextRef.current) {
      savedTextRef.current = nextText;
      onTextSave?.(nextText);
    }
  }

  return (
    <div
      className="calendar-tooltip-editor"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <label>
        <span>状态</span>
        <select
          defaultValue={status || ""}
          onChange={(event) => onStatusChange?.(event.target.value)}
        >
          {statusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>事项文本</span>
        <div className="calendar-tooltip-text-control">
          <textarea
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={saveText}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                saveText();
                event.currentTarget.blur();
              }
            }}
          />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={saveText} title="保存文本">
            <Save size={13} />
          </button>
        </div>
      </label>
    </div>
  );
}

function buildMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingBlanks = firstDay.getDay();
  const days = Array.from({ length: lastDay.getDate() }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return {
      key: toIsoDate(date),
      iso: toIsoDate(date),
      day: date.getDate(),
      blank: false,
    };
  });
  const totalCells = Math.ceil((leadingBlanks + days.length) / 7) * 7;
  const trailingBlanks = totalCells - leadingBlanks - days.length;
  return [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({
      key: `leading-${index}`,
      blank: true,
    })),
    ...days,
    ...Array.from({ length: trailingBlanks }, (_, index) => ({
      key: `trailing-${index}`,
      blank: true,
    })),
  ];
}

export default function CalendarBoard({
  records,
  calendarItems = [],
  statusOptions = [],
  updateRecord,
  updateRecordDate,
  removeRecordDate,
  addCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
  openCalendarItemModal,
  openRecord,
}) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dropTarget, setDropTarget] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const tooltipCloseTimerRef = useRef(null);
  const todayIso = today();
  const statusById = useMemo(
    () => Object.fromEntries(statusOptions.map((status) => [status.id, status])),
    [statusOptions],
  );

  const monthDays = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const visibleRecords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      if (categoryFilter !== "all" && record.categoryId !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [
        getRecordTitle(record),
        record.description,
        record.windowsPath,
        record.linuxPath,
        record.serverPath,
        record.githubUrl,
        record.todo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [categoryFilter, records, searchTerm, statusFilter]);

  const recordsByDate = useMemo(() => {
    const groups = new Map();
    for (const record of records) {
      const dateField = getPrimaryDateField(record);
      const seenPrimaryDate = new Set();
      const historyEntries = record.dateHistory?.[dateField?.key] ?? [];
      for (const entry of historyEntries) {
        if (!entry?.date) {
          continue;
        }
        seenPrimaryDate.add(entry.date);
        const list = groups.get(entry.date) ?? [];
        list.push({
          record,
          occurrenceId: entry.id || `${record.id}-${entry.date}-${list.length}`,
          occurrenceItem: entry.item || "",
          occurrenceAddedAt: entry.createdAt || entry.addedAt || entry.date,
        });
        groups.set(entry.date, list);
      }
      const date = getRecordDate(record);
      if (date && !seenPrimaryDate.has(date)) {
        const list = groups.get(date) ?? [];
        list.push({
          record,
          occurrenceId: `${record.id}-${date}-primary`,
          occurrenceItem: "",
        });
        groups.set(date, list);
      }
    }
    return groups;
  }, [records]);

  const calendarItemsByDate = useMemo(() => {
    const groups = new Map();
    for (const item of calendarItems) {
      if (!item?.date) {
        continue;
      }
      const list = groups.get(item.date) ?? [];
      list.push(item);
      groups.set(item.date, list);
    }
    return groups;
  }, [calendarItems]);
  const unscheduledItems = useMemo(
    () => {
      const calendarTodoItems = calendarItems
        .filter((item) => !item?.date)
        .map((item) => ({
          type: "calendar",
          key: `calendar-${item.id}`,
          sortDate: item.startDate || item.createdAt || "",
          item,
        }));
      const recordTodoItems = records.flatMap((record) =>
        (record.todoHistory ?? [])
          .filter((todo) => todo.item && !todo.doneDate)
          .map((todo) => ({
            type: "recordTodo",
            key: `todo-${record.id}-${todo.id || todo.item}`,
            sortDate: todo.addedDate || record.startDate || "",
            record,
            todo,
          })),
      );
      return [...calendarTodoItems, ...recordTodoItems].sort(
        (left, right) =>
          String(right.sortDate || "").localeCompare(String(left.sortDate || "")) ||
          String(right.key).localeCompare(String(left.key)),
      );
    },
    [calendarItems, records],
  );

  function moveMonth(offset) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function handleDragStart(event, record) {
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData(DRAG_TYPE, record.id);
    event.dataTransfer.setData("text/plain", getRecordTitle(record));
  }

  function handleCalendarItemDragStart(event, item) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(CALENDAR_ITEM_DRAG_TYPE, item.id);
    event.dataTransfer.setData("text/plain", item.title || "待办事项");
  }

  function handleRecordTodoDragStart(event, record, todo) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      TODO_DRAG_TYPE,
      JSON.stringify({ recordId: record.id, item: todo.item || "" }),
    );
    event.dataTransfer.setData("text/plain", todo.item || "待办事项");
  }

  function recordHasDate(record, dateField, dateIso) {
    if (!record || !dateField || !dateIso) {
      return false;
    }
    if (record[dateField.key] === dateIso) {
      return true;
    }
    return (record.dateHistory?.[dateField.key] ?? []).some((entry) => entry.date === dateIso);
  }

  function openRecordScheduleDraft(record, dateIso, sourceTodoItem = "") {
    const dateField = getPrimaryDateField(record);
    if (!record || !dateField) {
      return;
    }
    const referenceTodos = (record.todoHistory ?? [])
      .filter((entry) => entry.item && !entry.doneDate)
      .map((entry) => entry.item);
    setScheduleDraft({
      recordId: record.id,
      recordTitle: getRecordTitle(record),
      categoryName: getCategory(record.categoryId).name,
      date: dateIso,
      fieldKey: dateField.key,
      fieldLabel: dateField.label,
      existsOnDate: recordHasDate(record, dateField, dateIso),
      sourceTodoItem,
      referenceTodos,
      item: sourceTodoItem,
      durationMinutes: "",
      status: ACTIVE_STATUS,
    });
  }

  function openCalendarItemScheduleDraft(item, dateIso) {
    if (!item) {
      return;
    }
    setScheduleDraft({
      calendarItemId: item.id,
      recordTitle: item.title || "未命名事项",
      categoryName: getCategory(item.categoryId).name,
      date: dateIso,
      fieldLabel: "日历日期",
      existsOnDate: false,
      sourceTodoItem: "",
      referenceTodos: [],
      item: item.title || "",
      durationMinutes: String(item.durationMinutes || ""),
      status: ACTIVE_STATUS,
    });
  }

  function handleDrop(event, dateIso) {
    event.preventDefault();
    setDropTarget("");
    const calendarItemId = event.dataTransfer.getData(CALENDAR_ITEM_DRAG_TYPE);
    if (calendarItemId) {
      const calendarItem = calendarItems.find((item) => String(item.id) === calendarItemId);
      openCalendarItemScheduleDraft(calendarItem, dateIso);
      return;
    }

    const todoPayload = event.dataTransfer.getData(TODO_DRAG_TYPE);
    if (todoPayload) {
      try {
        const parsed = JSON.parse(todoPayload);
        const record = records.find((item) => item.id === parsed.recordId);
        const dateField = getPrimaryDateField(record);
        const todoItem = String(parsed.item ?? "").trim();
        if (record && dateField && todoItem) {
          openRecordScheduleDraft(record, dateIso, todoItem);
        }
      } catch {
        // Ignore malformed drag payloads from outside the app.
      }
      return;
    }

    const recordId = event.dataTransfer.getData(DRAG_TYPE);
    const record = records.find((item) => item.id === recordId);
    openRecordScheduleDraft(record, dateIso);
  }

  function closeScheduleDraft() {
    setScheduleDraft(null);
  }

  function submitScheduleDraft(event) {
    event.preventDefault();
    if (!scheduleDraft) {
      return;
    }
    const item = scheduleDraft.item.trim() || `${scheduleDraft.recordTitle} 今日事项`;
    const durationMinutes = normalizeDurationMinutes(scheduleDraft.durationMinutes);
    const nextStatus = scheduleDraft.status || ACTIVE_STATUS;
    if (scheduleDraft.calendarItemId) {
      updateCalendarItem?.(scheduleDraft.calendarItemId, {
        date: scheduleDraft.date,
        title: item,
        durationMinutes,
        status: nextStatus,
      });
      closeScheduleDraft();
      return;
    }
    const existingTodoItem = scheduleDraft.referenceTodos?.includes(item) ? item : "";
    const dateHistoryItem = existingTodoItem
      ? formatScheduleItem("", item, durationMinutes)
      : formatScheduleItem(
          `${scheduleDraft.date === todayIso ? "今天" : "日历"}事项：`,
          item,
          durationMinutes,
        );
    updateRecordDate?.(
      scheduleDraft.recordId,
      scheduleDraft.fieldKey,
      scheduleDraft.date,
      dateHistoryItem,
    );
    const record = records.find((entry) => entry.id === scheduleDraft.recordId);
    const todoItem = existingTodoItem || formatScheduleItem(
      `${scheduleDraft.date} 日历事项：`, item, durationMinutes,
    );
    const isDone = nextStatus === DONE_STATUS;
    updateRecord?.(scheduleDraft.recordId, {
      ...(existingTodoItem
        ? isDone
          ? buildTodoCompletionPatch(record, todoItem, scheduleDraft.date, true)
          : {}
        : isDone
          ? buildTodoCompletionPatch(record, todoItem, scheduleDraft.date, true)
          : buildTodoPatch(record, todoItem, scheduleDraft.date)),
      ...(scheduleDraft.existsOnDate ? {} : { [scheduleDraft.fieldKey]: scheduleDraft.date }),
      status: nextStatus,
    });
    closeScheduleDraft();
  }

  function handleRemoveFromDate(event, record, dateIso, occurrenceId = "") {
    event.preventDefault();
    event.stopPropagation();
    const dateField = getPrimaryDateField(record);
    if (!record || !dateField) {
      return;
    }
    removeRecordDate?.(record.id, dateField.key, dateIso, occurrenceId);
  }

  function handleAddCustomItem(event, dateIso) {
    event.preventDefault();
    event.stopPropagation();
    openCalendarItemModal?.(dateIso);
  }

  function handleAddUnscheduledItem() {
    openCalendarItemModal?.("", {
      categoryId: "other",
      status: DONE_STATUS,
      startDate: today(),
      endDate: today(),
      durationMinutes: "30",
    });
  }

  function openTooltip(event, content) {
    window.clearTimeout(tooltipCloseTimerRef.current);
    const triggerRect = event.currentTarget.getBoundingClientRect();
    const dayElement = event.currentTarget.closest(".calendar-day");
    const anchorRect = dayElement?.getBoundingClientRect() ?? triggerRect;
    const dateHeaderRect = dayElement
      ?.querySelector(".calendar-day-head")
      ?.getBoundingClientRect() ?? anchorRect;
    const viewportGap = 10;
    const anchorGap = 8;
    const width = Math.min(360, window.innerWidth - 20);
    const preferredHeight = Math.min(520, window.innerHeight - viewportGap * 2);
    const clampLeft = (value) =>
      Math.min(Math.max(viewportGap, value), window.innerWidth - width - viewportGap);
    const clampTop = (value, height) =>
      Math.min(Math.max(viewportGap, value), window.innerHeight - height - viewportGap);
    const roomRight = window.innerWidth - anchorRect.right - anchorGap - viewportGap;
    const roomLeft = anchorRect.left - anchorGap - viewportGap;
    const roomBelow = window.innerHeight - anchorRect.bottom - anchorGap - viewportGap;
    const roomAbove = anchorRect.top - anchorGap - viewportGap;

    let left;
    let top;
    let maxHeight = preferredHeight;
    if (roomRight >= width) {
      left = anchorRect.right + anchorGap;
      top = clampTop(triggerRect.top, maxHeight);
    } else if (roomLeft >= width) {
      left = anchorRect.left - width - anchorGap;
      top = clampTop(triggerRect.top, maxHeight);
    } else if (roomBelow >= 180) {
      left = clampLeft(triggerRect.left);
      top = anchorRect.bottom + anchorGap;
      maxHeight = Math.min(maxHeight, roomBelow);
    } else if (roomAbove >= 180) {
      left = clampLeft(triggerRect.left);
      maxHeight = Math.min(maxHeight, roomAbove);
      top = anchorRect.top - maxHeight - anchorGap;
    } else {
      left = clampLeft(triggerRect.left);
      top = dateHeaderRect.bottom + anchorGap;
      maxHeight = Math.max(80, window.innerHeight - top - viewportGap);
    }

    setTooltip({ left, top, width, maxHeight, content });
  }

  function closeTooltip() {
    window.clearTimeout(tooltipCloseTimerRef.current);
    tooltipCloseTimerRef.current = window.setTimeout(() => setTooltip(null), 180);
  }

  function handleCopyRecord(event, record, dateIso) {
    event.preventDefault();
    event.stopPropagation();
    const category = getCategory(record.categoryId);
    openCalendarItemModal?.(dateIso, {
      title: getRecordTitle(record),
      description: record.description || "",
      todo: record.todo || "",
      githubUrl: record.githubUrl || "",
      platformUrl: record.platformUrl || "",
      officialUrl: record.officialUrl || "",
      windowsPath: record.windowsPath || "",
      linuxPath: record.linuxPath || "",
      serverPath: record.serverPath || "",
      categoryId: category.id,
      status: ACTIVE_STATUS,
    });
  }

  function handleToggleCustomDone(event, item) {
    event.stopPropagation();
    const nextStatus = item.status === "已完成" ? ACTIVE_STATUS : "已完成";
    updateCalendarItem?.(item.id, { status: nextStatus });
  }

  function handleToggleRecordTodo(event, record, dateIso) {
    event.stopPropagation();
    const todoItem = getCalendarTodoItem(record, dateIso);
    const isDone = isCalendarTodoDone(record, todoItem);
    updateRecord?.(record.id, {
      ...buildTodoCompletionPatch(record, todoItem, dateIso, !isDone),
      status: isDone ? ACTIVE_STATUS : DONE_STATUS,
    });
  }

  function handleDeleteCustomItem(event, itemId) {
    event.preventDefault();
    event.stopPropagation();
    deleteCalendarItem?.(itemId);
  }

  function handleCopyCustomItem(event, item) {
    event.preventDefault();
    event.stopPropagation();
    openCalendarItemModal?.(item.date, {
      title: item.title,
      description: item.description,
      categoryId: item.categoryId,
      status: item.status || "已完成",
      durationMinutes: item.durationMinutes || "",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      todo: item.todo || "",
      githubUrl: item.githubUrl || "",
      platformUrl: item.platformUrl || "",
      officialUrl: item.officialUrl || "",
      windowsPath: item.windowsPath || "",
      linuxPath: item.linuxPath || "",
      serverPath: item.serverPath || "",
    });
  }

  function handleEditCustomItem(event, item) {
    event.preventDefault();
    event.stopPropagation();
    openCalendarItemModal?.(item.date, item, { itemId: item.id });
  }

  return (
    <section className="workspace calendar-page">
      <aside className="calendar-source-panel">
        <div className="calendar-panel-title">
          <CalendarDays size={16} />
          <strong>拖拽记录到日历</strong>
        </div>
        <label className="calendar-search">
          <Search size={15} />
          <input
            type="search"
            placeholder="搜索名称、说明、路径"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <select
          className="calendar-filter"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="日历类别筛选"
        >
          <option value="all">全部类别</option>
          {CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className="calendar-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="日历状态筛选"
        >
          <option value="all">全部状态</option>
          {statusOptions.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
        <div className="calendar-record-list">
          {visibleRecords.map((record) => {
            const category = CATEGORY_BY_ID[record.categoryId] ?? CATEGORIES[0];
            const status = statusById[record.status] ?? statusOptions[0];
            return (
              <button
                key={record.id}
                className="calendar-record-card"
                type="button"
                draggable
                onDragStart={(event) => handleDragStart(event, record)}
                onDoubleClick={() => openRecord?.(record)}
                style={{
                  "--record-accent": category.accent,
                  "--record-tint": category.tint,
                  "--record-status-bg": status?.bg || "#eef2ff",
                  "--record-status-color": status?.color || "#334155",
                  "--record-status-border": status?.border || "#cbd5e1",
                }}
                title="拖到右侧日期格；双击回到表格编辑"
              >
                <span className="calendar-record-category">{category.name}</span>
                <strong>{getRecordTitle(record)}</strong>
                <span className="calendar-record-meta">
                  <span>{status?.label || record.status || "未设置"}</span>
                  <span className="calendar-date-text">{getRecordDate(record) || "未排期"}</span>
                </span>
              </button>
            );
          })}
          {visibleRecords.length === 0 && <div className="calendar-empty">没有可拖拽记录</div>}
        </div>
      </aside>

      <div className="calendar-board">
        <div className="calendar-toolbar">
          <button className="icon-button" type="button" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={16} />
            <span>上月</span>
          </button>
          <div>
            <h2>
              {monthDate.getFullYear()}年{monthDate.getMonth() + 1}月
            </h2>
            <p>拖到日期格后可选择“进行中”或“已完成”，日期历史会自动追加。</p>
          </div>
          <button className="icon-button" type="button" onClick={() => moveMonth(1)}>
            <span>下月</span>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="calendar-week-head">
          {["日", "一", "二", "三", "四", "五", "六"].map((item) => (
            <span key={item}>周{item}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {monthDays.map((day) => {
            const dayRecords = day.iso ? recordsByDate.get(day.iso) ?? [] : [];
            const dayCustomItems = day.iso ? calendarItemsByDate.get(day.iso) ?? [] : [];
            const visibleEntries = [
              ...dayRecords.map((occurrence) => ({ type: "record", ...occurrence })),
              ...dayCustomItems.map((item) => ({ type: "custom", item })),
            ];
            if (day.blank) {
              return <div key={day.key} className="calendar-day blank" aria-hidden="true" />;
            }
            return (
              <div
                key={day.key}
                className={[
                  "calendar-day",
                  day.iso === todayIso ? "today" : "",
                  dropTarget === day.iso ? "drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTarget(day.iso);
                }}
                onDragLeave={() => setDropTarget("")}
                onDrop={(event) => handleDrop(event, day.iso)}
              >
                <div className="calendar-day-head">
                  <strong>{day.day}</strong>
                  <button
                    className="calendar-day-add"
                    type="button"
                    onClick={(event) => handleAddCustomItem(event, day.iso)}
                    title="新建其他事项"
                    aria-label={`在 ${day.iso} 新建其他事项`}
                  >
                    <Plus size={10} />
                  </button>
                  {day.iso === todayIso && <span>今天</span>}
                </div>
                <div className="calendar-day-records">
                  {visibleEntries.map((entry) => {
                    if (entry.type === "custom") {
                      const item = entry.item;
                      const category = getCategory(item.categoryId);
                      const status = statusById[item.status] ?? statusById["其他"] ?? statusOptions[0];
                      const customNotes = [item.description].filter(Boolean);
                      const tooltipContent = (
                        <>
                          <strong>{item.title}</strong>
                          <CalendarTooltipEditor
                            status={item.status}
                            statusOptions={statusOptions}
                            text={item.title}
                            onStatusChange={(nextStatus) =>
                              updateCalendarItem?.(item.id, { status: nextStatus })
                            }
                            onTextSave={(title) => updateCalendarItem?.(item.id, { title })}
                          />
                          <span>类别：{category.name}</span>
                          <span>状态：{status?.label || item.status || "其他"}</span>
                          <span className="calendar-date-text">日期：{item.date}</span>
                          <span className="calendar-date-text">添加日期：{String(item.createdAt || item.date || "").slice(0, 10) || "未知"}</span>
                          {item.startDate && <span className="calendar-date-text">开始日期：{item.startDate}</span>}
                          {item.endDate && <span className="calendar-date-text">结束日期：{item.endDate}</span>}
                          {item.durationMinutes && <span>预计耗时：{item.durationMinutes}分钟</span>}
                          <DetailSection
                            title="今天事项"
                            items={[item.title]}
                            emptyText="未填写事项"
                          />
                          <DetailSection
                            title="注意事项"
                            items={customNotes}
                            emptyText="无备注"
                          />
                        </>
                      );
                      return (
                        <div
                          key={item.id}
                          className={`calendar-day-record custom calendar-type-${item.categoryId || "other"} ${
                            item.status === "已完成" ? "done" : ""
                          }`}
                          role="button"
                          tabIndex={0}
                          onMouseEnter={(event) => openTooltip(event, tooltipContent)}
                          onMouseLeave={closeTooltip}
                          onFocus={(event) => openTooltip(event, tooltipContent)}
                          onBlur={closeTooltip}
                          onClick={(event) => handleEditCustomItem(event, item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              handleEditCustomItem(event, item);
                            }
                          }}
                          style={{
                            "--record-accent": category.accent,
                            "--record-tint": category.tint,
                            "--record-status-bg": status?.bg || "#f1f5f9",
                            "--record-status-color": status?.color || "#334155",
                            "--record-status-border": status?.border || "#cbd5e1",
                          }}
                          title={item.title}
                        >
                          <span className="calendar-day-record-category">{category.name}</span>
                          <span className="calendar-day-record-title">{item.title}</span>
                          <span
                            className="calendar-record-copy"
                            role="button"
                            tabIndex={0}
                            title="复制这个事项"
                            aria-label={`复制 ${item.title}`}
                            onClick={(event) => handleCopyCustomItem(event, item)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                handleCopyCustomItem(event, item);
                              }
                            }}
                          >
                            <Copy size={10} />
                          </span>
                          <label
                            className="calendar-record-done"
                            title={item.status === "已完成" ? "标记为进行中" : "标记为已完成"}
                            aria-label={`${item.title} 标记已完成`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={item.status === "已完成"}
                              onChange={(event) => handleToggleCustomDone(event, item)}
                            />
                          </label>
                          <span
                            className="calendar-record-remove"
                            role="button"
                            tabIndex={0}
                            title="删除这个事项"
                            aria-label={`删除 ${item.title}`}
                            onClick={(event) => handleDeleteCustomItem(event, item.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                handleDeleteCustomItem(event, item.id);
                              }
                            }}
                          >
                            <X size={10} />
                          </span>
                        </div>
                      );
                    }

                    const record = entry.record;
                    const category = getCategory(record.categoryId);
                    const status = statusById[record.status] ?? statusOptions[0];
                    const dateField = getPrimaryDateField(record);
                    const details = getDayRecordDetails(record, day.iso, dateField);
                    const calendarTodoItem = getCalendarTodoItem(record, day.iso);
                    const calendarTodoDone = isCalendarTodoDone(record, calendarTodoItem);
                    const tooltipContent = (
                      <>
                        <strong>{getRecordTitle(record)}</strong>
                        <CalendarTooltipEditor
                          status={record.status}
                          statusOptions={statusOptions}
                          text={getRecordTitle(record)}
                          onStatusChange={(nextStatus) =>
                            updateRecord?.(record.id, { status: nextStatus })
                          }
                          onTextSave={(title) => updateRecord?.(record.id, { title })}
                        />
                        <span>类别：{category.name}</span>
                        <span>状态：{status?.label || record.status || "未设置"}</span>
                        <span className="calendar-date-text">日期：{day.iso}</span>
                        <span className="calendar-date-text">
                          添加日期：{String(entry.occurrenceAddedAt || record.createdAt || day.iso).slice(0, 10)}
                        </span>
                        <span>字段：{dateField?.label || "日期"}</span>
                        <DetailSection
                          title="今天做什么"
                          items={entry.occurrenceItem ? [entry.occurrenceItem] : details.arrangements}
                          emptyText="未填写安排"
                        />
                        <DetailSection
                          title="完成 Todo"
                          items={details.doneTodos}
                          emptyText="暂无完成"
                        />
                        <DetailSection
                          title="待做事项"
                          items={details.pendingTodos}
                          emptyText="暂无待做"
                        />
                        <DetailSection
                          title="注意事项"
                          items={details.notes}
                          emptyText="无备注"
                        />
                      </>
                    );
                    return (
                      <div
                        key={entry.occurrenceId || record.id}
                        className={`calendar-day-record calendar-type-${record.categoryId} ${
                          calendarTodoDone ? "done" : ""
                        }`}
                        role="button"
                        tabIndex={0}
                        style={{
                          "--record-accent": category.accent,
                          "--record-tint": category.tint,
                          "--record-status-bg": status?.bg || "#eef2ff",
                          "--record-status-color": status?.color || "#334155",
                          "--record-status-border": status?.border || "#cbd5e1",
                        }}
                        onMouseEnter={(event) => openTooltip(event, tooltipContent)}
                        onMouseLeave={closeTooltip}
                        onFocus={(event) => openTooltip(event, tooltipContent)}
                        onBlur={closeTooltip}
                        onClick={() => openRecord?.(record)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openRecord?.(record);
                          }
                        }}
                        title={getRecordTitle(record)}
                      >
                        <span className="calendar-day-record-category">{category.name}</span>
                        <span className="calendar-day-record-title">{getRecordTitle(record)}</span>
                        <span
                          className="calendar-record-copy"
                          role="button"
                          tabIndex={0}
                          title="复制为其他事项"
                          aria-label={`复制 ${getRecordTitle(record)}`}
                          onClick={(event) => handleCopyRecord(event, record, day.iso)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              handleCopyRecord(event, record, day.iso);
                            }
                          }}
                        >
                          <Copy size={10} />
                        </span>
                        <label
                          className="calendar-record-done"
                          title={calendarTodoDone ? "标记为未完成" : "完成今天事项"}
                          aria-label={`${getRecordTitle(record)} 完成今天事项`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={calendarTodoDone}
                            onChange={(event) => handleToggleRecordTodo(event, record, day.iso)}
                          />
                        </label>
                        <span
                          className="calendar-record-remove"
                          role="button"
                          tabIndex={0}
                          title="从这个日期移除"
                          aria-label={`从 ${day.iso} 移除 ${getRecordTitle(record)}`}
                          onClick={(event) =>
                            handleRemoveFromDate(event, record, day.iso, entry.occurrenceId)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              handleRemoveFromDate(event, record, day.iso, entry.occurrenceId);
                            }
                          }}
                        >
                          <X size={10} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="calendar-todo-panel">
        <div className="calendar-panel-title">
          <CalendarDays size={16} />
          <strong>待办事项</strong>
        </div>
        <button
          className="icon-button primary calendar-todo-add"
          type="button"
          onClick={handleAddUnscheduledItem}
        >
          <Plus size={16} />
          <span>新增待办</span>
        </button>
        <div className="calendar-todo-list">
          {unscheduledItems.map((entry) => {
            if (entry.type === "recordTodo") {
              const { record, todo } = entry;
              const category = getCategory(record.categoryId);
              const status = statusById[record.status] ?? statusById[ACTIVE_STATUS] ?? statusOptions[0];
              return (
                <div
                  key={entry.key}
                  className={`calendar-todo-card record-todo calendar-type-${record.categoryId}`}
                  draggable
                  onDragStart={(event) => handleRecordTodoDragStart(event, record, todo)}
                  onClick={() => openRecord?.(record)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openRecord?.(record);
                    }
                  }}
                  style={{
                    "--record-accent": category.accent,
                    "--record-tint": category.tint,
                    "--record-status-bg": status?.bg || "#eef2ff",
                    "--record-status-color": status?.color || "#334155",
                    "--record-status-border": status?.border || "#cbd5e1",
                  }}
                  title="拖到中间日期格安排日期"
                >
                  <span className="calendar-record-category">{category.name}</span>
                  <strong>{todo.item}</strong>
                  <span className="calendar-todo-source">{getRecordTitle(record)}</span>
                  <span className="calendar-todo-meta">
                    <span>{status?.label || record.status || ACTIVE_STATUS}</span>
                    <span className="calendar-date-text">{todo.addedDate || record.startDate || "未记录时间"}</span>
                  </span>
                </div>
              );
            }
            const item = entry.item;
            const category = getCategory(item.categoryId);
            const status = statusById[item.status] ?? statusById[ACTIVE_STATUS] ?? statusOptions[0];
            return (
              <div
                key={entry.key}
                className={`calendar-todo-card calendar-type-${item.categoryId || "other"}`}
                draggable
                onDragStart={(event) => handleCalendarItemDragStart(event, item)}
                onClick={(event) => handleEditCustomItem(event, item)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    handleEditCustomItem(event, item);
                  }
                }}
                style={{
                  "--record-accent": category.accent,
                  "--record-tint": category.tint,
                  "--record-status-bg": status?.bg || "#eef2ff",
                  "--record-status-color": status?.color || "#334155",
                  "--record-status-border": status?.border || "#cbd5e1",
                }}
                title="拖到中间日期格安排日期"
              >
                <span className="calendar-record-category">{category.name}</span>
                <strong>{item.title}</strong>
                <span className="calendar-todo-meta">
                  <span>{status?.label || item.status || ACTIVE_STATUS}</span>
                  {item.startDate && <span className="calendar-date-text">{item.startDate} 起</span>}
                  {item.endDate && <span className="calendar-date-text">{item.endDate} 止</span>}
                  {item.durationMinutes && <span>{item.durationMinutes}分钟</span>}
                </span>
                {item.description && <em>{item.description}</em>}
              </div>
            );
          })}
          {unscheduledItems.length === 0 && (
            <div className="calendar-empty">暂无未排期待办</div>
          )}
        </div>
      </aside>
      {tooltip &&
        createPortal(
          <div
            className="calendar-record-info portal-calendar-record-info"
            role="tooltip"
            style={{
              left: tooltip.left,
              top: tooltip.top,
              width: tooltip.width,
              maxHeight: tooltip.maxHeight,
            }}
            onMouseEnter={() => window.clearTimeout(tooltipCloseTimerRef.current)}
            onMouseLeave={closeTooltip}
          >
            {tooltip.content}
          </div>,
          document.body,
        )}
      {scheduleDraft &&
        createPortal(
          <div className="calendar-schedule-backdrop" role="presentation" onMouseDown={closeScheduleDraft}>
            <form
              className="calendar-schedule-modal"
              onSubmit={submitScheduleDraft}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="calendar-schedule-head">
                <div>
                  <strong>
                    {scheduleDraft.calendarItemId
                      ? "安排事项到日历"
                      : scheduleDraft.sourceTodoItem
                      ? "安排待办到日历"
                      : scheduleDraft.existsOnDate
                        ? "新增今天事项"
                        : "安排到日历"}
                  </strong>
                  <span>
                    {scheduleDraft.categoryName} · {scheduleDraft.recordTitle} ·{" "}
                    <span className="calendar-date-text">{scheduleDraft.date}</span>
                  </span>
                </div>
                <button className="calendar-schedule-close" type="button" onClick={closeScheduleDraft}>
                  <X size={15} />
                </button>
              </div>
              <label className="calendar-schedule-field">
                <span>今天具体完成什么</span>
                <textarea
                  value={scheduleDraft.item}
                  onChange={(event) =>
                    setScheduleDraft((current) =>
                      current ? { ...current, item: event.target.value } : current,
                    )
                  }
                  placeholder="输入今天要做的事项、完成内容、Todo 或注意事项"
                  autoFocus
                />
              </label>
              {scheduleDraft.referenceTodos?.length > 0 && (
                <div className="calendar-schedule-references">
                  <span>参考待办</span>
                  <div>
                    {scheduleDraft.referenceTodos.map((todo) => (
                      <button
                        key={todo}
                        type="button"
                        className={scheduleDraft.item === todo ? "selected" : ""}
                        onClick={() =>
                          setScheduleDraft((current) =>
                            current ? { ...current, item: todo } : current,
                          )
                        }
                        title={todo}
                      >
                        {todo}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <fieldset className="calendar-schedule-status-field">
                <legend>默认状态</legend>
                <div className="calendar-schedule-statuses">
                  {[ACTIVE_STATUS, DONE_STATUS].map((statusId) => {
                    const status = statusById[statusId];
                    return (
                      <label
                        key={statusId}
                        className={scheduleDraft.status === statusId ? "selected" : ""}
                        style={{
                          "--status-bg": status?.bg || "#f1f5f9",
                          "--status-color": status?.color || "#334155",
                          "--status-border": status?.border || "#cbd5e1",
                        }}
                      >
                        <input
                          type="radio"
                          name="calendar-schedule-status"
                          value={statusId}
                          checked={scheduleDraft.status === statusId}
                          onChange={() =>
                            setScheduleDraft((current) =>
                              current ? { ...current, status: statusId } : current,
                            )
                          }
                        />
                        <span>{statusId}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="calendar-schedule-field compact">
                <span>预计耗时（分钟）</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={scheduleDraft.durationMinutes}
                  onChange={(event) =>
                    setScheduleDraft((current) =>
                      current
                        ? { ...current, durationMinutes: event.target.value.replace(/\D/g, "") }
                        : current,
                    )
                  }
                  placeholder="例如 30"
                />
              </label>
              <div className="calendar-schedule-note">
                {scheduleDraft.sourceTodoItem
                  ? "提交后会把该待办安排到所选日期；状态选为已完成时，会同时记录完成日期。"
                  : scheduleDraft.existsOnDate
                  ? "这条记录当天已存在，提交后会继续追加一条当天事项。"
                  : `已先放入 ${scheduleDraft.fieldLabel}，提交后会记录今天的具体事项。`}
              </div>
              <div className="calendar-schedule-actions">
                <button className="text-button" type="button" onClick={closeScheduleDraft}>
                  取消
                </button>
                <button className="icon-button primary calendar-schedule-submit" type="submit">
                  <Plus size={16} />
                  <span>确认新增</span>
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </section>
  );
}
