export const RECORD_ITEM_TYPES = {
  TODO: "todo",
  CALENDAR: "calendar",
  NOTE: "note",
};

export const BASE_RECORD_DEFAULTS = {
  status: "",
  title: "",
  description: "",
  todo: "",
  startDate: "",
  endDate: "",
  windowsPath: "",
  linuxPath: "",
  serverPath: "",
  githubUrl: "",
  platformUrl: "",
  officialUrl: "",
};

export function createRecordItem({
  id,
  recordId = "",
  type = RECORD_ITEM_TYPES.TODO,
  text = "",
  details = "",
  date = "",
  sourceField = "",
  status = "active",
  doneDate = null,
  doneAt = null,
  createdAt = "",
  updatedAt = "",
}) {
  const now = new Date().toISOString();
  return {
    id: String(id || `${type}-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    recordId: String(recordId || ""),
    type,
    text: String(text ?? "").trim(),
    details: String(details ?? "").trim(),
    date: String(date || ""),
    sourceField: String(sourceField || ""),
    status,
    doneDate: doneDate || null,
    doneAt: doneAt || null,
    createdAt: createdAt || now,
    updatedAt: updatedAt || now,
  };
}

function getDoneDate(item) {
  if (item?.doneDate) {
    return item.doneDate;
  }
  if (item?.status === "done") {
    return String(item?.doneAt || item?.date || item?.addedDate || item?.createdAt || "").slice(0, 10) || null;
  }
  return null;
}

function normalizeRecordItem(item, recordId) {
  const doneDate = getDoneDate(item);
  return createRecordItem({
    ...item,
    id: item?.id,
    recordId: item?.recordId || recordId,
    type: item?.type === "date" ? RECORD_ITEM_TYPES.TODO : item?.type || RECORD_ITEM_TYPES.TODO,
    text: item?.text ?? item?.item ?? "",
    details: item?.details ?? item?.description ?? "",
    date: item?.date ?? item?.addedDate ?? "",
    sourceField: item?.sourceField ?? "",
    status: item?.status || (doneDate ? "done" : "active"),
    doneDate,
    doneAt: item?.doneAt ?? null,
    createdAt: item?.createdAt,
    updatedAt: item?.updatedAt,
  });
}

export function buildRecordItemsFromLegacy(record) {
  const recordId = record?.id || "";
  const items = [];
  const seen = new Set();

  const pushItem = (item) => {
    if (!item.text) {
      return;
    }
    const key = [item.type, item.sourceField, item.date, item.text].join("|");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push(item);
  };

  if (Array.isArray(record?.items)) {
    record.items.forEach((item) => pushItem(normalizeRecordItem(item, recordId)));
  }

  const todoLines = String(record?.todo ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const todoHistory = Array.isArray(record?.todoHistory) ? record.todoHistory : [];
  const todoByText = new Map(todoHistory.map((entry) => [entry.item, entry]));
  todoLines.forEach((text) => {
    const history = todoByText.get(text);
    const doneDate = getDoneDate(history);
    pushItem(
      createRecordItem({
        id: history?.id,
        recordId,
        type: RECORD_ITEM_TYPES.TODO,
        text,
        details: history?.details ?? history?.description ?? "",
        date: history?.addedDate || "",
        status: history?.status || (doneDate ? "done" : "active"),
        doneDate,
        doneAt: history?.doneAt,
        createdAt: history?.createdAt || history?.addedAt || history?.addedDate,
        updatedAt: history?.updatedAt,
      }),
    );
  });
  todoHistory.forEach((history) => {
    const doneDate = getDoneDate(history);
    pushItem(
      createRecordItem({
        id: history.id,
        recordId,
        type: RECORD_ITEM_TYPES.TODO,
        text: history.item,
        details: history.details ?? history.description ?? "",
        date: history.addedDate || "",
        sourceField: history.sourceField || "",
        status: history.status || (doneDate ? "done" : "active"),
        doneDate,
        doneAt: history.doneAt,
        createdAt: history.createdAt || history.addedAt || history.addedDate,
        updatedAt: history.updatedAt,
      }),
    );
  });

  Object.entries(record?.dateHistory ?? {}).forEach(([sourceField, entries]) => {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      pushItem(
        createRecordItem({
          id: entry.id,
          recordId,
          type: RECORD_ITEM_TYPES.TODO,
          text: entry.item,
          details: entry.details ?? entry.item,
          date: entry.date,
          sourceField,
          status: "active",
          createdAt: entry.createdAt || entry.date,
          updatedAt: entry.updatedAt,
        }),
      );
    });
  });

  return items;
}

export function withSyncedRecordItems(record, items = buildRecordItemsFromLegacy(record)) {
  return {
    ...record,
    items,
  };
}

export function syncTodoItemsLegacy(record, items = record?.items ?? []) {
  const todoItems = items.filter((item) => item.type === RECORD_ITEM_TYPES.TODO && item.text);
  const otherItems = (record?.items ?? []).filter((item) => item.type !== RECORD_ITEM_TYPES.TODO);
  const nextItems = [...otherItems, ...todoItems];
  return {
    ...record,
    todo: todoItems.map((item) => item.text).join("\n"),
    todoHistory: todoItems.map((item) => ({
      id: item.id,
      addedDate: item.date || "",
      item: item.text,
      details: item.details || "",
      sourceField: item.sourceField || "",
      doneDate: item.doneDate || null,
      addedAt: item.createdAt,
      doneAt: item.doneAt || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    items: nextItems,
  };
}
