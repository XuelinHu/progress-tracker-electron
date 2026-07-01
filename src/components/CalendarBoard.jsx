import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus, Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_BY_ID } from "../data/categories.js";

const DRAG_TYPE = "application/progress-calendar-record";
const ACTIVE_STATUS = "进行中";
const OTHER_CATEGORY = {
  id: "other",
  name: "其他事项",
  accent: "#64748b",
  tint: "#f1f5f9",
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
  return CATEGORY_BY_ID[categoryId] ?? OTHER_CATEGORY;
}

function getTodoLines(record) {
  return String(record?.todo ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
  statusOptions,
  updateRecord,
  updateRecordDate,
  removeRecordDate,
  addCalendarItem,
  deleteCalendarItem,
  copyCalendarItem,
  openCalendarItemModal,
  openRecord,
}) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dropTarget, setDropTarget] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null);
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
  }, [categoryFilter, records, searchTerm]);

  const recordsByDate = useMemo(() => {
    const groups = new Map();
    for (const record of records) {
      const date = getRecordDate(record);
      if (!date) {
        continue;
      }
      const list = groups.get(date) ?? [];
      list.push(record);
      groups.set(date, list);
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

  function moveMonth(offset) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function handleDragStart(event, record) {
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData(DRAG_TYPE, record.id);
    event.dataTransfer.setData("text/plain", getRecordTitle(record));
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

  function handleDrop(event, dateIso) {
    event.preventDefault();
    setDropTarget("");
    const recordId = event.dataTransfer.getData(DRAG_TYPE);
    const record = records.find((item) => item.id === recordId);
    const dateField = getPrimaryDateField(record);
    if (!record || !dateField) {
      return;
    }

    const existsOnDate = recordHasDate(record, dateField, dateIso);
    if (!existsOnDate) {
      updateRecord?.(record.id, { [dateField.key]: dateIso, status: ACTIVE_STATUS });
    } else {
      updateRecord?.(record.id, { status: ACTIVE_STATUS });
    }
    setScheduleDraft({
      recordId: record.id,
      recordTitle: getRecordTitle(record),
      categoryName: getCategory(record.categoryId).name,
      date: dateIso,
      fieldKey: dateField.key,
      fieldLabel: dateField.label,
      existsOnDate,
      item: "",
    });
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
    updateRecordDate?.(
      scheduleDraft.recordId,
      scheduleDraft.fieldKey,
      scheduleDraft.date,
      `${scheduleDraft.date === todayIso ? "今天" : "日历"}事项：${item}`,
    );
    updateRecord?.(scheduleDraft.recordId, { status: ACTIVE_STATUS });
    closeScheduleDraft();
  }

  function handleRemoveFromDate(event, record, dateIso) {
    event.preventDefault();
    event.stopPropagation();
    const dateField = getPrimaryDateField(record);
    if (!record || !dateField) {
      return;
    }
    removeRecordDate?.(record.id, dateField.key, dateIso);
  }

  function handleAddCustomItem(event, dateIso) {
    event.preventDefault();
    event.stopPropagation();
    openCalendarItemModal?.(dateIso);
  }

  function openTooltip(event, content) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 20);
    const estimatedHeight = 260;
    const left = Math.min(Math.max(10, rect.left), window.innerWidth - width - 10);
    const belowTop = rect.bottom + 6;
    const top =
      belowTop + estimatedHeight > window.innerHeight && rect.top > estimatedHeight
        ? Math.max(10, rect.top - estimatedHeight - 6)
        : Math.min(belowTop, window.innerHeight - 80);
    setTooltip({ left, top, width, content });
  }

  function closeTooltip() {
    setTooltip(null);
  }

  function handleCopyRecord(event, record, dateIso) {
    event.preventDefault();
    event.stopPropagation();
    const category = getCategory(record.categoryId);
    addCalendarItem?.(dateIso, {
      title: getRecordTitle(record),
      description: record.description || "",
      categoryId: category.id,
      status: record.status || "其他",
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
    copyCalendarItem?.(item);
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
                  <span>{getRecordDate(record) || "未排期"}</span>
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
            <p>拖到日期格后，记录状态会变为“进行中”，日期历史会自动追加。</p>
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
              ...dayRecords.map((record) => ({ type: "record", record })),
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
                          <span>类别：{category.name}</span>
                          <span>状态：{status?.label || item.status || "其他"}</span>
                          <span>日期：{item.date}</span>
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
                          className="calendar-day-record custom calendar-type-other"
                          role="button"
                          tabIndex={0}
                          onMouseEnter={(event) => openTooltip(event, tooltipContent)}
                          onMouseLeave={closeTooltip}
                          onFocus={(event) => openTooltip(event, tooltipContent)}
                          onBlur={closeTooltip}
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
                                handleCopyCustomItem(event, item);
                              }
                            }}
                          >
                            <Copy size={10} />
                          </span>
                          <span
                            className="calendar-record-remove"
                            role="button"
                            tabIndex={0}
                            title="删除这个事项"
                            aria-label={`删除 ${item.title}`}
                            onClick={(event) => handleDeleteCustomItem(event, item.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
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
                    const tooltipContent = (
                      <>
                        <strong>{getRecordTitle(record)}</strong>
                        <span>类别：{category.name}</span>
                        <span>状态：{status?.label || record.status || "未设置"}</span>
                        <span>日期：{day.iso}</span>
                        <span>字段：{dateField?.label || "日期"}</span>
                        <DetailSection
                          title="今天做什么"
                          items={details.arrangements}
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
                        key={record.id}
                        className={`calendar-day-record calendar-type-${record.categoryId}`}
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
                              handleCopyRecord(event, record, day.iso);
                            }
                          }}
                        >
                          <Copy size={10} />
                        </span>
                        <span
                          className="calendar-record-remove"
                          role="button"
                          tabIndex={0}
                          title="从这个日期移除"
                          aria-label={`从 ${day.iso} 移除 ${getRecordTitle(record)}`}
                          onClick={(event) => handleRemoveFromDate(event, record, day.iso)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              handleRemoveFromDate(event, record, day.iso);
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
      {tooltip &&
        createPortal(
          <div
            className="calendar-record-info portal-calendar-record-info"
            role="tooltip"
            style={{ left: tooltip.left, top: tooltip.top, width: tooltip.width }}
            onMouseEnter={() => setTooltip(tooltip)}
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
                  <strong>{scheduleDraft.existsOnDate ? "新增今天事项" : "安排到日历"}</strong>
                  <span>
                    {scheduleDraft.categoryName} · {scheduleDraft.recordTitle} · {scheduleDraft.date}
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
              <div className="calendar-schedule-note">
                {scheduleDraft.existsOnDate
                  ? "这条记录当天已存在，提交后会继续追加一条当天事项。"
                  : `已先放入 ${scheduleDraft.fieldLabel}，提交后会记录今天的具体事项。`}
              </div>
              <div className="calendar-schedule-actions">
                <button className="text-button" type="button" onClick={closeScheduleDraft}>
                  取消
                </button>
                <button className="icon-button primary" type="submit">
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
