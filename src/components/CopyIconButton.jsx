import { useState } from "react";
import { Check, Copy } from "lucide-react";

async function copyText(value) {
  const text = String(value ?? "");
  if (!text) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the selection-based copy path below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

export default function CopyIconButton({ value, label, className = "" }) {
  const [copied, setCopied] = useState(false);
  const disabled = !String(value ?? "").trim();

  async function handleCopy(event) {
    event.preventDefault();
    event.stopPropagation();

    try {
      if (await copyText(value)) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className={`copy-icon-button ${className}`.trim()}
      type="button"
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={handleCopy}
      title={disabled ? "没有可复制的内容" : copied ? "已复制" : `复制${label || "文本"}`}
      aria-label={disabled ? `${label || "文本"}为空` : `复制${label || "文本"}`}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
}
