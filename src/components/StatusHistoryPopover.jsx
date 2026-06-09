export default function StatusHistoryPopover({ history = [] }) {
  return (
    <div className="status-history-popover" role="tooltip">
      <div className="date-history-title">状态历史</div>
      <div className="date-history-table date-history-head">
        <span>日期</span>
        <span>事项</span>
      </div>
      {history.length > 0 ? (
        [...history].reverse().map((entry) => (
          <div key={entry.id} className="date-history-table">
            <span>{entry.date || "-"}</span>
            <span>{entry.summary || entry.status || "状态更新"}</span>
          </div>
        ))
      ) : (
        <div className="date-history-empty">暂无状态历史</div>
      )}
    </div>
  );
}
