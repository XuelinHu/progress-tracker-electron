import { useCallback, useMemo, useState } from "react";
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
import { CATEGORIES, CATEGORY_BY_ID } from "../data/categories.js";
import { STATUSES, STATUS_BY_ID } from "../data/statuses.js";
import "../styles/graph.css";

const DRAG_TYPE = "application/progress-record";
const RELATION_TYPES = ["前置依赖", "产出", "引用", "复用", "参与", "关联", "自定义"];

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
      entries: (record?.history ?? []).map((entry) => ({
        id: entry.id,
        date: entry.date,
        item: entry.summary || entry.status || "状态更新",
      })),
    },
    ...getDateHistoryGroups(record, category),
  ];
}

function DateHistorySummary({ groups, compact = false }) {
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
                    <div key={entry.id} className="graph-history-row">
                      <span>{entry.date || "-"}</span>
                      <span>{entry.item || "未填写事项"}</span>
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
          <small
            className="graph-node-status"
            style={{
              color: data.statusColor,
              background: data.statusBg,
              borderColor: data.statusBorder,
            }}
          >
            {data.status}
          </small>
        </div>
        <strong>{data.title}</strong>
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
  onChange,
  onDateChange,
  onHistoryItemChange,
  onOpenExternal,
}) {
  if (field.type === "status") {
    const status = STATUS_BY_ID[record.status] ?? STATUSES[0];
    return (
      <div className="status-history-field">
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
          {STATUSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <StatusHistoryPopover history={record.history} />
      </div>
    );
  }

  if (field.type === "textarea") {
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
  graphNodes,
  graphEdges,
  setGraphNodes,
  setGraphEdges,
  selectedElement,
  setSelectedElement,
}) {
  const { screenToFlowPosition } = useReactFlow();
  const recordById = useMemo(
    () => Object.fromEntries(records.map((record) => [record.id, record])),
    [records],
  );

  const flowNodes = useMemo(
    () =>
      graphNodes.map((node) => {
        const record = recordById[node.data.recordId];
        const category = CATEGORY_BY_ID[node.data.categoryId] ?? CATEGORIES[0];
        const status = STATUS_BY_ID[record?.status] ?? STATUSES[0];
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
          },
          style: {
            borderColor: status.border,
            background: `color-mix(in srgb, ${status.bg} 62%, #ffffff)`,
            borderRadius: 5,
            width: 104,
            padding: 5,
            boxShadow:
              selectedElement?.type === "node" && selectedElement.id === node.id
                ? `0 0 0 3px ${status.border}`
                : "0 4px 14px rgba(15, 23, 42, 0.1)",
          },
        };
      }),
    [graphNodes, recordById, selectedElement],
  );

  const flowEdges = useMemo(
    () =>
      graphEdges.map((edge) => ({
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
    [graphEdges, selectedElement],
  );

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

  return (
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
          STATUS_BY_ID[recordById[node.data.recordId]?.status]?.border ?? "#94a3b8"
        }
        maskColor="rgba(241, 245, 249, 0.78)"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export default function KnowledgeGraph({
  records,
  updateRecord,
  graphNodes,
  graphEdges,
  setGraphNodes,
  setGraphEdges,
  openExternalUrl,
  updateRecordDate,
  updateDateHistoryItem,
}) {
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceCategory, setSourceCategory] = useState("all");
  const [selectedElement, setSelectedElement] = useState(null);

  const graphRecordIds = useMemo(
    () => new Set(graphNodes.map((node) => node.data.recordId)),
    [graphNodes],
  );

  const visibleSourceRecords = useMemo(() => {
    const keyword = sourceSearch.trim().toLowerCase();
    return records.filter((record) => {
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
    });
  }, [records, sourceCategory, sourceSearch]);

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
                  <small>{record.status || "未设置状态"}</small>
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
        <ReactFlowProvider>
          <GraphCanvas
            records={records}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            setGraphNodes={setGraphNodes}
            setGraphEdges={setGraphEdges}
            selectedElement={selectedElement}
            setSelectedElement={setSelectedElement}
          />
        </ReactFlowProvider>
        {graphNodes.length === 0 && (
          <div className="graph-empty-hint">
            从左侧拖入记录，再从节点端口拖线建立依赖关系
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
                    onChange={(key, value) => updateRecord(selectedRecord.id, { [key]: value })}
                    onDateChange={(key, date, item) =>
                      updateRecordDate(selectedRecord.id, key, date, item)
                    }
                    onHistoryItemChange={(key, historyId, item) =>
                      updateDateHistoryItem(selectedRecord.id, key, historyId, item)
                    }
                    onOpenExternal={openExternalUrl}
                  />
                </label>
              ))}
            </div>
            <DateHistorySummary
              groups={getRecordHistoryGroups(selectedRecord, selectedCategory)}
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
