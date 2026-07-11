import CopyIconButton from "./CopyIconButton.jsx";

export default function CopyableControl({
  value,
  label,
  className = "",
  buttonClassName = "",
  action = null,
  children,
}) {
  return (
    <div className={`copyable-control${action ? " has-action" : ""} ${className}`.trim()}>
      <CopyIconButton value={value} label={label} className={buttonClassName} />
      {action}
      {children}
    </div>
  );
}
