/**
 * Lightweight parse checks for Unilever job WebSocket payloads.
 * Run: npx tsx lib/ws/job-events.test.ts
 */
import assert from "node:assert/strict"
import { parseJobWsEvent } from "./job-events"

assert.deepEqual(parseJobWsEvent({ type: "progress", progress: 42, message: "Building" }), {
  type: "progress",
  progress: 42,
  message: "Building",
})

assert.deepEqual(parseJobWsEvent({ type: "completed", message: "Done" }), {
  type: "completed",
  progress: 100,
  message: "Done",
})

assert.equal(parseJobWsEvent({ type: "failed", error: "boom" }).type, "failed")
assert.equal(parseJobWsEvent({ type: "ping" }).type, "ping")
assert.equal(parseJobWsEvent(null).type, "unknown")

console.log("job-events.test.ts: ok")
