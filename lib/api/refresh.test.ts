/**
 * Lightweight Node test for single-flight refresh.
 * Run: npx tsx lib/api/refresh.test.ts
 */
import assert from "node:assert/strict"
import { resetRefreshCoordinator, runSingleFlightRefresh } from "./refresh"

async function main() {
  resetRefreshCoordinator()
  let calls = 0
  const refreshFn = async () => {
    calls += 1
    await new Promise((r) => setTimeout(r, 30))
    return "token-a"
  }

  const [a, b, c] = await Promise.all([
    runSingleFlightRefresh(refreshFn),
    runSingleFlightRefresh(refreshFn),
    runSingleFlightRefresh(refreshFn),
  ])

  assert.equal(calls, 1)
  assert.equal(a, "token-a")
  assert.equal(b, "token-a")
  assert.equal(c, "token-a")

  resetRefreshCoordinator()
  const d = await runSingleFlightRefresh(async () => {
    calls += 1
    return "token-b"
  })
  assert.equal(calls, 2)
  assert.equal(d, "token-b")

  console.log("refresh coordinator tests passed")
}

void main()
