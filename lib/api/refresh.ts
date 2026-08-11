/**
 * Single-flight refresh coordinator.
 * Concurrent 401s share one in-flight /auth/refresh call.
 */

type RefreshFn = () => Promise<string | null>

let inFlight: Promise<string | null> | null = null

export function runSingleFlightRefresh(refreshFn: RefreshFn): Promise<string | null> {
  if (!inFlight) {
    inFlight = refreshFn().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

/** Test helper — clears coordinator state. */
export function resetRefreshCoordinator(): void {
  inFlight = null
}
