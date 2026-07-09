(function () {
  const STORAGE_KEY = "progress-tracker-electron:v1";
  const CATEGORIES = window.PROGRESS_TRACKER_CATEGORIES || [];

  const elements = {
    categoryList: document.getElementById("categoryList"),
    activeCategoryTitle: document.getElementById("activeCategoryTitle"),
    activeCategoryDescription: document.getElementById("activeCategoryDescription"),
    totalMetric: document.getElementById("totalMetric"),
    activeMetric: document.getElementById("activeMetric"),
    overdueMetric: document.getElementById("overdueMetric"),
    completionMetricLabel: document.getElementById("completionMetricLabel"),
    progressMetric: document.getElementById("progressMetric"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    dateFilter: document.getElementById("dateFilter"),
    quickActions: document.getElementById("quickActions"),
    tableHead: document.getElementById("tableHead"),
    tableBody: document.getElementById("tableBody"),
    detailForm: document.getElementById("detailForm"),
    emptyState: document.getElementById("emptyState"),
    toast: document.getElementById("toast"),
    newItemBtn: document.getElementById("newItemBtn"),
    duplicateItemBtn: document.getElementById("duplicateItemBtn"),
    saveBtn: document.getElementById("saveBtn"),
    importJsonBtn: document.getElementById("importJsonBtn"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    deleteItemBtn: document.getElementById("deleteItemBtn"),
  };

  let state = loadState();
  let toastTimer = null;

  function uid() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function todayOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function loadState() {
    const fallback = createDefaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return fallback;
      }
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn("Failed to load state", error);
      return fallback;
    }
  }

  function createDefaultState() {
    const data = {};
    CATEGORIES.forEach((category) => {
      data[category.id] = (category.seedRows || []).map((row) => normalizeItem(category, row));
    });

    return {
      activeCategoryId: CATEGORIES[0] ? CATEGORIES[0].id : "",
      selectedItemId: CATEGORIES[0] && data[CATEGORIES[0].id][0] ? data[CATEGORIES[0].id][0].id : null,
      filters: {
        search: "",
        status: "all",
        date: "all",
      },
      data,
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeState(input) {
    const next = {
      activeCategoryId: input.activeCategoryId || (CATEGORIES[0] && CATEGORIES[0].id) || "",
      selectedItemId: input.selectedItemId || null,
      filters: {
        search: input.filters && input.filters.search ? input.filters.search : "",
        status: input.filters && input.filters.status ? input.filters.status : "all",
        date: input.filters && input.filters.date ? input.filters.date : "all",
      },
      data: {},
      updatedAt: input.updatedAt || new Date().toISOString(),
    };

    CATEGORIES.forEach((category) => {
      const sourceRows = input.data && Array.isArray(input.data[category.id])
        ? input.data[category.id]
        : category.seedRows || [];
      next.data[category.id] = sourceRows.map((row) => normalizeItem(category, row));
    });

    if (!CATEGORIES.some((category) => category.id === next.activeCategoryId)) {
      next.activeCategoryId = CATEGORIES[0] ? CATEGORIES[0].id : "";
    }
    if (!next.selectedItemId || !(next.data[next.activeCategoryId] || []).some((item) => item.id === next.selectedItemId)) {
      const rows = next.data[next.activeCategoryId] || [];
      next.selectedItemId = rows[0] ? rows[0].id : null;
    }

    return next;
  }

  function normalizeItem(category, source) {
    const item = {
      id: source.id || uid(),
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString(),
    };

    category.fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(source, field.key)) {
        item[field.key] = source[field.key];
        return;
      }

      if (field.key === category.dueDateField) {
        item[field.key] = "";
      } else if (field.type === "number") {
        item[field.key] = field.defaultValue || 0;
      } else {
        item[field.key] = field.defaultValue || "";
      }
    });

    return item;
  }

  function activeCategory() {
    return CATEGORIES.find((category) => category.id === state.activeCategoryId) || CATEGORIES[0];
  }

  function activeRows() {
    return state.data[state.activeCategoryId] || [];
  }

  function selectedItem() {
    return activeRows().find((item) => item.id === state.selectedItemId) || null;
  }

  function setSelected(itemId) {
    state.selectedItemId = itemId;
    persist();
    render();
  }

  function persist() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
  }

  function render() {
    const category = activeCategory();
    if (!category) {
      return;
    }

    elements.activeCategoryTitle.textContent = category.name;
    elements.activeCategoryDescription.textContent = category.description;
    elements.searchInput.value = state.filters.search;
    elements.dateFilter.value = state.filters.date;

    renderCategories();
    renderStatusFilter(category);
    renderQuickActions(category);
    renderMetrics(category);
    renderTable(category);
    renderDetail(category);
    renderButtonState();
  }

  function renderCategories() {
    elements.categoryList.innerHTML = "";
    CATEGORIES.forEach((category) => {
      const rows = state.data[category.id] || [];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-button${category.id === state.activeCategoryId ? " active" : ""}`;
      button.innerHTML = `
        <span class="category-icon">${escapeHtml(category.icon || category.name.slice(0, 1))}</span>
        <span>
          <strong>${escapeHtml(category.name)}</strong>
          <span>${escapeHtml(category.description)}</span>
        </span>
        <span class="category-count">${rows.length}</span>
      `;
      button.addEventListener("click", () => {
        state.activeCategoryId = category.id;
        state.selectedItemId = rows[0] ? rows[0].id : null;
        state.filters.status = "all";
        persist();
        render();
      });
      elements.categoryList.appendChild(button);
    });
  }

  function renderStatusFilter(category) {
    const statusField = category.fields.find((field) => field.key === category.statusField);
    const options = statusField && statusField.options ? statusField.options : [];
    elements.statusFilter.innerHTML = '<option value="all">全部</option>';
    options.forEach((option) => {
      const item = document.createElement("option");
      item.value = option;
      item.textContent = option;
      elements.statusFilter.appendChild(item);
    });
    elements.statusFilter.value = state.filters.status;
  }

  function renderQuickActions(category) {
    const statusField = category.fields.find((field) => field.key === category.statusField);
    const options = statusField && statusField.options ? statusField.options : [];
    const buttons = options
      .map((option) => `<button type="button" data-quick-status="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
      .join("");
    elements.quickActions.innerHTML = `${buttons}<button type="button" data-quick-due="7">截止 +7 天</button>`;
  }

  function renderMetrics(category) {
    const rows = activeRows();
    const activeCount = rows.filter((row) => {
      const status = String(row[category.statusField] || "");
      return status.includes("进行") || status.includes("等待") || status.includes("报名");
    }).length;
    const overdueCount = rows.filter((row) => isOverdue(row[category.dueDateField])).length;
    const progressField = getProgressField(category);
    const completedCount = rows.filter((row) => isCompletedStatus(row[category.statusField])).length;

    elements.totalMetric.textContent = rows.length;
    elements.activeMetric.textContent = activeCount;
    elements.overdueMetric.textContent = overdueCount;
    if (progressField) {
      const progressValues = rows.map((row) => Number(row[progressField.key]) || 0);
      const averageProgress = progressValues.length
        ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
        : 0;
      elements.completionMetricLabel.textContent = "平均进度";
      elements.progressMetric.textContent = `${averageProgress}%`;
    } else {
      elements.completionMetricLabel.textContent = "完成/提交";
      elements.progressMetric.textContent = completedCount;
    }
  }

  function renderTable(category) {
    const rows = filteredRows(category);
    elements.tableHead.innerHTML = "";
    elements.tableBody.innerHTML = "";

    const headRow = document.createElement("tr");
    category.fields.forEach((field) => {
      const th = document.createElement("th");
      th.className = `field-type-${field.type} field-key-${field.key}`;
      th.textContent = field.label;
      headRow.appendChild(th);
    });
    const actionTh = document.createElement("th");
    actionTh.textContent = "操作";
    headRow.appendChild(actionTh);
    elements.tableHead.appendChild(headRow);

    rows.forEach((item) => {
      const row = document.createElement("tr");
      row.className = item.id === state.selectedItemId ? "selected" : "";
      row.addEventListener("click", () => {
        if (state.selectedItemId !== item.id) {
          setSelected(item.id);
        }
      });

      category.fields.forEach((field) => {
        const td = document.createElement("td");
        td.classList.add(`field-type-${field.type}`);
        td.classList.add(`field-key-${field.key}`);
        if (field.key === category.dueDateField) {
          const className = dateClass(item[field.key]);
          if (className) {
            td.classList.add(className);
          }
        }
        td.appendChild(createFieldControl(category, field, item, "table"));
        row.appendChild(td);
      });

      const actionTd = document.createElement("td");
      actionTd.className = "actions-cell";
      const status = document.createElement("span");
      status.className = `status-pill ${statusClass(item[category.statusField])}`;
      status.textContent = item[category.statusField] || "未设置";
      actionTd.appendChild(status);
      row.appendChild(actionTd);

      elements.tableBody.appendChild(row);
    });

    elements.emptyState.hidden = rows.length > 0;
  }

  function renderDetail(category) {
    const item = selectedItem();
    elements.detailForm.innerHTML = "";

    if (!item) {
      elements.detailForm.innerHTML = '<p class="empty-detail">请选择一条任务记录，或点击“新增”创建任务。</p>';
      return;
    }

    category.fields.forEach((field) => {
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = field.label;
      label.appendChild(span);
      label.appendChild(createFieldControl(category, field, item, "detail"));
      elements.detailForm.appendChild(label);
    });
  }

  function renderButtonState() {
    const hasSelection = Boolean(selectedItem());
    elements.duplicateItemBtn.disabled = !hasSelection;
    elements.deleteItemBtn.disabled = !hasSelection;
    elements.quickActions.querySelectorAll("[data-quick-status], [data-quick-progress], [data-quick-due]").forEach((button) => {
      button.disabled = !hasSelection;
    });
  }

  function createFieldControl(category, field, item, scope) {
    const value = item[field.key] === undefined || item[field.key] === null ? "" : item[field.key];
    let control;

    if (field.type === "select") {
      control = document.createElement("select");
      (field.options || []).forEach((option) => {
        const itemOption = document.createElement("option");
        itemOption.value = option;
        itemOption.textContent = option;
        control.appendChild(itemOption);
      });
      control.value = value || field.defaultValue || "";
    } else if (field.type === "longtext" && scope === "detail") {
      control = document.createElement("textarea");
      control.value = value;
    } else {
      control = document.createElement("input");
      control.type = field.type === "number" || field.type === "date" ? field.type : "text";
      control.value = value;
      if (field.type === "number") {
        control.min = field.min === undefined ? "" : field.min;
        control.max = field.max === undefined ? "" : field.max;
        control.step = "1";
      }
    }

    control.setAttribute("aria-label", field.label);
    control.addEventListener("click", (event) => event.stopPropagation());
    control.addEventListener("focus", () => {
      if (state.selectedItemId !== item.id) {
        state.selectedItemId = item.id;
        persist();
        render();
      }
    });
    control.addEventListener("input", () => updateField(category, item.id, field, control.value));
    control.addEventListener("change", () => updateField(category, item.id, field, control.value));
    return control;
  }

  function updateField(category, itemId, field, rawValue) {
    const item = (state.data[category.id] || []).find((row) => row.id === itemId);
    if (!item) {
      return;
    }

    let value = rawValue;
    if (field.type === "number") {
      const numeric = Number(rawValue);
      const min = field.min === undefined ? Number.NEGATIVE_INFINITY : field.min;
      const max = field.max === undefined ? Number.POSITIVE_INFINITY : field.max;
      value = Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : 0;
    }

    item[field.key] = value;
    item.updatedAt = new Date().toISOString();
    persist();
    renderCategories();
    renderMetrics(category);
  }

  function filteredRows(category) {
    return activeRows().filter((row) => {
      const search = state.filters.search.trim().toLowerCase();
      if (search) {
        const matched = category.fields.some((field) =>
          String(row[field.key] || "").toLowerCase().includes(search)
        );
        if (!matched) {
          return false;
        }
      }

      if (state.filters.status !== "all" && String(row[category.statusField] || "") !== state.filters.status) {
        return false;
      }

      const dueValue = row[category.dueDateField];
      if (state.filters.date === "overdue") {
        return isOverdue(dueValue);
      }
      if (state.filters.date === "week") {
        return isDueSoon(dueValue);
      }
      if (state.filters.date === "empty") {
        return !dueValue;
      }

      return true;
    });
  }

  function addItem() {
    const category = activeCategory();
    const item = normalizeItem(category, {});
    const titleField = category.fields.find((field) => field.key === category.titleField);
    item[category.titleField] = titleField ? `新建${titleField.label}` : "新建任务";
    item[category.dueDateField] = todayOffset(7);
    state.data[category.id].unshift(item);
    state.selectedItemId = item.id;
    persist();
    render();
    showToast("已新增任务");
  }

  function duplicateItem() {
    const category = activeCategory();
    const item = selectedItem();
    if (!item) {
      return;
    }

    const copy = normalizeItem(category, {
      ...item,
      id: uid(),
      [category.titleField]: `${item[category.titleField] || "任务"} 副本`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    state.data[category.id].unshift(copy);
    state.selectedItemId = copy.id;
    persist();
    render();
    showToast("已复制选中任务");
  }

  function deleteItem() {
    const category = activeCategory();
    const item = selectedItem();
    if (!item) {
      return;
    }
    const confirmed = window.confirm("确认删除当前选中的进度记录？此操作只影响本机保存的数据。");
    if (!confirmed) {
      return;
    }
    state.data[category.id] = activeRows().filter((row) => row.id !== item.id);
    state.selectedItemId = state.data[category.id][0] ? state.data[category.id][0].id : null;
    persist();
    render();
    showToast("已删除任务");
  }

  function applyQuickStatus(status) {
    const category = activeCategory();
    const item = selectedItem();
    if (!item) {
      return;
    }
    item[category.statusField] = status;
    const progressField = getProgressField(category);
    if (progressField && isCompletedStatus(status)) {
      item[progressField.key] = 100;
    }
    item.updatedAt = new Date().toISOString();
    persist();
    render();
  }

  function applyQuickProgress(progress) {
    const category = activeCategory();
    const item = selectedItem();
    const progressField = getProgressField(category);
    if (!item || !progressField) {
      return;
    }
    item[progressField.key] = Number(progress);
    if (Number(progress) >= 100) {
      item[category.statusField] = completionStatus(category);
    }
    item.updatedAt = new Date().toISOString();
    persist();
    render();
  }

  function applyQuickDue(days) {
    const category = activeCategory();
    const item = selectedItem();
    if (!item) {
      return;
    }
    item[category.dueDateField] = todayOffset(Number(days));
    item.updatedAt = new Date().toISOString();
    persist();
    render();
  }

  function completionStatus(category) {
    const statusField = category.fields.find((field) => field.key === category.statusField);
    const options = statusField && statusField.options ? statusField.options : [];
    return options.find((option) => isCompletedStatus(option))
      || options[options.length - 1]
      || "已完成";
  }

  function getProgressField(category) {
    if (!category.progressField) {
      return null;
    }
    return category.fields.find((field) => field.key === category.progressField) || null;
  }

  function isCompletedStatus(status) {
    const value = String(status || "");
    return value.includes("完成")
      || value.includes("提交")
      || value.includes("通过")
      || value.includes("结束")
      || value.includes("可使用");
  }

  function statusClass(status) {
    const value = String(status || "");
    if (isCompletedStatus(value)) {
      return "status-done";
    }
    if (value.includes("阻塞") || value.includes("异常") || value.includes("修复") || value.includes("暂缓")) {
      return "status-blocked";
    }
    if (value.includes("进行") || value.includes("测试") || value.includes("清洗") || value.includes("等待")) {
      return "status-active";
    }
    return "status-default";
  }

  function isOverdue(value) {
    if (!value) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${value}T00:00:00`) < today;
  }

  function isDueSoon(value) {
    if (!value || isOverdue(value)) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${value}T00:00:00`);
    const diffDays = Math.round((due - today) / 86400000);
    return diffDays <= 7;
  }

  function dateClass(value) {
    if (isOverdue(value)) {
      return "date-overdue";
    }
    if (isDueSoon(value)) {
      return "date-soon";
    }
    return "";
  }

  function exportPayload() {
    return {
      app: "progress-tracker-electron",
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: CATEGORIES.map((category) => ({
        id: category.id,
        name: category.name,
        fields: category.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
        })),
      })),
      state,
    };
  }

  async function exportJson() {
    const payload = JSON.stringify(exportPayload(), null, 2);
    const result = await window.desktopAPI.saveJson(payload);
    if (result.ok) {
      showToast(`已导出 JSON：${result.filePath}`);
    }
  }

  async function exportCsv() {
    const category = activeCategory();
    const csv = buildCsv(category, filteredRows(category));
    const result = await window.desktopAPI.saveCsv(csv);
    if (result.ok) {
      showToast(`已导出 CSV：${result.filePath}`);
    }
  }

  async function importJson() {
    const result = await window.desktopAPI.openJson();
    if (!result.ok) {
      return;
    }
    try {
      const payload = JSON.parse(result.content);
      state = normalizeState(payload.state || payload);
      persist();
      render();
      showToast("已导入 JSON 数据");
    } catch (error) {
      console.error(error);
      window.alert("导入失败：JSON 文件格式不正确。");
    }
  }

  function buildCsv(category, rows) {
    const headers = category.fields.map((field) => field.label);
    const body = rows.map((row) => category.fields.map((field) => row[field.key] || ""));
    return [headers, ...body]
      .map((line) => line.map((cell) => csvCell(cell)).join(","))
      .join("\n");
  }

  function csvCell(value) {
    const text = String(value).replace(/\r?\n/g, " ");
    if (/[",]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function handleMenuAction(action) {
    const handlers = {
      "new-item": addItem,
      save: () => {
        persist();
        showToast("已保存到本机");
      },
      "import-json": importJson,
      "export-json": exportJson,
      "export-csv": exportCsv,
      "focus-search": () => elements.searchInput.focus(),
      "duplicate-item": duplicateItem,
      "delete-item": deleteItem,
      "complete-item": () => applyQuickStatus(completionStatus(activeCategory())),
    };

    if (handlers[action]) {
      handlers[action]();
    }
  }

  function bindEvents() {
    elements.newItemBtn.addEventListener("click", addItem);
    elements.duplicateItemBtn.addEventListener("click", duplicateItem);
    elements.deleteItemBtn.addEventListener("click", deleteItem);
    elements.saveBtn.addEventListener("click", () => {
      persist();
      showToast("已保存到本机");
    });
    elements.importJsonBtn.addEventListener("click", importJson);
    elements.exportJsonBtn.addEventListener("click", exportJson);
    elements.exportCsvBtn.addEventListener("click", exportCsv);
    elements.searchInput.addEventListener("input", () => {
      state.filters.search = elements.searchInput.value;
      persist();
      renderTable(activeCategory());
    });
    elements.statusFilter.addEventListener("change", () => {
      state.filters.status = elements.statusFilter.value;
      persist();
      renderTable(activeCategory());
    });
    elements.dateFilter.addEventListener("change", () => {
      state.filters.date = elements.dateFilter.value;
      persist();
      renderTable(activeCategory());
    });
    elements.quickActions.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      if (button.dataset.quickStatus) {
        applyQuickStatus(button.dataset.quickStatus);
      } else if (button.dataset.quickProgress) {
        applyQuickProgress(button.dataset.quickProgress);
      } else if (button.dataset.quickDue) {
        applyQuickDue(button.dataset.quickDue);
      }
    });
    window.desktopAPI.onMenuAction(handleMenuAction);
  }

  bindEvents();
  persist();
  render();
})();
