const statusField = { key: "status", label: "状态", type: "status", width: "112px" };
const todoField = {
  key: "todo",
  label: "Todo",
  type: "textarea",
  width: "minmax(340px, 1.35fr)",
};
const titleField = {
  key: "title",
  label: "项目名称",
  type: "text",
  width: "minmax(230px, 1fr)",
};
const descriptionField = {
  key: "description",
  label: "中文解释",
  type: "textarea",
  width: "minmax(250px, 1fr)",
};
const startDateField = {
  key: "startDate",
  label: "开始日期",
  type: "date",
  width: "minmax(102px, 0.37fr)",
};
const endDateField = {
  key: "endDate",
  label: "结束日期",
  type: "date",
  width: "minmax(102px, 0.37fr)",
};
const windowsPathField = {
  key: "windowsPath",
  label: "Windows路径",
  type: "path",
  width: "minmax(180px, 0.58fr)",
};
const linuxPathField = {
  key: "linuxPath",
  label: "Linux路径",
  type: "path",
  width: "minmax(170px, 0.55fr)",
};
const serverPathField = {
  key: "serverPath",
  label: "服务器绝对路径",
  type: "path",
  width: "minmax(190px, 0.62fr)",
};
export const CATEGORIES = [
  {
    id: "software",
    name: "软著",
    shortcut: "1",
    accent: "#2563eb",
    tint: "#dbeafe",
    fields: [
      statusField,
      titleField,
      startDateField,
      endDateField,
      descriptionField,
      todoField,
      windowsPathField,
      serverPathField,
    ],
  },
  {
    id: "patent",
    name: "专利",
    shortcut: "2",
    accent: "#16a34a",
    tint: "#dcfce7",
    fields: [
      statusField,
      titleField,
      startDateField,
      endDateField,
      descriptionField,
      todoField,
      windowsPathField,
      linuxPathField,
      serverPathField,
    ],
  },
  {
    id: "paper",
    name: "论文",
    shortcut: "3",
    accent: "#d97706",
    tint: "#fef3c7",
    fields: [
      statusField,
      titleField,
      startDateField,
      endDateField,
      descriptionField,
      todoField,
      windowsPathField,
      linuxPathField,
    ],
  },
  {
    id: "contest",
    name: "比赛",
    shortcut: "4",
    accent: "#e11d48",
    tint: "#ffe4e6",
    fields: [
      statusField,
      titleField,
      startDateField,
      endDateField,
      todoField,
      {
        key: "platformUrl",
        label: "平台网址",
        type: "url",
        width: "minmax(300px, 1fr)",
      },
      {
        key: "officialUrl",
        label: "官网",
        type: "url",
        width: "minmax(300px, 1fr)",
      },
    ],
  },
  {
    id: "project",
    name: "项目",
    shortcut: "5",
    accent: "#7c3aed",
    tint: "#f3e8ff",
    fields: [
      statusField,
      titleField,
      startDateField,
      endDateField,
      todoField,
      {
        key: "platformUrl",
        label: "平台网址",
        type: "url",
        width: "minmax(300px, 1fr)",
      },
      {
        key: "officialUrl",
        label: "官网",
        type: "url",
        width: "minmax(300px, 1fr)",
      },
    ],
  },
  {
    id: "activity",
    name: "活动",
    shortcut: "6",
    accent: "#f59e0b",
    tint: "#fef3c7",
    fields: [
      statusField,
      titleField,
      startDateField,
      endDateField,
      descriptionField,
      todoField,
      {
        key: "platformUrl",
        label: "活动链接",
        type: "url",
        width: "minmax(300px, 1fr)",
      },
      {
        key: "officialUrl",
        label: "官方页面",
        type: "url",
        width: "minmax(300px, 1fr)",
      },
    ],
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
);
