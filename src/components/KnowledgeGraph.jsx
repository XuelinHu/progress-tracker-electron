import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ExternalLink, GripVertical, Plus, Search, Trash2 } from "lucide-react";
import DateHistoryField from "./DateHistoryField.jsx";
import StatusHistoryPopover from "./StatusHistoryPopover.jsx";
import PortalPopover from "./PortalPopover.jsx";
import CopyIconButton from "./CopyIconButton.jsx";
import { CATEGORIES, CATEGORY_BY_ID } from "../data/categories.js";
import { STATUSES } from "../data/statuses.js";
import "../styles/graph.css";

const DRAG_TYPE = "application/progress-record";
const RELATION_TYPES = ["前置依赖", "衍生出", "产出", "引用", "复用", "参与", "关联", "自定义"];

function createGraphId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function recordTitle(record) {
  return record?.title?.trim() || "未命名记录";
}

function getDateHistoryGroups(record, category) {
  if (!record || !category) {
    return [];
  }

  return category.fields
    .filter((field) => field.type === "date")
    .map((field) => ({
      key: field.key,
      label: field.label,
      type: "date",
      entries: Array.isArray(record.dateHistory?.[field.key])
        ? record.dateHistory[field.key]
        : [],
    }));
}

function getRecordHistoryGroups(record, category) {
  return [
    {
      key: "status",
      label: "状态变化",
      type: "status",
      entries: (record?.history ?? []).map((entry) => ({
        id: entry.id,
        date: entry.date,
        item: entry.summary || entry.status || "状态更新",
      })),
    },
    {
      key: "todo",
      label: "Todo完成",
      type: "todo",
      entries: (record?.todoHistory ?? [])
        .filter((entry) => entry.doneDate != null)
        .map((entry) => ({
          id: entry.id,
          date: entry.doneDate,
          item: entry.item || "完成Todo项",
        })),
    },
    ...getDateHistoryGroups(record, category),
  ];
}

function DateHistorySummary({ groups, compact = false, onDeleteEntry, onUpdateEntry }) {
  const hasEntries = groups.some((group) => group.entries.length > 0);

  return (
    <div className={compact ? "graph-history-summary compact" : "graph-history-summary"}>
      {!compact && <h3>历史记录</h3>}
      {hasEntries ? (
        groups.map(
          (group) =>
            group.entries.length > 0 && (
              <section key={group.key} className="graph-history-group">
                <strong>{group.label}</strong>
                <div className="graph-history-table">
                  <div className="graph-history-row head">
                    <span>日期</span>
                    <span>事项</span>
                  </div>
                  {[...group.entries].reverse().map((entry) => (
                    <div key={entry.id} className={`graph-history-row history-type-${group.type || "date"}`}>
                      <span>{entry.date || "-"}</span>
                      <span className="history-item-cell">
                      {onUpdateEntry ? (
                        <input
                          className="history-item-input"
                          value={entry.item || ""}
                          title={entry.item || "未填写事项"}
                          onChange={(event) =>
                            onUpdateEntry(group.key, entry.id, event.target.value)
                          }
                          onClick={(event) => event.stopPropagation()}
                          aria-label="编辑历史事项"
                        />
                      ) : (
                        <span className="history-item-text" title={entry.item || "未填写事项"}>
                          {entry.item || "未填写事项"}
                        </span>
                      )}
                        {!compact && onDeleteEntry && (
                          <button
                            className="history-delete-btn"
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteEntry(group.key, entry.id); }}
                            title="删除此记录"
                          >×</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ),
        )
      ) : (
        <div className="graph-history-empty">暂无历史记录</div>
      )}
    </div>
  );
}

function RecordNode({ data }) {
  const h = data.handlers ?? {};
  const todoLines = (data.todoText ?? "").split(/\r?\n/).filter((l) => l.trim());
  const todoHistByItem = new Map((data.todoHistory ?? []).map((e) => [e.item, e]));
  const [todoDraft, setTodoDraft] = useState("");
  const [dateVal, setDateVal] = useState(data.dateValue ?? "");
  const [dateItem, setDateItem] = useState("");

  function handleTodoKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = todoDraft.trim();
      if (!val) return;
      h.addTodo?.(val);
      setTodoDraft("");
    }
  }

  function handleDateConfirm() {
    const d = dateVal.trim() || new Date().toISOString().slice(0, 10);
    h.addDate?.(d, dateItem.trim());
    setDateItem("");
  }

  function handleDateKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleDateConfirm();
    }
  }

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div className="graph-node-content">
        <div className="graph-node-meta">
          <span
            className="graph-node-category"
            style={{ color: data.categoryAccent, background: data.categoryTint }}
          >
            {data.categoryName}
          </span>
          <select
            className="graph-node-status-select nodrag nopan"
            style={{
              color: data.statusColor,
              background: data.statusBg,
              borderColor: data.statusBorder,
            }}
            value={data.status}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => h.updateStatus?.(event.target.value)}
            aria-label={`${data.title} 状态`}
          >
            {(data.statusOptions ?? STATUSES).map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <strong>{data.title}</strong>

        {/* inline todo */}
        <div className="graph-node-todo">
          {todoLines.map((line, idx) => {
            const hist = todoHistByItem.get(line);
            const done = hist?.doneDate != null;
            if (done) return null;
            return (
              <label key={idx} className="graph-node-todo-item">
                <input
                  type="checkbox"
                  onChange={() => h.toggleTodo?.(line)}
                />
                <span>{line}</span>
                <button
                  className="graph-node-todo-del"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); h.deleteTodo?.(line); }}
                >×</button>
              </label>
            );
          })}
          <input
            className="graph-node-input"
            placeholder="+待办"
            value={todoDraft}
            onChange={(e) => setTodoDraft(e.target.value)}
            onKeyDown={handleTodoKey}
          />
          {todoLines.some((l) => (todoHistByItem.get(l)?.doneDate != null)) && (
            <div
              className="graph-node-todo-done-popover"
              ref={(el) => {
                if (!el) return;
                const rect = el.parentElement?.getBoundingClientRect();
                if (!rect) return;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                let left = rect.right + 6;
                let top = rect.top;
                if (left + 170 > vw - 10) left = rect.left - 176;
                if (top + 120 > vh - 10) top = vh - 130;
                if (top < 0) top = 4;
                el.style.top = top + "px";
                el.style.left = left + "px";
              }}
            >
              <div className="graph-node-todo-done-title">已完成</div>
              {todoLines.map((line, idx) => {
                const hist = todoHistByItem.get(line);
                if (hist?.doneDate == null) return null;
                return (
                  <label key={idx} className="graph-node-todo-item done">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => h.toggleTodo?.(line)}
                    />
                    <span>{line}</span>
                    <span className="graph-node-todo-done-date">{hist.doneDate}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* inline date */}
        <div className="graph-node-date">
          <input
            className="graph-node-input graph-node-date-input"
            type="date"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
          />
          <input
            className="graph-node-input"
            placeholder="事项"
            value={dateItem}
            onChange={(e) => setDateItem(e.target.value)}
            onKeyDown={handleDateKey}
          />
          <button className="graph-node-confirm" onClick={handleDateConfirm}>✓</button>
        </div>

        <div className="graph-node-history-popover">
          <DateHistorySummary groups={data.dateHistories} compact />
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

const NODE_TYPES = {
  record: RecordNode,
};

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

function GraphField({
  field,
  record,
  statusOptions,
  statusById,
  onChange,
  onDateChange,
  onHistoryItemChange,
  onOpenExternal,
  onToggleTodo,
  onDeleteTodo,
  onDeleteDateHistory,
  onDeleteStatusHistory,
  onDeleteTodoHistory,
  onUpdateStatusHistory,
  onUpdateTodoHistory,
}) {
  if (field.type === "status") {
    const status = statusById[record.status] ?? statusOptions[0] ?? STATUSES[0];
    return (
      <PortalPopover
        className="status-history-field"
        popover={
          <StatusHistoryPopover
            history={record.history}
            todoHistory={record.todoHistory ?? []}
            onDeleteStatus={onDeleteStatusHistory}
            onDeleteTodo={onDeleteTodoHistory}
            onUpdateStatus={onUpdateStatusHistory}
            onUpdateTodo={onUpdateTodoHistory}
          />
        }
      >
        <select
          className="graph-form-control status-select"
          style={{
            "--status-bg": status.bg,
            "--status-color": status.color,
            "--status-border": status.border,
          }}
          value={record.status ?? ""}
          onChange={(event) => onChange(field.key, event.target.value)}
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

  if (field.type === "textarea") {
    if (field.key === "todo" && onToggleTodo) {
      const todoText = record.todo ?? "";
      const lines = todoText.split(/\r?\n/).filter((l) => l.trim());
      const todoHistory = record.todoHistory ?? [];
      const histByItem = new Map(todoHistory.map((e) => [e.item, e]));
      function addTodoLine(text) {
        const val = text.trim();
        if (!val) return;
        const newText = todoText ? todoText + "\n" + val : val;
        onChange(field.key, newText);
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
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onDeleteTodo) onDeleteTodo(field.key, trimmed); }}
                    title="删除此项"
                  >×</button>
                  <input
                    type="checkbox"
                    className="todo-checkbox"
                    onChange={() => onToggleTodo(field.key, trimmed)}
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
                      onChange={() => onToggleTodo(field.key, trimmed)}
                    />
                    <span className="todo-text">{trimmed}</span>
                    <span className="todo-date">{hist?.doneDate || ""}</span>
                  </label>
                );
              })}
            </div>
          )}
          <textarea
            className="graph-form-control graph-textarea todo-new-input"
            rows={1}
            onKeyDown={handleTodoKeydown}
            placeholder="输入待办，回车添加"
          />
        </div>
      );
    }
    return (
      <textarea
        className="graph-form-control graph-textarea"
        value={record[field.key] ?? ""}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  }

  if (field.type === "date") {
    return (
      <DateHistoryField
        value={record[field.key] ?? ""}
        history={record.dateHistory?.[field.key] ?? []}
        label={`${recordTitle(record)} ${field.label}`}
        resetKey={`${record.id}-${field.key}`}
        inputClassName="graph-form-control"
        itemClassName="graph-form-control"
        onDateChange={(date, item) => onDateChange(field.key, date, item)}
        onHistoryItemChange={(historyId, item) =>
          onHistoryItemChange(field.key, historyId, item)
        }
        onDeleteHistory={(historyId) => onDeleteDateHistory?.(field.key, historyId)}
      />
    );
  }

  if (field.type === "url") {
    const url = normalizeExternalUrl(record[field.key]);
    return (
      <div className="graph-url-field">
        <input
          className="graph-form-control"
          type="text"
          value={record[field.key] ?? ""}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
        <button
          className="graph-icon-button"
          type="button"
          disabled={!url}
          onClick={() => onOpenExternal(record[field.key])}
          title={url ? "用默认浏览器打开" : "没有可打开的网址"}
        >
          <ExternalLink size={15} />
        </button>
      </div>
    );
  }

  if (field.type === "path") {
    return (
      <div className="graph-path-field">
        <input
          className="graph-form-control"
          type="text"
          value={record[field.key] ?? ""}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
        <CopyIconButton
          value={record[field.key]}
          label={field.label}
          className="graph-copy-icon-button"
        />
      </div>
    );
  }

  return (
    <input
      className="graph-form-control"
      type={field.type === "date" ? "date" : "text"}
      value={record[field.key] ?? ""}
      onChange={(event) => onChange(field.key, event.target.value)}
    />
  );
}

function GraphCanvas({
  records,
  statusOptions,
  graphNodes,
  graphEdges,
  graphCategoryFilter,
  graphStatusFilter,
  setGraphNodes,
  setGraphEdges,
  selectedElement,
  setSelectedElement,
  addRecordFromGraph,
  toggleTodoItem,
  deleteTodoItem,
  deleteDateHistoryItem,
  deleteStatusHistoryItem,
  deleteTodoHistoryItem,
  syncTodoItems,
  updateRecord,
  updateRecordDate,
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [contextMenu, setContextMenu] = useState(null);
  const [contextCategory, setContextCategory] = useState(CATEGORIES[0].id);
  const contextMenuRef = useRef(null);
  const recordById = useMemo(
    () => Object.fromEntries(records.map((record) => [record.id, record])),
    [records],
  );
  const statusById = useMemo(
    () => Object.fromEntries(statusOptions.map((status) => [status.id, status])),
    [statusOptions],
  );

  const flowNodes = useMemo(
    () =>
      graphNodes
        .filter((node) => {
          const record = recordById[node.data.recordId];
          if (!record) {
            return true;
          }
          const matchesCategory =
            graphCategoryFilter === "all" || record.categoryId === graphCategoryFilter;
          const matchesStatus =
            graphStatusFilter === "all" || record.status === graphStatusFilter;
          return matchesCategory && matchesStatus;
        })
        .map((node) => {
        const record = recordById[node.data.recordId];
        const category = CATEGORY_BY_ID[node.data.categoryId] ?? CATEGORIES[0];
        const status = statusById[record?.status] ?? statusOptions[0] ?? STATUSES[0];
        const dateField = category.fields.find((f) => f.type === "date");
        const dateKey = dateField?.key ?? "";
        return {
          ...node,
          type: "record",
          data: {
            ...node.data,
            categoryName: category.name,
            categoryAccent: category.accent,
            categoryTint: category.tint,
            title: recordTitle(record),
            status: record?.status ?? "记录已删除",
            statusColor: status.color,
            statusBg: status.bg,
            statusBorder: status.border,
            dateHistories: getRecordHistoryGroups(record, category),
            todoText: record?.todo ?? "",
            todoHistory: record?.todoHistory ?? [],
            dateKey,
            dateValue: record?.[dateKey] ?? "",
            dateHistoryEntries: record?.dateHistory?.[dateKey] ?? [],
            recordId: node.data.recordId,
            statusOptions,
            handlers: {
              addTodo: (text) => {
                const val = text.trim();
                if (!val || !record) return;
                const newText = record.todo ? record.todo + "\n" + val : val;
                updateRecord?.(record.id, { todo: newText });
                syncTodoItems?.(record.id, newText);
              },
              toggleTodo: (text) => toggleTodoItem?.(record?.id, text),
              deleteTodo: (text) => deleteTodoItem?.(record?.id, text),
              addDate: (date, item) => {
                if (dateKey && record) updateRecordDate?.(record.id, dateKey, date, item);
              },
              updateStatus: (nextStatus) => {
                if (record && nextStatus !== record.status) {
                  updateRecord?.(record.id, { status: nextStatus });
                }
              },
            },
          },
          style: {
            borderColor: status.border,
            background: `color-mix(in srgb, ${status.bg} 62%, #ffffff)`,
            borderRadius: 5,
            width: 180,
            padding: 6,
            boxShadow:
              selectedElement?.type === "node" && selectedElement.id === node.id
                ? `0 0 0 3px ${status.border}`
                : "0 4px 14px rgba(15, 23, 42, 0.1)",
          },
        };
      }),
    [
      graphNodes,
      recordById,
      selectedElement,
      toggleTodoItem,
      deleteTodoItem,
      updateRecord,
      updateRecordDate,
      syncTodoItems,
      statusOptions,
      statusById,
      graphCategoryFilter,
      graphStatusFilter,
    ],
  );

  const visibleNodeIds = useMemo(
    () => new Set(flowNodes.map((node) => node.id)),
    [flowNodes],
  );

  const flowEdges = useMemo(
    () =>
      graphEdges
        .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
        .map((edge) => ({
        ...edge,
        label: edge.data?.label?.trim() || edge.data?.relationType || "前置依赖",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#475569",
        },
        style: {
          stroke:
            selectedElement?.type === "edge" && selectedElement.id === edge.id
              ? "#2563eb"
              : "#64748b",
          strokeWidth:
            selectedElement?.type === "edge" && selectedElement.id === edge.id ? 2.5 : 1.8,
        },
        labelStyle: {
          fill: "#334155",
          fontSize: 11,
          fontWeight: 650,
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.92,
        },
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
      })),
    [graphEdges, selectedElement, visibleNodeIds],
  );

  useEffect(() => {
    if (!selectedElement) {
      return;
    }
    if (selectedElement.type === "node" && !visibleNodeIds.has(selectedElement.id)) {
      setSelectedElement(null);
      return;
    }
    if (selectedElement.type === "edge" && !flowEdges.some((edge) => edge.id === selectedElement.id)) {
      setSelectedElement(null);
    }
  }, [flowEdges, selectedElement, setSelectedElement, visibleNodeIds]);

  const addRecordNode = useCallback(
    (recordId, position) => {
      const record = recordById[recordId];
      if (!record) {
        return;
      }

      const existing = graphNodes.find((node) => node.data.recordId === recordId);
      if (existing) {
        setSelectedElement({ type: "node", id: existing.id });
        return;
      }

      const node = {
        id: createGraphId("node"),
        position,
        data: {
          recordId,
          categoryId: record.categoryId,
        },
      };
      setGraphNodes((current) => [...current, node]);
      setSelectedElement({ type: "node", id: node.id });
    },
    [graphNodes, recordById, setGraphNodes, setSelectedElement],
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const recordId = event.dataTransfer.getData(DRAG_TYPE);
      if (!recordId) {
        return;
      }

      addRecordNode(
        recordId,
        screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      );
    },
    [addRecordNode, screenToFlowPosition],
  );

  const onNodesChange = useCallback(
    (changes) => {
      const removedIds = new Set(
        changes.filter((change) => change.type === "remove").map((change) => change.id),
      );
      setGraphNodes((current) => applyNodeChanges(changes, current));
      if (removedIds.size > 0) {
        setGraphEdges((current) =>
          current.filter(
            (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target),
          ),
        );
        if (selectedElement?.type === "node" && removedIds.has(selectedElement.id)) {
          setSelectedElement(null);
        }
      }
    },
    [selectedElement, setGraphEdges, setGraphNodes, setSelectedElement],
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const removedIds = new Set(
        changes.filter((change) => change.type === "remove").map((change) => change.id),
      );
      setGraphEdges((current) => applyEdgeChanges(changes, current));
      if (selectedElement?.type === "edge" && removedIds.has(selectedElement.id)) {
        setSelectedElement(null);
      }
    },
    [selectedElement, setGraphEdges, setSelectedElement],
  );

  const onConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      const edge = {
        ...connection,
        id: createGraphId("edge"),
        type: "smoothstep",
        data: {
          relationType: "前置依赖",
          label: "",
          description: "",
        },
      };
      setGraphEdges((current) => addEdge(edge, current));
      setSelectedElement({ type: "edge", id: edge.id });
    },
    [setGraphEdges, setSelectedElement],
  );

  const handleContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      const nodeEl = event.target.closest(".react-flow__node");
      if (nodeEl) {
        const nodeId = nodeEl.getAttribute("data-id");
        const node = graphNodes.find((n) => n.id === nodeId);
        const record = node ? recordById[node.data.recordId] : null;
        setSelectedElement(node ? { type: "node", id: nodeId } : null);
        setContextCategory(record?.categoryId ?? CATEGORIES[0].id);
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          sourceNodeId: nodeId,
        });
      } else {
        const edgeEl = event.target.closest(".react-flow__edge");
        if (edgeEl) {
          return;
        }
        setContextCategory(CATEGORIES[0].id);
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          sourceNodeId: null,
        });
      }
    },
    [graphNodes, recordById, setSelectedElement],
  );

  useEffect(() => {
    if (!contextMenu) return;
    function onMouseDown(e) {
      if (contextMenuRef.current?.contains(e.target)) return;
      setContextMenu(null);
    }
    function onKey(e) {
      if (e.key === "Escape") setContextMenu(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  function handleContextCreate() {
    if (!contextMenu) return;
    const pos = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
    addRecordFromGraph(contextCategory, pos, contextMenu.sourceNodeId);
    setContextMenu(null);
  }

  return (
    <>
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_event, node) => setSelectedElement({ type: "node", id: node.id })}
      onEdgeClick={(_event, edge) => setSelectedElement({ type: "edge", id: edge.id })}
      onPaneClick={() => setSelectedElement(null)}
      onContextMenu={handleContextMenu}
      onDrop={onDrop}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      fitView
      minZoom={0.2}
      maxZoom={2}
      deleteKeyCode={["Backspace", "Delete"]}
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background color="#cbd5e1" gap={22} size={1} />
      <MiniMap
        nodeColor={(node) =>
          statusById[recordById[node.data.recordId]?.status]?.border ?? "#94a3b8"
        }
        maskColor="rgba(241, 245, 249, 0.78)"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
    {contextMenu && (
      <div className="graph-context-menu" ref={contextMenuRef} style={{ left: contextMenu.x, top: contextMenu.y }}>
        <div className="graph-context-menu-header">
          {contextMenu.sourceNodeId ? "从此节点衍生新建" : "新建节点"}
        </div>
        <div className="graph-context-menu-options">
          {CATEGORIES.map((cat) => (
            <label key={cat.id} className="graph-context-radio">
              <input
                type="radio"
                name="graph-context-category"
                value={cat.id}
                checked={contextCategory === cat.id}
                onChange={() => setContextCategory(cat.id)}
              />
              <span>{cat.name}</span>
            </label>
          ))}
        </div>
        <button
          className="graph-context-create-button"
          type="button"
          onClick={handleContextCreate}
        >
          确定新建
        </button>
      </div>
    )}
    </>
  );
}

export default function KnowledgeGraph({
  records,
  statusOptions = STATUSES,
  updateRecord,
  graphNodes,
  graphEdges,
  setGraphNodes,
  setGraphEdges,
  openExternalUrl,
  updateRecordDate,
  updateDateHistoryItem,
  addRecordFromGraph,
  toggleTodoItem,
  deleteTodoItem,
  deleteDateHistoryItem,
  deleteStatusHistoryItem,
  deleteTodoHistoryItem,
  updateStatusHistoryItem,
  updateTodoHistoryItem,
  syncTodoItems,
}) {
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceCategory, setSourceCategory] = useState("all");
  const [graphCategoryFilter, setGraphCategoryFilter] = useState("all");
  const [graphStatusFilter, setGraphStatusFilter] = useState("all");
  const [selectedElement, setSelectedElement] = useState(null);
  const graphStatusById = useMemo(
    () => Object.fromEntries(statusOptions.map((status) => [status.id, status])),
    [statusOptions],
  );
  const graphStatusPriority = useMemo(
    () => new Map(statusOptions.map((status) => [status.id, status.priority])),
    [statusOptions],
  );

  const graphRecordIds = useMemo(
    () => new Set(graphNodes.map((node) => node.data.recordId)),
    [graphNodes],
  );
  const visibleGraphNodeCount = useMemo(
    () =>
      graphNodes.filter((node) => {
        const record = records.find((item) => item.id === node.data.recordId);
        if (!record) {
          return true;
        }
        const matchesCategory =
          graphCategoryFilter === "all" || record.categoryId === graphCategoryFilter;
        const matchesStatus =
          graphStatusFilter === "all" || record.status === graphStatusFilter;
        return matchesCategory && matchesStatus;
      }).length,
    [graphCategoryFilter, graphNodes, graphStatusFilter, records],
  );

  const visibleSourceRecords = useMemo(() => {
    const keyword = sourceSearch.trim().toLowerCase();
    return records
      .filter((record) => {
        const matchesCategory =
          sourceCategory === "all" || record.categoryId === sourceCategory;
        if (!matchesCategory) {
          return false;
        }
        if (!keyword) {
          return true;
        }

        return [record.id, record.title, record.description, record.todo, record.status]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((left, right) => {
        const leftPriority = graphStatusPriority.get(left.status) ?? Number.MAX_SAFE_INTEGER;
        const rightPriority = graphStatusPriority.get(right.status) ?? Number.MAX_SAFE_INTEGER;
        return (
          leftPriority - rightPriority ||
          String(left.title ?? "").localeCompare(String(right.title ?? ""), "zh-Hans-CN")
        );
      });
  }, [graphStatusPriority, records, sourceCategory, sourceSearch]);

  const selectedNode =
    selectedElement?.type === "node"
      ? graphNodes.find((node) => node.id === selectedElement.id)
      : null;
  const selectedRecord = selectedNode
    ? records.find((record) => record.id === selectedNode.data.recordId)
    : null;
  const selectedEdge =
    selectedElement?.type === "edge"
      ? graphEdges.find((edge) => edge.id === selectedElement.id)
      : null;
  const selectedCategory = selectedRecord
    ? CATEGORY_BY_ID[selectedRecord.categoryId]
    : null;

  function addRecordAtDefaultPosition(record) {
    const existing = graphNodes.find((node) => node.data.recordId === record.id);
    if (existing) {
      setSelectedElement({ type: "node", id: existing.id });
      return;
    }

    const column = graphNodes.length % 4;
    const row = Math.floor(graphNodes.length / 4);
    const node = {
      id: createGraphId("node"),
      position: {
        x: 60 + column * 170,
        y: 60 + row * 110,
      },
      data: {
        recordId: record.id,
        categoryId: record.categoryId,
      },
    };
    setGraphNodes((current) => [...current, node]);
    setSelectedElement({ type: "node", id: node.id });
  }

  function cycleRecordStatus(record) {
    const currentIndex = statusOptions.findIndex((status) => status.id === record.status);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % statusOptions.length : 0;
    updateRecord(record.id, { status: statusOptions[nextIndex]?.id ?? STATUSES[0].id });
  }

  function deleteSelectedNode() {
    if (!selectedNode) {
      return;
    }
    setGraphNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setGraphEdges((current) =>
      current.filter(
        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id,
      ),
    );
    setSelectedElement(null);
  }

  function deleteSelectedEdge() {
    if (!selectedEdge) {
      return;
    }
    setGraphEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id));
    setSelectedElement(null);
  }

  function updateSelectedEdge(patch) {
    if (!selectedEdge) {
      return;
    }
    setGraphEdges((current) =>
      current.map((edge) =>
        edge.id === selectedEdge.id
          ? {
              ...edge,
              data: {
                ...edge.data,
                ...patch,
              },
            }
          : edge,
      ),
    );
  }

  function nodeTitle(nodeId) {
    const node = graphNodes.find((item) => item.id === nodeId);
    const record = node
      ? records.find((item) => item.id === node.data.recordId)
      : null;
    return recordTitle(record);
  }

  return (
    <section className="graph-workspace">
      <aside className="graph-source-panel">
        <div className="graph-panel-header">
          <div>
            <p>数据源</p>
            <h2>拖入知识图谱</h2>
          </div>
          <span className="graph-count">{records.length}</span>
        </div>

        <label className="graph-search">
          <Search size={15} />
          <input
            type="search"
            placeholder="搜索记录"
            value={sourceSearch}
            onChange={(event) => setSourceSearch(event.target.value)}
          />
        </label>

        <select
          className="graph-category-filter"
          value={sourceCategory}
          onChange={(event) => setSourceCategory(event.target.value)}
          aria-label="图谱数据源类别"
        >
          <option value="all">全部类别</option>
          {CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="graph-source-list">
          {visibleSourceRecords.map((record) => {
            const category = CATEGORY_BY_ID[record.categoryId] ?? CATEGORIES[0];
                const status = graphStatusById[record.status] ?? statusOptions[0] ?? STATUSES[0];
            const inGraph = graphRecordIds.has(record.id);
            return (
              <article
                key={record.id}
                className={`graph-source-item ${inGraph ? "in-graph" : ""}`}
                draggable={!inGraph}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_TYPE, record.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                style={{ "--source-accent": category.accent }}
              >
                <GripVertical size={15} />
                <div>
                  <span>{category.name}</span>
                  <strong>{recordTitle(record)}</strong>
                  <button
                    className="graph-source-status-button"
                    type="button"
                    style={{
                      color: status.color,
                      background: status.bg,
                      borderColor: status.border,
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      cycleRecordStatus(record);
                    }}
                    title={`当前状态：${status.label}，点击切换`}
                    aria-label={`${recordTitle(record)} 当前状态 ${status.label}，点击切换`}
                  >
                    {status.label}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => addRecordAtDefaultPosition(record)}
                  title={inGraph ? "定位图中节点" : "添加到图谱"}
                  aria-label={`${inGraph ? "定位" : "添加"} ${recordTitle(record)}`}
                >
                  <Plus size={14} />
                </button>
              </article>
            );
          })}
        </div>
      </aside>

      <div className="graph-canvas-panel">
        <div className="graph-display-filters">
          <select
            value={graphCategoryFilter}
            onChange={(event) => setGraphCategoryFilter(event.target.value)}
            aria-label="图谱显示类别"
          >
            <option value="all">显示全部类别</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={graphStatusFilter}
            onChange={(event) => setGraphStatusFilter(event.target.value)}
            aria-label="图谱显示状态"
            style={
              graphStatusFilter === "all"
                ? undefined
                : {
                    color: graphStatusById[graphStatusFilter]?.color,
                    background: graphStatusById[graphStatusFilter]?.bg,
                    borderColor: graphStatusById[graphStatusFilter]?.border,
                  }
            }
          >
            <option value="all">显示全部状态</option>
            {statusOptions.map((status) => (
              <option
                key={status.id}
                value={status.id}
                style={{
                  color: status.color,
                  backgroundColor: status.bg,
                }}
              >
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <ReactFlowProvider>
          <GraphCanvas
            records={records}
            statusOptions={statusOptions}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            graphCategoryFilter={graphCategoryFilter}
            graphStatusFilter={graphStatusFilter}
            setGraphNodes={setGraphNodes}
            setGraphEdges={setGraphEdges}
            selectedElement={selectedElement}
            setSelectedElement={setSelectedElement}
            addRecordFromGraph={addRecordFromGraph}
            toggleTodoItem={toggleTodoItem}
            deleteTodoItem={deleteTodoItem}
            deleteDateHistoryItem={deleteDateHistoryItem}
            deleteStatusHistoryItem={deleteStatusHistoryItem}
            deleteTodoHistoryItem={deleteTodoHistoryItem}
            syncTodoItems={syncTodoItems}
            updateRecord={updateRecord}
            updateRecordDate={updateRecordDate}
          />
        </ReactFlowProvider>
        {(graphNodes.length === 0 || visibleGraphNodeCount === 0) && (
          <div className="graph-empty-hint">
            {graphNodes.length === 0
              ? "从左侧拖入记录，再从节点端口拖线建立依赖关系"
              : "当前筛选条件下没有可显示的图谱节点"}
          </div>
        )}
      </div>

      <aside className="graph-detail-panel">
        {selectedRecord && selectedCategory && (
          <>
            <div className="graph-panel-header detail">
              <div>
                <p style={{ color: selectedCategory.accent }}>{selectedCategory.name}节点</p>
                <h2>{recordTitle(selectedRecord)}</h2>
                <small>ID：{selectedRecord.id}</small>
              </div>
              <button
                className="graph-delete-button"
                type="button"
                onClick={deleteSelectedNode}
                title="从图谱移除节点，不删除原始记录"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="graph-detail-form">
              {selectedCategory.fields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                <GraphField
                  field={field}
                  record={selectedRecord}
                  statusOptions={statusOptions}
                  statusById={graphStatusById}
                  onChange={(key, value) => updateRecord(selectedRecord.id, { [key]: value })}
                    onDateChange={(key, date, item) =>
                      updateRecordDate(selectedRecord.id, key, date, item)
                    }
                    onHistoryItemChange={(key, historyId, item) =>
                      updateDateHistoryItem(selectedRecord.id, key, historyId, item)
                    }
                    onOpenExternal={openExternalUrl}
                    onToggleTodo={(key, item) => toggleTodoItem(selectedRecord.id, item)}
                    onDeleteTodo={(key, item) => deleteTodoItem(selectedRecord.id, item)}
                    onDeleteDateHistory={(key, historyId) =>
                      deleteDateHistoryItem(selectedRecord.id, key, historyId)
                    }
                    onDeleteStatusHistory={(historyId) =>
                      deleteStatusHistoryItem(selectedRecord.id, historyId)
                    }
                  onDeleteTodoHistory={(historyId) =>
                    deleteTodoHistoryItem(selectedRecord.id, historyId)
                  }
                  onUpdateStatusHistory={(historyId, summary) =>
                    updateStatusHistoryItem(selectedRecord.id, historyId, summary)
                  }
                  onUpdateTodoHistory={(historyId, item) =>
                    updateTodoHistoryItem(selectedRecord.id, historyId, item)
                  }
                />
                </label>
              ))}
            </div>
            <DateHistorySummary
              groups={getRecordHistoryGroups(selectedRecord, selectedCategory)}
            onDeleteEntry={(groupKey, entryId) => {
              if (groupKey === "status") deleteStatusHistoryItem(selectedRecord.id, entryId);
              else if (groupKey === "todo") deleteTodoHistoryItem(selectedRecord.id, entryId);
              else deleteDateHistoryItem(selectedRecord.id, groupKey, entryId);
            }}
            onUpdateEntry={(groupKey, entryId, item) => {
              if (groupKey === "status") updateStatusHistoryItem(selectedRecord.id, entryId, item);
              else if (groupKey === "todo") updateTodoHistoryItem(selectedRecord.id, entryId, item);
              else updateDateHistoryItem(selectedRecord.id, groupKey, entryId, item);
            }}
          />
          </>
        )}

        {selectedEdge && (
          <>
            <div className="graph-panel-header detail">
              <div>
                <p>关系</p>
                <h2>
                  {nodeTitle(selectedEdge.source)} → {nodeTitle(selectedEdge.target)}
                </h2>
                <small>ID：{selectedEdge.id}</small>
              </div>
              <button
                className="graph-delete-button"
                type="button"
                onClick={deleteSelectedEdge}
                title="删除关系"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="graph-detail-form">
              <label>
                <span>关系类型</span>
                <select
                  className="graph-form-control"
                  value={selectedEdge.data?.relationType ?? "前置依赖"}
                  onChange={(event) =>
                    updateSelectedEdge({ relationType: event.target.value })
                  }
                >
                  {RELATION_TYPES.map((relationType) => (
                    <option key={relationType} value={relationType}>
                      {relationType}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>连线名称</span>
                <input
                  className="graph-form-control"
                  type="text"
                  value={selectedEdge.data?.label ?? ""}
                  onChange={(event) => updateSelectedEdge({ label: event.target.value })}
                  placeholder="默认显示关系类型"
                />
              </label>

              <label>
                <span>关系说明</span>
                <textarea
                  className="graph-form-control graph-textarea relation-description"
                  value={selectedEdge.data?.description ?? ""}
                  onChange={(event) =>
                    updateSelectedEdge({ description: event.target.value })
                  }
                />
              </label>
            </div>
          </>
        )}

        {!selectedRecord && !selectedEdge && (
          <div className="graph-detail-empty">
            <strong>选择节点或关系</strong>
            <span>节点显示并编辑原始记录，关系显示前后依赖信息。</span>
          </div>
        )}
      </aside>
    </section>
  );
}
