import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInbox,
  mergeNotices,
  taskNotices,
  collectInbox,
  markInboxRead,
  inboxKey,
} from "../src/utils/inAppNotifications";
import type { TodoItem } from "../src/types/todo";
const task: TodoItem = {
  id: "one",
  title: "Ler",
  createdAt: "2026-10-18T12:00:00Z",
  completed: false,
  category: "study",
  priority: "medium",
  pinned: false,
  subTasks: [],
  dueDate: "2026-10-18",
  dueTime: "10:00",
  actionPlan: { startDate: "2026-10-18", startTime: "09:00" },
};
const now = new Date("2026-10-18T09:50:00");
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) || null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}
test("internal notices need no browser permission and distinguish start, nearing deadline and overdue", () => {
  assert.deepEqual(
    taskNotices([task], now).map((x) => x.kind),
    ["start", "deadline"],
  );
  assert.deepEqual(
    taskNotices([task], new Date("2026-10-18T10:01:00")).map((x) => x.kind),
    ["start", "overdue"],
  );
  assert.deepEqual(taskNotices([{ ...task, completed: true }], now), []);
});
test("notices survive reload, marking read, and collection without repeating alerts", () => {
  const store = storage();
  collectInbox(store, "guest", [task], now);
  assert.equal(parseInbox(store.getItem(inboxKey("guest"))).items.length, 2);
  markInboxRead(store, "guest");
  collectInbox(store, "guest", [task], now);
  assert.ok(
    parseInbox(store.getItem(inboxKey("guest"))).items.every((x) => x.read),
  );
  assert.equal(parseInbox(store.getItem(inboxKey("guest"))).items.length, 2);
});
test("account and group inboxes are isolated", () => {
  const store = storage();
  collectInbox(store, "user:one:personal", [task], now);
  assert.equal(
    parseInbox(store.getItem(inboxKey("user:two:personal"))).items.length,
    0,
  );
  assert.equal(
    parseInbox(store.getItem(inboxKey("user:one:group:g"))).items.length,
    0,
  );
});
test("start is suppressed after beginning; scheduling in the future creates no premature notice", () => {
  assert.equal(
    taskNotices(
      [
        {
          ...task,
          dueDate: undefined,
          actionPlan: {
            ...task.actionPlan,
            events: [
              {
                id: "s",
                kind: "started",
                at: new Date("2026-10-18T09:01:00").toISOString(),
              },
            ],
          },
        },
      ],
      now,
    ).length,
    0,
  );
  assert.equal(
    taskNotices(
      [
        {
          ...task,
          dueDate: "2026-11-01",
          actionPlan: { startDate: "2026-11-01" },
        },
      ],
      now,
    ).length,
    0,
  );
});
test("retention limits display without regenerating evicted live notices", () => {
  const tasks = Array.from({ length: 220 }, (_, i) => ({
    ...task,
    id: String(i),
    actionPlan: undefined,
    dueTime: undefined,
  }));
  const first = mergeNotices(parseInbox(null), taskNotices(tasks, now), now);
  assert.equal(first.items.length, 200);
  assert.equal(Object.keys(first.seen).length, 220);
  assert.deepEqual(mergeNotices(first, taskNotices(tasks, now), now), first);
});
test("corrupt local storage is recoverable and old deadlines do not flood a fresh inbox", () => {
  assert.deepEqual(parseInbox("null"), { items: [], seen: {} });
  assert.deepEqual(parseInbox("{broken"), { items: [], seen: {} });
  assert.deepEqual(
    taskNotices(
      [{ ...task, dueDate: "2026-01-01", actionPlan: undefined }],
      now,
    ),
    [],
  );
});
