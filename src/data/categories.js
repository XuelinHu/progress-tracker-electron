const statusField = { key: "status", label: "状态", type: "status", width: "132px" };
const titleField = {
  key: "title",
  label: "GitHub项目名称",
  type: "text",
  width: "minmax(240px, 1.2fr)",
};
const descriptionField = {
  key: "description",
  label: "中文解释",
  type: "textarea",
  width: "minmax(260px, 1fr)",
};
const windowsPathField = {
  key: "windowsPath",
  label: "Windows路径",
  type: "text",
  width: "minmax(280px, 1fr)",
};
const linuxPathField = {
  key: "linuxPath",
  label: "Linux路径",
  type: "text",
  width: "minmax(260px, 1fr)",
};
const serverPathField = {
  key: "serverPath",
  label: "服务器绝对路径",
  type: "text",
  width: "minmax(280px, 1fr)",
};
const githubUrlField = {
  key: "githubUrl",
  label: "GitHub地址",
  type: "text",
  width: "minmax(300px, 1fr)",
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
      descriptionField,
      windowsPathField,
      serverPathField,
      githubUrlField,
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
      descriptionField,
      windowsPathField,
      linuxPathField,
      serverPathField,
      githubUrlField,
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
      descriptionField,
      windowsPathField,
      linuxPathField,
      githubUrlField,
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
      {
        key: "contestDate",
        label: "最近比赛日期",
        type: "textarea",
        width: "minmax(300px, 1fr)",
      },
      {
        key: "platformUrl",
        label: "平台网址",
        type: "text",
        width: "minmax(300px, 1fr)",
      },
      {
        key: "officialUrl",
        label: "官网",
        type: "text",
        width: "minmax(300px, 1fr)",
      },
    ],
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
);
