import { cookies } from "next/headers"

const API = process.env.GHERKIN_API_URL ?? "https://gherkin-api.onrender.com"

export function keyCookie(userId: string) {
  return `gherkin_key_${userId}`
}

export async function adminToken() {
  return (await cookies()).get("gherkin_admin")?.value
}

export async function personToken(userId: string) {
  return (await cookies()).get(keyCookie(userId))?.value
}

export async function gherkin(
  path: string,
  token: string | undefined,
  init?: RequestInit
) {
  const headers = new Headers(init?.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init?.body) headers.set("Content-Type", "application/json")
  return fetch(`${API}${path}`, { ...init, headers, cache: "no-store" })
}

export type Person = { id: string; display_name: string; role: string }
export type AgentKey = {
  id: string
  name: string
  kind: string
  created_at: string
  revoked: boolean
}
export type Device = { id: string; name: string; platform: string }
export type GherkinEvent = {
  id: string
  kind: string
  payload: Record<string, unknown>
  recorded_at: string
}
export type Collection = {
  location: boolean
  motion: boolean
  health: boolean
  wifi: boolean
  bluetooth: boolean
  battery: boolean
}

export type Capability = { status: "not_asked" | "denied" | "granted" | string; enabled: boolean }
export type PhoneCommand = {
  id: string
  kind: string
  status: string
  result: Record<string, unknown>
  created_at: string
}

export type Rules = {
  user_id: string
  blocked_domains: string[]
  allowed_domains: string[]
  downtime_start: string | null
  downtime_end: string | null
  web_locked: boolean
}
