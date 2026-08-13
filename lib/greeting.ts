export type Greeting = {
  /** Text before the user's name (no trailing space). */
  pre: string
  /** Text after the user's name (include a leading space if one is needed). */
  post: string
}

const LATE_NIGHT: Greeting[] = [
  { pre: "Hello, night owl", post: "" },
  { pre: "Still up,", post: "? Respect the hustle." },
  { pre: "Hey", post: ", burning the midnight oil?" },
  { pre: "Evening,", post: " — or is it morning already?" },
]

const EARLY_MORNING: Greeting[] = [
  { pre: "Good morning, early bird", post: "" },
  { pre: "Up with the sun,", post: "?" },
  { pre: "Morning,", post: " — you're up early." },
  { pre: "Hello,", post: ". The world's still waking up." },
]

const MORNING: Greeting[] = [
  { pre: "Good morning,", post: "" },
  { pre: "Morning,", post: " — let's build something great." },
  { pre: "Hey", post: ", ready to get started?" },
  { pre: "Good morning,", post: " Let's make today count." },
]

const AFTERNOON: Greeting[] = [
  { pre: "Good afternoon,", post: "" },
  { pre: "Hey", post: ", hope your day's going well." },
  { pre: "Afternoon,", post: " Still time to make progress." },
  { pre: "Hello,", post: ". Hope lunch was good." },
]

const EVENING: Greeting[] = [
  { pre: "Good evening,", post: "" },
  { pre: "Evening,", post: " — winding down or just getting started?" },
  { pre: "Hey", post: ", how's the evening treating you?" },
  { pre: "Good evening,", post: " One more idea before the day ends?" },
]

const NIGHT: Greeting[] = [
  { pre: "Good evening,", post: "" },
  { pre: "Hey", post: ", burning the midnight oil already?" },
  { pre: "Evening,", post: " — one more idea before bed?" },
  { pre: "Still going,", post: "? We like the dedication." },
]

function poolForHour(hour: number): Greeting[] {
  if (hour < 5) return LATE_NIGHT
  if (hour < 8) return EARLY_MORNING
  if (hour < 12) return MORNING
  if (hour < 17) return AFTERNOON
  if (hour < 21) return EVENING
  return NIGHT
}

export const DEFAULT_GREETING: Greeting = { pre: "Hello,", post: "" }

export function getGreeting(date: Date = new Date()): Greeting {
  const pool = poolForHour(date.getHours())
  return pool[Math.floor(Math.random() * pool.length)]
}
