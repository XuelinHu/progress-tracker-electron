import CopyableControl from "./CopyableControl.jsx";

export default function StatusHistoryPopover({
  history = [],
  todoHistory = [],
  onDeleteStatus,
  onDeleteTodo,
  onUpdateStatus,
  onUpdateTodo,
}) {
  const statusEntries = [...history].reverse().map((entry) => ({
    id: entry.id,
    date: entry.date,
    text: entry.summary || entry.status || "状态更新",
    type: "status",
  }));
  const todoEntries = [...todoHistory]
    .filter((e) => e.doneDate != null)
    .reverse()
    .map((entry) => ({
      id: entry.id,
      date: entry.doneDate,
      text: `完成: ${entry.item}`,
      type: "todo",
    }));
  const allEntries = [...statusEntries, ...todoEntries].sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    return db.localeCompare(da) || b.id.localeCompare(a.id);
  });

  return (
    <>
      <div className="date-history-title">历史记录</div>
      <div className="date-history-table date-history-head">
        <span>日期</span>
        <span>事项</span>
      </div>
      {allEntries.length > 0 ? (
        allEntries.map((entry) => (
          <div key={entry.id} className={`date-history-table history-type-${entry.type}`}>
          <span>{entry.date || "-"}</span>
          <span className="history-item-cell">
            <CopyableControl
              value={entry.text}
              label="历史事项"
              className="history-item-copyable"
            >
              <input
                className="history-item-input"
                value={entry.text}
                title={entry.text}
                onChange={(event) => {
                  if (entry.type === "status") onUpdateStatus?.(entry.id, event.target.value);
                  if (entry.type === "todo") {
                    const next = event.target.value.replace(/^完成:\s*/, "");
                    onUpdateTodo?.(entry.id, next);
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                aria-label="编辑历史事项"
              />
            </CopyableControl>
            <button
              className="history-delete-btn"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (entry.type === "status") onDeleteStatus?.(entry.id);
                  if (entry.type === "todo") onDeleteTodo?.(entry.id);
                }}
                title="删除此记录"
              >×</button>
            </span>
          </div>
        ))
      ) : (
        <div className="date-history-empty">暂无历史记录</div>
      )}
    </>
  );
}
