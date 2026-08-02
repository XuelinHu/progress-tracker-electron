import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import CopyableControl from "./CopyableControl.jsx";
import InlineEditableText from "./InlineEditableText.jsx";

function addedDate(entry) {
  return String(entry?.addedAt || entry?.createdAt || entry?.date || "").slice(0, 10);
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DateHistoryField({
  value,
  history = [],
  label,
  resetKey,
  inputClassName,
  itemClassName,
  onFocus,
  onDateValueChange,
  onDateChange,
  onHistoryItemChange,
  onDeleteHistory,
  showHistory = true,
}) {
  const [draftDate, setDraftDate] = useState(value ?? "");
  const [item, setItem] = useState("");
  const [showPopover, setShowPopover] = useState(false);
  const [popPos, setPopPos] = useState({ top: 0, left: 0, above: false, maxWidth: 380 });
  const triggerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setDraftDate(value ?? "");
    setItem("");
  }, [resetKey, value]);

  function handleConfirm() {
    const date = draftDate.trim() || today();
    onDateChange(date, item.trim());
    setItem("");
    setDraftDate(date);
  }

  function handleDateInputChange(event) {
    const nextDate = event.target.value;
    setDraftDate(nextDate);
    onDateValueChange?.(nextDate);
  }

  function handleItemKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
  }

  const handleEnter = useCallback(() => {
    clearTimeout(timerRef.current);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const popHeight = 230;
    const popWidth = Math.min(380, vw - 20);
    const spaceBelow = vh - rect.bottom;
    const showAbove = spaceBelow < popHeight && rect.top > popHeight;
    setPopPos({
      top: showAbove ? rect.top - 4 : rect.bottom + 4,
      left: Math.min(rect.left, vw - popWidth - 10),
      above: showAbove,
      maxWidth: popWidth,
    });
    setShowPopover(true);
  }, []);

  const handleLeave = useCallback(() => {
    timerRef.current = setTimeout(() => setShowPopover(false), 150);
  }, []);

  return (
    <div className="date-history-field">
      <div
        className="date-history-row"
        ref={triggerRef}
        onMouseEnter={showHistory ? handleEnter : undefined}
        onMouseLeave={showHistory ? handleLeave : undefined}
      >
        <input
          className={inputClassName}
          type="date"
          value={draftDate}
          onFocus={onFocus}
          onChange={handleDateInputChange}
          aria-label={label}
        />
        <div className="date-history-item-row">
          <CopyableControl value={item} label={`${label}事项`} className="date-item-copyable">
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
          </CopyableControl>
          <button
            className="date-confirm-btn"
            type="button"
            onClick={handleConfirm}
            title="确认添加（日期为空则默认今天，Enter 也可确认）"
          >
            ✓
          </button>
        </div>
      </div>

      {showHistory && showPopover &&
        createPortal(
          <div
            className="portal-popover"
            style={{
              position: "fixed",
              zIndex: 2147483000,
              maxWidth: popPos.maxWidth,
              maxHeight: 220,
              overflow: "auto",
              padding: 7,
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#ffffff",
              boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
              fontSize: 11,
              color: "#334155",
              ...(popPos.above
                ? { bottom: window.innerHeight - popPos.top, left: popPos.left }
                : { top: popPos.top, left: popPos.left }),
            }}
            onMouseEnter={() => clearTimeout(timerRef.current)}
            onMouseLeave={() => setShowPopover(false)}
          >
            <div className="date-history-title">历史记录</div>
            <div className="date-history-table date-history-head">
              <span>日期 / 添加</span>
              <span>事项</span>
            </div>
            {history.length > 0 ? (
              [...history].reverse().map((entry) => (
                <div key={entry.id} className="date-history-table">
                  <span title={`添加日期：${addedDate(entry) || "未知"}`}>
                    {entry.date || "-"}
                    <small className="history-added-date">添加 {addedDate(entry) || "-"}</small>
                  </span>
                  <span className="history-item-cell">
                      <CopyableControl
                        value={entry.item || ""}
                        label="历史事项"
                        className="history-item-copyable"
                      >
                        <InlineEditableText
                          value={entry.item || ""}
                          className="history-item-text"
                          inputClassName="history-item-input"
                          title={`${entry.item || "未填写事项"}；添加日期：${addedDate(entry) || "未知"}；双击编辑`}
                          onCommit={(nextItem) => onHistoryItemChange?.(entry.id, nextItem)}
                        />
                      </CopyableControl>
                    <button
                      className="history-delete-btn"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteHistory?.(entry.id);
                      }}
                      title="删除此记录"
                    >×</button>
                  </span>
                </div>
              ))
            ) : (
              <div className="date-history-empty">暂无历史记录</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
