import { useEffect, useRef, useState } from "react";

export default function InlineEditableText({
  value,
  onCommit,
  className = "",
  inputClassName = "",
  title = "",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value ?? ""));
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const nextValue = draft.trim();
    setEditing(false);
    if (nextValue && nextValue !== String(value ?? "")) {
      onCommit?.(nextValue);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`inline-edit-input ${inputClassName}`.trim()}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(String(value ?? ""));
            setEditing(false);
          }
        }}
        aria-label="编辑事项"
      />
    );
  }

  return (
    <span
      className={className}
      title={title || String(value ?? "")}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setEditing(true);
      }}
    >
      {value || "未填写事项"}
    </span>
  );
}
