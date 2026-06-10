import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export default function PortalPopover({ className, popover, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, maxWidth: 380 });
  const triggerRef = useRef(null);
  const timerRef = useRef(null);

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
    setPos({
      top: showAbove ? rect.top - 4 : rect.bottom + 4,
      left: Math.min(rect.left, vw - popWidth - 10),
      above: showAbove,
      maxWidth: popWidth,
    });
    setShow(true);
  }, []);

  const handleLeave = useCallback(() => {
    timerRef.current = setTimeout(() => setShow(false), 150);
  }, []);

  const handlePopoverEnter = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  const handlePopoverLeave = useCallback(() => {
    setShow(false);
  }, []);

  return (
    <>
      <div
        className={className}
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
      >
        {children}
      </div>
      {show &&
        createPortal(
          <div
            className="portal-popover"
            style={{
              position: "fixed",
              zIndex: 100,
              maxWidth: pos.maxWidth,
              maxHeight: 220,
              overflow: "auto",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#ffffff",
              boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
              fontSize: 11,
              color: "#1e293b",
              ...(pos.above
                ? { bottom: window.innerHeight - pos.top, left: pos.left }
                : { top: pos.top, left: pos.left }),
            }}
            onMouseEnter={handlePopoverEnter}
            onMouseLeave={handlePopoverLeave}
          >
            {popover}
          </div>,
          document.body,
        )}
    </>
  );
}
