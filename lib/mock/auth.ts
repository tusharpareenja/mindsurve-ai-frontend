/**
 * Temporary mock auth — replace with real auth when backend is ready.
 * TODO(api): swap localStorage session for secure httpOnly cookies / JWT.
 */

import type { User } from "@/types"

const SESSION_KEY = "mindsurve_mock_session"
const USERS_KEY = "mindsurve_mock_users"

export type MockSession = {
  user: User
  createdAt: string
}

type StoredUser = User & { password: string }

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? (JSON.parse(raw) as StoredUser[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getSession(): MockSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as MockSession) : null
  } catch {
    return null
  }
}

export function setSession(user: User): MockSession {
  const session: MockSession = {
    user,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function registerUser(input: {
  name: string
  email: string
  password: string
}): { ok: true; user: User } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase()
  const users = readUsers()

  if (users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: "An account with this email already exists." }
  }

  if (input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." }
  }

  const user: User = {
    id: `usr_${Date.now()}`,
    name: input.name.trim(),
    email,
    plan: "free",
  }

  writeUsers([...users, { ...user, password: input.password }])
  return { ok: true, user }
}

export function loginUser(input: {
  email: string
  password: string
}): { ok: true; user: User } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase()
  const users = readUsers()
  const found = users.find((u) => u.email.toLowerCase() === email)

  // Demo-friendly: if no users exist yet, create one on the fly
  if (!found) {
    if (users.length === 0) {
      const user: User = {
        id: `usr_${Date.now()}`,
        name: email.split("@")[0] || "User",
        email,
        plan: "free",
      }
      writeUsers([{ ...user, password: input.password }])
      return { ok: true, user }
    }
    return { ok: false, error: "Invalid email or password." }
  }

  if (found.password !== input.password) {
    return { ok: false, error: "Invalid email or password." }
  }

  const { password: _, ...user } = found
  return { ok: true, user }
}

export function loginWithGoogleMock(): User {
  const email = "demo@mindsurve.ai"
  const users = readUsers()
  const existing = users.find((u) => u.email === email)
  if (existing) {
    const { password: _, ...user } = existing
    return user
  }

  const user: User = {
    id: `usr_google_${Date.now()}`,
    name: "Demo User",
    email,
    plan: "free",
  }
  writeUsers([...users, { ...user, password: "google-oauth-mock" }])
  return user
}

export function requestPasswordReset(_email: string): void {
  // TODO(api): send reset email
  void _email
}
