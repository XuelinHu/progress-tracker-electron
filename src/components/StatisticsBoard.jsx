import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart3, CheckCircle2, ListChecks } from "lucide-react";
import { CATEGORIES } from "../data/categories.js";

echarts.use([
  GridComponent,
  LegendComponent,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const EXTRA_CATEGORIES = [
  { id: "problem", name: "问题记录", accent: "#dc2626", tint: "#fee2e2" },
  { id: "other", name: "其他事项", accent: "#64748b", tint: "#f1f5f9" },
];
const STATISTIC_CATEGORIES = [...CATEGORIES, ...EXTRA_CATEGORIES];

function toLocalDate(isoDate) {
  const value = String(isoDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function buildDailyPeriods(days) {
  const end = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(end, index - days + 1);
    const iso = toIsoDate(date);
    return { key: iso, label: `${date.getMonth() + 1}/${date.getDate()}`, start: iso, end: iso };
  });
}

function buildMonthPeriods() {
  const today = new Date();
  const startMonth = today.getMonth() >= 5 ? 5 : 0;
  return Array.from({ length: today.getMonth() - startMonth + 1 }, (_, index) => {
    const date = new Date(today.getFullYear(), startMonth + index, 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: `${date.getFullYear()}年${date.getMonth() + 1}月`,
      start: toIsoDate(date),
      end: toIsoDate(end),
    };
  });
}

function buildPeriods(range) {
  if (range === "week") return buildDailyPeriods(7);
  if (range === "month") return buildDailyPeriods(30);
  return buildMonthPeriods();
}

function isCompleted(status, statusById) {
  const label = statusById.get(status)?.label || status || "";
  return label === "已完成" || label === "结束";
}

function isInPeriod(date, period) {
  return Boolean(date && date >= period.start && date <= period.end);
}

function StatisticsPie({ title, data, centerText, roseType = false }) {
  const chartRef = useRef(null);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const chart = echarts.init(element);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);
    chart.setOption({
      animationDuration: 420,
      title: {
        text: centerText,
        left: "center",
        top: "42%",
        textStyle: { color: "#172033", fontSize: 15, fontWeight: 700, lineHeight: 21 },
      },
      tooltip: { trigger: "item", formatter: "{b}<br/>{c} 项（{d}%）" },
      series: [{
        type: "pie",
        radius: roseType ? ["25%", "76%"] : ["48%", "76%"],
        center: ["50%", "52%"],
        roseType: roseType ? "radius" : false,
        minAngle: 4,
        label: { color: "#475569", fontSize: 11, formatter: "{b}\n{c} 项" },
        labelLine: { length: 8, length2: 6 },
        itemStyle: { borderColor: "#ffffff", borderWidth: 2, borderRadius: 3 },
        data: data.map((item) => ({ name: item.label, value: item.value, itemStyle: { color: item.color } })),
      }],
      graphic: data.length
        ? []
        : [{ type: "text", left: "center", top: "middle", style: { text: "暂无数据", fill: "#94a3b8", fontSize: 13 } }],
    });
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [centerText, data, roseType]);

  return <section className="statistics-chart-panel"><h3>{title}</h3><div ref={chartRef} className="statistics-pie" /></section>;
}

function StatisticsLineChart({ periods, entries, categories }) {
  const chartRef = useRef(null);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const chart = echarts.init(element);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);
    const visibleCategories = categories.filter((category) =>
      entries.some((entry) => entry.categoryId === category.id),
    );
    chart.setOption({
      animationDuration: 420,
      tooltip: {
        trigger: "axis",
        formatter: (params) => [params[0]?.axisValue, ...params.map((item) => `${item.marker}${item.seriesName}：${item.value} 项`)].join("<br/>"),
      },
      legend: { type: "scroll", top: 4, textStyle: { color: "#475569", fontSize: 11 } },
      grid: { top: 42, right: 18, bottom: 36, left: 42, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: periods.map((period) => period.label),
        axisLabel: { color: "#64748b", fontSize: 11 },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: "#64748b", fontSize: 11 },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series: visibleCategories.map((category) => ({
        name: category.name,
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        label: { show: false },
        lineStyle: { width: 2, color: category.accent },
        itemStyle: { color: category.accent },
        data: periods.map((period) => entries.filter(
          (entry) => entry.categoryId === category.id && isInPeriod(entry.date, period),
        ).length),
      })),
      graphic: visibleCategories.length
        ? []
        : [{ type: "text", left: "center", top: "middle", style: { text: "暂无数据", fill: "#94a3b8", fontSize: 13 } }],
    });
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [categories, entries, periods]);

  return <section className="statistics-line-panel"><h3>数量趋势</h3><div ref={chartRef} className="statistics-line" /></section>;
}

export default function StatisticsBoard({ records = [], calendarItems = [], statusOptions = [] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("sixMonths");
  const statusById = useMemo(
    () => new Map(statusOptions.map((status) => [status.id, status])),
    [statusOptions],
  );
  const entries = useMemo(
    () => [
      ...records.map((record) => ({
        categoryId: record.categoryId,
        date: String(record.endDate || record.startDate || "").slice(0, 10),
        status: record.status || "",
        completed: isCompleted(record.status, statusById),
      })),
      ...calendarItems.map((item) => ({
        categoryId: item.categoryId || "other",
        date: String(item.date || item.endDate || item.startDate || "").slice(0, 10),
        status: item.status || "",
        completed: isCompleted(item.status, statusById),
      })),
    ].filter((entry) => toLocalDate(entry.date)),
    [calendarItems, records, statusById],
  );
  const periods = useMemo(() => buildPeriods(rangeFilter), [rangeFilter]);
  const rangeEntries = entries.filter((entry) => periods.some((period) => isInPeriod(entry.date, period)));
  const statusEntries = statusFilter === "all"
    ? rangeEntries
    : rangeEntries.filter((entry) => entry.status === statusFilter);
  const filteredEntries = typeFilter === "all"
    ? statusEntries
    : statusEntries.filter((entry) => entry.categoryId === typeFilter);
  const completedEntries = filteredEntries.filter((entry) => entry.completed);
  const pendingTodos = records.reduce(
    (sum, record) => sum + (record.todoHistory ?? []).filter((item) => !item.doneDate).length,
    0,
  );
  const completionRate = filteredEntries.length
    ? Math.round((completedEntries.length / filteredEntries.length) * 100)
    : 0;
  const typeCounts = STATISTIC_CATEGORIES.map((category) => ({
    ...category,
    value: statusEntries.filter((entry) => entry.categoryId === category.id).length,
  })).filter((category) => category.value > 0);
  const displayedCategories = typeFilter === "all"
    ? STATISTIC_CATEGORIES
    : STATISTIC_CATEGORIES.filter((category) => category.id === typeFilter);
  const categoryPie = typeCounts.map((category) => ({
    key: category.id,
    label: category.name,
    color: category.accent,
    value: category.value,
  }));
  const statusPie = [...new Map(
    filteredEntries.map((entry) => [entry.status, statusById.get(entry.status)?.label || entry.status || "未设置"]),
  )].map(([status, label]) => ({
    key: status || "empty",
    label,
    color: statusById.get(status)?.color || "#64748b",
    value: filteredEntries.filter((entry) => entry.status === status).length,
  }));

  return (
    <section className="workspace statistics-page">
      <header className="statistics-header">
        <div>
          <div className="statistics-title"><BarChart3 size={21} /><h2>完成统计</h2></div>
          <p>按日期、类型和状态筛选；折线图中的数量在鼠标悬停时显示。</p>
        </div>
        <div className="statistics-filters">
          <label className="statistics-filter">
            <span>时间范围</span>
            <select value={rangeFilter} onChange={(event) => setRangeFilter(event.target.value)}>
              <option value="week">近一周</option>
              <option value="month">近一个月</option>
              <option value="sixMonths">近六个月</option>
            </select>
          </label>
          <label className="statistics-filter">
            <span>类型筛选</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">全部类型</option>
              {STATISTIC_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="statistics-filter">
            <span>状态筛选</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">全部状态</option>
              {statusOptions.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </label>
        </div>
        <div className="statistics-summary" aria-label="当前筛选汇总">
          <div><span>完成数量</span><strong>{completedEntries.length} / {filteredEntries.length}</strong></div>
          <div><span>完成率</span><strong>{completionRate}%</strong></div>
          <div><span>待处理 Todo</span><strong>{pendingTodos}</strong></div>
        </div>
      </header>
      <div className="statistics-legend"><CheckCircle2 size={15} /> 已完成与结束状态计为完成 <ListChecks size={15} /> Todo 独立计入待处理数量</div>
      <div className="statistics-type-counts" aria-label="各类型数量">
        {typeCounts.length ? typeCounts.map((category) => (
          <span className={typeFilter === category.id ? "selected" : ""} key={category.id} style={{ "--category-color": category.accent }}>
            {category.name} <strong>{category.value}</strong>
          </span>
        )) : <span className="statistics-empty-count">当前筛选暂无事项</span>}
      </div>
      <div className="statistics-charts">
        <StatisticsPie
          title="完成率"
          centerText={`${completionRate}%\n完成率`}
          data={[
            { key: "done", label: "已完成", color: "#16a34a", value: completedEntries.length },
            { key: "pending", label: "未完成", color: "#cbd5e1", value: filteredEntries.length - completedEntries.length },
          ].filter((item) => item.value > 0)}
        />
        <StatisticsPie title="类别分布" centerText={`${statusEntries.length}\n事项`} data={categoryPie} roseType />
        <StatisticsPie title="状态分布" centerText={`${filteredEntries.length}\n事项`} data={statusPie} roseType />
      </div>
      <StatisticsLineChart periods={periods} entries={filteredEntries} categories={displayedCategories} />
    </section>
  );
}
