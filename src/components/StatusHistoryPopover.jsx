export default function StatusHistoryPopover({ history = [], todoHistory = [] }) {
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
  const allEntries = [...statusEntries, ...todoEntries].sort(
    (a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      return db.localeCompare(da) || b.id.localeCompare(a.id);
    },
  );

  return (
    <div className="status-history-popover" role="tooltip">
      <div className="date-history-title">历史记录</div>
      <div className="date-history-table date-history-head">
        <span>日期</span>
        <span>事项</span>
      </div>
      {allEntries.length > 0 ? (
        allEntries.map((entry) => (
          <div key={entry.id} className={`date-history-table history-type-${entry.type}`}>
            <span>{entry.date || "-"}</span>
            <span>{entry.text}</span>
          </div>
        ))
      ) : (
        <div className="date-history-empty">暂无历史记录</div>
      )}
    </div>
  );
}
