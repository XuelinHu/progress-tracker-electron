import CopyIconButton from "./CopyIconButton.jsx";

export default function CopyableControl({
  value,
  label,
  className = "",
  buttonClassName = "",
  children,
}) {
  return (
    <div className={`copyable-control ${className}`.trim()}>
      <CopyIconButton value={value} label={label} className={buttonClassName} />
      {children}
    </div>
  );
}
