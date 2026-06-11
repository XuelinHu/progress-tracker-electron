export const STATUSES = [
  {
    id: "进行中",
    label: "进行中",
    priority: 10,
    color: "#0f7ea8",
    bg: "#e0f2fe",
    border: "#7dd3fc",
  },
  {
    id: "开发完成",
    label: "开发完成",
    priority: 40,
    color: "#137333",
    bg: "#dcfce7",
    border: "#86efac",
  },
  {
    id: "已提交系统",
    label: "已提交系统",
    priority: 20,
    color: "#4f46e5",
    bg: "#e0e7ff",
    border: "#a5b4fc",
  },
  {
    id: "已提交",
    label: "已提交",
    priority: 30,
    color: "#4338ca",
    bg: "#eef2ff",
    border: "#c7d2fe",
  },
  {
    id: "返修中",
    label: "返修中",
    priority: 0,
    color: "#be123c",
    bg: "#ffe4e6",
    border: "#fda4af",
  },
  {
    id: "等待",
    label: "等待",
    priority: 60,
    color: "#7c3aed",
    bg: "#f3e8ff",
    border: "#d8b4fe",
  },
  {
    id: "暂缓",
    label: "暂缓",
    priority: 50,
    color: "#b45309",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  {
    id: "结束",
    label: "结束",
    priority: 1000,
    color: "#475569",
    bg: "#e2e8f0",
    border: "#cbd5e1",
  },
  {
    id: "其他",
    label: "其他",
    priority: 90,
    color: "#be185d",
    bg: "#fce7f3",
    border: "#f9a8d4",
  },
];

export const STATUS_BY_ID = Object.fromEntries(
  STATUSES.map((status) => [status.id, status]),
);

export const STATUS_PRIORITY = new Map(
  STATUSES.map((status) => [status.id, status.priority]),
);
