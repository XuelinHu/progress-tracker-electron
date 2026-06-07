export const STATUSES = [
  {
    id: "开发中",
    label: "开发中",
    color: "#0f7ea8",
    bg: "#e0f2fe",
    border: "#7dd3fc",
  },
  {
    id: "开发已完成",
    label: "开发已完成",
    color: "#137333",
    bg: "#dcfce7",
    border: "#86efac",
  },
  {
    id: "已提交到系统",
    label: "已提交到系统",
    color: "#4f46e5",
    bg: "#e0e7ff",
    border: "#a5b4fc",
  },
  {
    id: "已结束",
    label: "已结束",
    color: "#475569",
    bg: "#e2e8f0",
    border: "#cbd5e1",
  },
  {
    id: "暂缓",
    label: "暂缓",
    color: "#b45309",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  {
    id: "其他",
    label: "其他",
    color: "#be185d",
    bg: "#fce7f3",
    border: "#f9a8d4",
  },
];

export const STATUS_BY_ID = Object.fromEntries(
  STATUSES.map((status) => [status.id, status]),
);
