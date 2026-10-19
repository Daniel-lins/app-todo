import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanActionPlan,
  nextAction,
  withActionEvent,
  actionMetrics,
  startReminderDue,
} from "../src/utils/actionPlan";
import { sanitizeTaskUpdates } from "../src/utils/taskDomain";
import { taskPayload } from "../src/utils/taskPersistence";
import {
  generateBackupData,
  validateAndParseBackupFile,
} from "../src/utils/backupService";
import { nextOccurrence, isInView } from "../src/utils/planning";
import type { TodoItem } from "../src/types/todo";
const task: TodoItem = {
  id: "read",
  title: "Ler",
  category: "study",
  priority: "medium",
  completed: false,
  pinned: false,
  createdAt: "2026-10-18T12:00:00Z",
  subTasks: [{ id: "step", title: "Abrir capítulo 3", completed: false }],
};
test("plan validation bounds untrusted strings, dates, times and event IDs", () => {
  const plan = cleanActionPlan({
    nextAction: "x".repeat(1000),
    startDate: "2026-02-30",
    startTime: "99:12",
    events: [
      { id: "same", at: "2026-10-18T12:00:00Z", kind: "started" },
      { id: "same", at: "2026-10-18T12:00:00Z", kind: "advanced" },
      { id: "bad", at: "not-a-date", kind: "started" },
    ],
  });
  assert.equal(plan?.nextAction?.length, 300);
  assert.equal(plan?.startDate, undefined);
  assert.equal(plan?.startTime, undefined);
  assert.equal(plan?.events?.length, 1);
});
test("next action prefers plan, then unfinished stage, then task title", () => {
  assert.equal(nextAction(task), "Abrir capítulo 3");
  assert.equal(
    nextAction({ ...task, actionPlan: { nextAction: "Resolver questão 1" } }),
    "Resolver questão 1",
  );
  assert.equal(nextAction({ ...task, subTasks: [] }), "Ler");
});
test("a start or advance never marks task or stages complete and metrics count unique tasks", () => {
  const once = {
    ...task,
    actionPlan: withActionEvent(
      task,
      "started",
      "",
      "2026-10-18T12:00:00Z",
      "1",
    ),
  };
  const twice = {
    ...once,
    actionPlan: withActionEvent(
      once,
      "started",
      "",
      "2026-10-18T12:10:00Z",
      "2",
    ),
  };
  const advanced = {
    ...twice,
    actionPlan: withActionEvent(
      twice,
      "advanced",
      "Uma questão",
      "2026-10-18T12:12:00Z",
      "3",
    ),
  };
  assert.equal(advanced.completed, false);
  assert.equal(advanced.subTasks[0].completed, false);
  assert.deepEqual(actionMetrics([advanced], "2026-10-18"), {
    planned: 0,
    started: 1,
    advanced: 1,
    completed: 0,
  });
});
test("action plan survives sanitized edits, cloud payload and backup import", () => {
  const plan = {
    nextAction: "Resolver uma questão",
    startDate: "2026-10-18",
    startTime: "10:00",
    cue: "Após café",
    events: [{ id: "e", at: "2026-10-18T12:00:00Z", kind: "started" as const }],
  };
  const saved = {
    ...task,
    ...sanitizeTaskUpdates({ actionPlan: plan }, task).cleanUpdates,
  };
  assert.equal(
    taskPayload(saved, "user", null).planning.action_plan?.cue,
    "Após café",
  );
  const imported = validateAndParseBackupFile(generateBackupData([saved]));
  assert.equal(imported.valid, true);
  assert.deepEqual(imported.todos[0].actionPlan, saved.actionPlan);
  assert.equal(
    sanitizeTaskUpdates({ actionPlan: undefined }, saved).cleanUpdates
      .actionPlan,
    undefined,
  );
});
test("recurrence keeps instructions but resets occurrence start plan and event evidence", () => {
  const repeated = nextOccurrence({
    ...task,
    recurrence: "daily",
    dueDate: "2026-10-18",
    completed: true,
    actionPlan: {
      nextAction: "Abrir livro",
      startDate: "2026-10-18",
      startTime: "10:00",
      events: [{ id: "e", at: "2026-10-18T12:00:00Z", kind: "advanced" }],
    },
  });
  assert.equal(repeated?.actionPlan?.nextAction, "Abrir livro");
  assert.equal(repeated?.actionPlan?.startDate, undefined);
  assert.deepEqual(repeated?.actionPlan?.events, []);
});
test("planned start places pending task in Today independently of delivery deadline", () => {
  assert.equal(
    isInView(
      {
        ...task,
        dueDate: "2026-11-01",
        actionPlan: { startDate: "2026-10-18" },
      },
      "today",
      "2026-10-18",
    ),
    true,
  );
});
test("start reminder fires only at scheduled local time, within 15 minutes, until started", () => {
  const planned = {
    ...task,
    actionPlan: { startDate: "2026-10-18", startTime: "10:00" },
  };
  assert.equal(
    startReminderDue(planned, new Date("2026-10-18T09:59:00")),
    false,
  );
  assert.equal(
    startReminderDue(planned, new Date("2026-10-18T10:05:00")),
    true,
  );
  assert.equal(
    startReminderDue(planned, new Date("2026-10-18T10:15:00")),
    false,
  );
  assert.equal(
    startReminderDue(
      { ...planned, completed: true },
      new Date("2026-10-18T10:05:00"),
    ),
    false,
  );
  const started = {
    ...planned,
    actionPlan: withActionEvent(
      planned,
      "started",
      "",
      new Date("2026-10-18T10:01:00").toISOString(),
      "e",
    ),
  };
  assert.equal(
    startReminderDue(started, new Date("2026-10-18T10:05:00")),
    false,
  );
});

test("start notification deduplication is scoped and does not evict live reminders after 100 tasks", async () => {
  const { checkStartPlansAndNotify } = await import(
    "../src/utils/notificationService"
  );
  const original = ["window", "Notification", "localStorage"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const values = new Map<string, string>();
  const messages: string[] = [];
  class MockNotification {
    static permission = "granted";
    constructor(title: string, options: { body: string }) {
      messages.push(title + options.body);
    }
  }
  const storage = {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: { Notification: MockNotification },
    configurable: true,
  });
  Object.defineProperty(globalThis, "Notification", {
    value: MockNotification,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  try {
    const list = Array.from({ length: 101 }, (_, i) => ({
      ...task,
      id: String(i),
      actionPlan: { startDate: "2026-10-18", startTime: "10:00" },
    }));
    const now = new Date("2026-10-18T10:01:00");
    assert.equal(checkStartPlansAndNotify(list, "user:one:personal", now), 101);
    assert.equal(checkStartPlansAndNotify(list, "user:one:personal", now), 0);
    assert.equal(
      checkStartPlansAndNotify(list.slice(0, 1), "user:two:personal", now),
      1,
    );
    assert.ok(messages.every((message) => !message.includes(task.title)));
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
