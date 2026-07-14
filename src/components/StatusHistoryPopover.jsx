import CopyableControl from "./CopyableControl.jsx";
import InlineEditableText from "./InlineEditableText.jsx";

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
    addedDate: String(entry.createdAt || entry.date || "").slice(0, 10),
    text: entry.summary || entry.status || "状态更新",
    type: "status",
  }));
  const todoEntries = [...todoHistory]
    .filter((e) => e.doneDate != null)
    .reverse()
    .map((entry) => ({
      id: entry.id,
      date: entry.doneDate,
      addedDate: String(entry.addedAt || entry.createdAt || entry.addedDate || "").slice(0, 10),
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
        <span>日期 / 添加</span>
        <span>事项</span>
      </div>
      {allEntries.length > 0 ? (
        allEntries.map((entry) => (
          <div key={entry.id} className={`date-history-table history-type-${entry.type}`}>
          <span title={`添加日期：${entry.addedDate || "未知"}`}>
            {entry.date || "-"}
            <small className="history-added-date">添加 {entry.addedDate || "-"}</small>
          </span>
          <span className="history-item-cell">
            <CopyableControl
              value={entry.text}
              label="历史事项"
              className="history-item-copyable"
            >
              <InlineEditableText
                value={entry.text}
                className="history-item-text"
                inputClassName="history-item-input"
                title={`${entry.text}；添加日期：${entry.addedDate || "未知"}；双击编辑`}
                onCommit={(nextText) => {
                  if (entry.type === "status") onUpdateStatus?.(entry.id, nextText);
                  if (entry.type === "todo") onUpdateTodo?.(entry.id, nextText.replace(/^完成:\s*/, ""));
                }}
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
