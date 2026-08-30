/**
 * Parse checks for the global user WebSocket.
 * Run: npx tsx lib/ws/user-events.test.ts
 */

import { parseUserEvent } from "./user-events"

const snapshot = parseUserEvent({
  type: "activity.snapshot",
  activities: [{ chat_id: "c1", kind: "collecting", label: "Collecting responses…" }],
})
if (snapshot.type !== "activity.snapshot") throw new Error("expected snapshot")
if (snapshot.activities[0]?.chat_id !== "c1") throw new Error("bad snapshot row")

const activity = parseUserEvent({
  type: "activity",
  chat_id: "c1",
  active: false,
  kind: "collecting",
})
if (activity.type !== "activity" || activity.active) throw new Error("expected clear")

console.log("user-events.test.ts: ok")
