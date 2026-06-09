import { useEffect, useState } from "react";

export default function DateHistoryField({
  value,
  history = [],
  label,
  resetKey,
  inputClassName,
  itemClassName,
  onFocus,
  onDateChange,
  onHistoryItemChange,
}) {
  const [item, setItem] = useState("");
  const [latestHistoryId, setLatestHistoryId] = useState(null);

  useEffect(() => {
    setItem("");
    setLatestHistoryId(null);
  }, [resetKey]);

  function handleDateChange(event) {
    const historyId = onDateChange(event.target.value, item.trim());
    setLatestHistoryId(historyId);
  }

  function handleItemChange(event) {
    const nextItem = event.target.value;
    setItem(nextItem);
    if (latestHistoryId) {
      onHistoryItemChange(latestHistoryId, nextItem);
    }
  }

  return (
    <div className="date-history-field">
      <input
        className={inputClassName}
        type="date"
        value={value ?? ""}
        onFocus={onFocus}
        onChange={handleDateChange}
        aria-label={label}
      />
      <input
        className={itemClassName}
        type="text"
        value={item}
        onFocus={onFocus}
        onChange={handleItemChange}
        placeholder="填写本次事项"
        aria-label={`${label}事项`}
      />

      <div className="date-history-popover" role="tooltip">
        <div className="date-history-title">历史记录</div>
        <div className="date-history-table date-history-head">
          <span>日期</span>
          <span>事项</span>
        </div>
        {history.length > 0 ? (
          [...history].reverse().map((entry) => (
            <div key={entry.id} className="date-history-table">
              <span>{entry.date || "-"}</span>
              <span>{entry.item || "未填写事项"}</span>
            </div>
          ))
        ) : (
          <div className="date-history-empty">暂无历史记录</div>
        )}
      </div>
    </div>
  );
}
