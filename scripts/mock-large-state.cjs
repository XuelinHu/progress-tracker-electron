const categories = ["software", "patent", "paper", "contest", "project", "activity"];
const statuses = ["进行中", "暂缓", "已完成"];

function makeIso(day) {
  const date = new Date(Date.UTC(2026, 0, 1 + day));
  return date.toISOString().slice(0, 10);
}

function makeMockState({ records = 250 } = {}) {
  const mockRecords = Array.from({ length: records }, (_, index) => {
    const recordId = `mock-record-${index + 1}`;
    const categoryId = categories[index % categories.length];
    const status = statuses[index % statuses.length];
    const tasks = Array.from({ length: 5 }, (_, taskIndex) => ({
      id: `${recordId}-task-${taskIndex + 1}`,
      recordId,
      type: "todo",
      text: `Mock ${categoryId} task ${index + 1}-${taskIndex + 1}`,
      details: `Generated task ${taskIndex + 1}`,
      date: taskIndex % 2 === 0 ? makeIso(index + taskIndex) : "",
      status: taskIndex === 0 && index % 3 === 0 ? "done" : "active",
      doneDate: taskIndex === 0 && index % 3 === 0 ? makeIso(index + 10) : null,
      doneAt: null,
      createdAt: `${makeIso(index)}T08:00:00.000Z`,
      updatedAt: `${makeIso(index)}T08:00:00.000Z`,
    }));
    const dateEvents = Array.from({ length: 3 }, (_, eventIndex) => ({
      id: `${recordId}-event-${eventIndex + 1}`,
      date: makeIso(index + eventIndex),
      text: `Mock date event ${index + 1}-${eventIndex + 1}`,
      details: "Generated date event",
      sourceField: "startDate",
      createdAt: `${makeIso(index)}T09:00:00.000Z`,
      updatedAt: `${makeIso(index)}T09:00:00.000Z`,
    }));
    return {
      id: recordId,
      categoryId,
      title: `Mock record ${index + 1}`,
      description: "Generated large dataset record",
      status,
      phase: categoryId === "contest" ? ["未报名", "已报名", "已提交"][index % 3] : "",
      startDate: makeIso(index),
      endDate: makeIso(index + 30),
      tasks,
      dateEvents,
      history: [{
        id: `${recordId}-created`,
        type: "record.created",
        date: makeIso(index),
        status,
        summary: "Mock record created",
        createdAt: `${makeIso(index)}T08:00:00.000Z`,
        updatedAt: `${makeIso(index)}T08:00:00.000Z`,
      }],
    };
  });
  const calendarItems = mockRecords.flatMap((record, index) => [0, 1].map((eventIndex) => ({
    id: `${record.id}-calendar-${eventIndex + 1}`,
    recordId: record.id,
    todoId: eventIndex === 0 ? record.tasks[0].id : "",
    itemType: "todo",
    title: `Mock calendar event ${index + 1}-${eventIndex + 1}`,
    description: "Generated calendar event",
    date: makeIso(index + eventIndex),
    startDate: makeIso(index + eventIndex),
    endDate: makeIso(index + eventIndex),
    status: eventIndex === 0 ? "进行中" : "已完成",
    history: [],
    createdAt: `${makeIso(index)}T10:00:00.000Z`,
    updatedAt: `${makeIso(index)}T10:00:00.000Z`,
  })));
  const nodes = mockRecords.map((record, index) => ({
    id: `mock-node-${index + 1}`,
    position: { x: (index % 25) * 220, y: Math.floor(index / 25) * 120 },
    data: { recordId: record.id, categoryId: record.categoryId },
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `mock-edge-${index + 1}`,
    source: nodes[index].id,
    target: node.id,
    type: "smoothstep",
  }));
  return {
    version: 11,
    scope: "mock-large",
    statusOptions: statuses.map((id, index) => ({ id, label: id, priority: index * 10 })),
    records: mockRecords,
    calendarItems,
    graph: { nodes, edges },
  };
}

if (require.main === module) {
  const count = Number(process.argv[2] || 250);
  process.stdout.write(`${JSON.stringify(makeMockState({ records: count }), null, 2)}\n`);
}

module.exports = { makeMockState };
