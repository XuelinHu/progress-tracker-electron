import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function TodoEditorModal({ todo, onSave, onClose }) {
  const [draft, setDraft] = useState(todo);

  useEffect(() => setDraft(todo), [todo]);

  if (!todo || !draft) return null;

  function submit(event) {
    event.preventDefault();
    const text = String(draft.text ?? "").trim();
    if (!text) return;
    onSave({ text, details: String(draft.details ?? ""), done: Boolean(draft.done) });
    onClose();
  }

  return (
    <div className="calendar-schedule-backdrop todo-editor-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="calendar-schedule-modal todo-editor-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="calendar-schedule-head">
          <div>
            <strong>编辑 Todo</strong>
            <span>{todo.recordTitle}</span>
          </div>
          <button className="calendar-schedule-close" type="button" onClick={onClose} title="关闭" aria-label="关闭">
            <X size={15} />
          </button>
        </div>
        <label className="calendar-schedule-field">
          <span>事项名称</span>
          <input value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} autoFocus />
        </label>
        <label className="calendar-schedule-field">
          <span>详情</span>
          <textarea value={draft.details} onChange={(event) => setDraft((current) => ({ ...current, details: event.target.value }))} placeholder="填写事项详情" />
        </label>
        <fieldset className="calendar-schedule-status-field">
          <legend>完成状态</legend>
          <div className="calendar-schedule-statuses">
            <label className={!draft.done ? "selected" : ""}>
              <input type="radio" checked={!draft.done} onChange={() => setDraft((current) => ({ ...current, done: false }))} />
              <span>进行中</span>
            </label>
            <label className={draft.done ? "selected" : ""}>
              <input type="radio" checked={draft.done} onChange={() => setDraft((current) => ({ ...current, done: true }))} />
              <span>已完成</span>
            </label>
          </div>
        </fieldset>
        <dl className="todo-editor-dates">
          <div><dt>添加日期</dt><dd>{todo.addedDate || "未记录"}</dd></div>
          {todo.doneDate && <div><dt>完成日期</dt><dd>{todo.doneDate}</dd></div>}
        </dl>
        <div className="calendar-schedule-actions">
          <button className="text-button" type="button" onClick={onClose}>取消</button>
          <button className="icon-button primary calendar-schedule-submit" type="submit">
            <Save size={16} />
            <span>保存</span>
          </button>
        </div>
      </form>
    </div>
  );
}
