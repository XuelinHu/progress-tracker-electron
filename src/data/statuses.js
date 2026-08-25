export const STATUSES = [
  {
    id: "进行中",
    label: "进行中",
    priority: 10,
    color: "#1d4ed8",
    bg: "#dbeafe",
    border: "#93c5fd",
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
    id: "已完成",
    label: "已完成",
    priority: 990,
    color: "#334155",
    bg: "#e2e8f0",
    border: "#94a3b8",
  },
];

export function normalizeStatusId(value) {
  const status = String(value ?? "").trim();
  return status === "已完成" || status === "暂缓" ? status : "进行中";
}

export const STATUS_BY_ID = Object.fromEntries(
  STATUSES.map((status) => [status.id, status]),
);

export const STATUS_PRIORITY = new Map(
  STATUSES.map((status) => [status.id, status.priority]),
);
