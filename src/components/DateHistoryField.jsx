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
  const [draftDate, setDraftDate] = useState(value ?? "");
  const [item, setItem] = useState("");

  useEffect(() => {
    setDraftDate(value ?? "");
    setItem("");
  }, [resetKey, value]);

  function handleConfirm() {
    const date = draftDate.trim() || new Date().toISOString().slice(0, 10);
    onDateChange(date, item.trim());
    setItem("");
    setDraftDate(date);
  }

  function handleItemKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
  }

  return (
    <div className="date-history-field">
      <div className="date-history-row">
        <input
          className={inputClassName}
          type="date"
          value={draftDate}
          onFocus={onFocus}
          onChange={(e) => setDraftDate(e.target.value)}
          aria-label={label}
        />
        <input
          className={itemClassName}
          type="text"
          value={item}
          onFocus={onFocus}
          onChange={(e) => setItem(e.target.value)}
          onKeyDown={handleItemKeydown}
          placeholder="填写本次事项"
          aria-label={`${label}事项`}
        />
        <button
          className="date-confirm-btn"
          type="button"
          onClick={handleConfirm}
          title="确认添加（日期为空则默认今天）"
        >
          ✓
        </button>
      </div>

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
