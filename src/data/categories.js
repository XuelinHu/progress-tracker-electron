const commonFields = [
  { key: "title", label: "进程名称", type: "text", width: "minmax(190px, 1.2fr)" },
  { key: "status", label: "状态", type: "status", width: "156px" },
  { key: "startDate", label: "开始日期", type: "date", width: "140px" },
  { key: "endDate", label: "结束日期", type: "date", width: "140px" },
  { key: "owner", label: "负责人", type: "text", width: "120px" },
  { key: "currentProgress", label: "当前进度", type: "text", width: "minmax(200px, 1fr)" },
  { key: "nextAction", label: "下一步", type: "text", width: "minmax(180px, 1fr)" },
  { key: "remarks", label: "备注", type: "textarea", width: "minmax(220px, 1fr)" },
];

export const CATEGORIES = [
  {
    id: "software",
    name: "软著",
    shortcut: "1",
    accent: "#2563eb",
    tint: "#dbeafe",
    fields: commonFields,
  },
  {
    id: "patent",
    name: "专利",
    shortcut: "2",
    accent: "#16a34a",
    tint: "#dcfce7",
    fields: commonFields.map((field) =>
      field.key === "title" ? { ...field, label: "专利名称" } : field,
    ),
  },
  {
    id: "paper",
    name: "论文",
    shortcut: "3",
    accent: "#d97706",
    tint: "#fef3c7",
    fields: commonFields.map((field) =>
      field.key === "title" ? { ...field, label: "论文题目" } : field,
    ),
  },
  {
    id: "contest",
    name: "比赛",
    shortcut: "4",
    accent: "#e11d48",
    tint: "#ffe4e6",
    fields: commonFields.map((field) =>
      field.key === "title" ? { ...field, label: "比赛项目" } : field,
    ),
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
);
