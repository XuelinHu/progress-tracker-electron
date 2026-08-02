import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { TitleComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart3, CheckCircle2, ListChecks } from "lucide-react";
import { CATEGORIES } from "../data/categories.js";

echarts.use([PieChart, TitleComponent, TooltipComponent, CanvasRenderer]);

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

function buildWeekPeriods(count = 8) {
  const today = new Date();
  const day = today.getDay() || 7;
  const thisMonday = addDays(today, 1 - day);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(thisMonday, -7 * (count - index - 1));
    const end = addDays(start, 6);
    return {
      key: toIsoDate(start),
      label: `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`,
      start: toIsoDate(start),
      end: toIsoDate(end),
    };
  });
}

function isCompleted(status, statusById) {
  const label = statusById.get(status)?.label || status || "";
  return label === "已完成" || label === "结束";
}

function isInPeriod(date, period) {
  return Boolean(date && date >= period.start && date <= period.end);
}

function StatisticsTable({ title, periods, entries }) {
  const rows = STATISTIC_CATEGORIES.map((category) => {
    const values = periods.map((period) => {
      const inPeriod = entries.filter(
        (entry) => entry.categoryId === category.id && isInPeriod(entry.date, period),
      );
      const completed = inPeriod.filter((entry) => entry.completed).length;
      return { total: inPeriod.length, completed };
    });
    const total = values.reduce((sum, value) => sum + value.total, 0);
    const completed = values.reduce((sum, value) => sum + value.completed, 0);
    return { category, values, total, completed };
  });

  return (
    <section className="statistics-table-section">
      <h3>{title}</h3>
      <div className="statistics-table-wrap">
        <div
          className="statistics-table"
          style={{ gridTemplateColumns: `132px repeat(${periods.length}, minmax(88px, 1fr)) 100px` }}
        >
          <div className="statistics-cell statistics-head">类别</div>
          {periods.map((period) => (
            <div className="statistics-cell statistics-head" key={period.key} title={`${period.start} 至 ${period.end}`}>
              {period.label}
            </div>
          ))}
          <div className="statistics-cell statistics-head">合计</div>
          {rows.map(({ category, values, total, completed }) => (
            <div className="statistics-row" key={category.id}>
              <div className="statistics-cell statistics-category">
                <span style={{ background: category.accent }} />
                {category.name}
              </div>
              {values.map((value, index) => (
                <div className="statistics-cell statistics-value" key={`${category.id}-${periods[index].key}`}>
                  <strong>{value.completed}</strong><span>/ {value.total}</span>
                </div>
              ))}
              <div className="statistics-cell statistics-value statistics-total">
                <strong>{completed}</strong><span>/ {total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
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

export default function StatisticsBoard({ records = [], calendarItems = [], statusOptions = [] }) {
  const [statusFilter, setStatusFilter] = useState("all");
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
  const monthlyPeriods = useMemo(() => buildMonthPeriods(), []);
  const weeklyPeriods = useMemo(() => buildWeekPeriods(), []);
  const currentMonth = monthlyPeriods.at(-1);
  const filteredEntries = statusFilter === "all"
    ? entries
    : entries.filter((entry) => entry.status === statusFilter);
  const currentMonthEntries = filteredEntries.filter((entry) => isInPeriod(entry.date, currentMonth));
  const currentMonthCompleted = currentMonthEntries.filter((entry) => entry.completed).length;
  const pendingTodos = records.reduce(
    (sum, record) => sum + (record.todoHistory ?? []).filter((item) => !item.doneDate).length,
    0,
  );
  const completionRate = currentMonthEntries.length
    ? Math.round((currentMonthCompleted / currentMonthEntries.length) * 100)
    : 0;
  const categoryPie = STATISTIC_CATEGORIES.map((category) => {
    const categoryEntries = currentMonthEntries.filter((entry) => entry.categoryId === category.id);
    return {
      key: category.id,
      label: category.name,
      color: category.accent,
      value: categoryEntries.length,
    };
  }).filter((item) => item.value > 0);
  const statusPie = [...new Map(
    currentMonthEntries.map((entry) => [entry.status, (statusById.get(entry.status)?.label || entry.status || "未设置")]),
  )].map(([status, label]) => ({
    key: status || "empty",
    label,
    color: statusById.get(status)?.color || "#64748b",
    value: currentMonthEntries.filter((entry) => entry.status === status).length,
  }));

  return (
    <section className="workspace statistics-page">
      <header className="statistics-header">
        <div>
          <div className="statistics-title"><BarChart3 size={21} /><h2>完成统计</h2></div>
          <p>按记录结束日期和日历事项日期统计，单元格显示“已完成 / 总数”。</p>
        </div>
        <label className="statistics-filter">
          <span>状态筛选</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">全部状态</option>
            {statusOptions.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
          </select>
        </label>
        <div className="statistics-summary" aria-label="本月汇总">
          <div><span>本月完成</span><strong>{currentMonthCompleted} / {currentMonthEntries.length}</strong></div>
          <div><span>本月完成率</span><strong>{completionRate}%</strong></div>
          <div><span>待处理 Todo</span><strong>{pendingTodos}</strong></div>
        </div>
      </header>
      <div className="statistics-legend"><CheckCircle2 size={15} /> 已完成与结束状态计为完成 <ListChecks size={15} /> Todo 独立计入待处理数量</div>
      <div className="statistics-charts">
        <StatisticsPie
          title="本月完成率"
          centerText={`${completionRate}%\n完成率`}
          data={[
            { key: "done", label: "已完成", color: "#16a34a", value: currentMonthCompleted },
            { key: "pending", label: "未完成", color: "#cbd5e1", value: currentMonthEntries.length - currentMonthCompleted },
          ].filter((item) => item.value > 0)}
        />
        <StatisticsPie title="本月类别分布" centerText={`${currentMonthEntries.length}\n事项`} data={categoryPie} roseType />
        <StatisticsPie title="本月状态分布" centerText={`${currentMonthEntries.length}\n事项`} data={statusPie} roseType />
      </div>
      <StatisticsTable title="近 6 个月" periods={monthlyPeriods} entries={filteredEntries} />
      <StatisticsTable title="近 8 周" periods={weeklyPeriods} entries={filteredEntries} />
    </section>
  );
}
