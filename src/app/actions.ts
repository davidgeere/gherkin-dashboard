"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adminToken, gherkin, keyCookie, personToken } from "@/lib/gherkin"

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const response = await gherkin("/v1/admin/login", undefined, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) redirect("/login?error=1")
  const body = (await response.json()) as { token: string }
  const jar = await cookies()
  jar.set("gherkin_admin", body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  redirect("/")
}

export async function logout() {
  const jar = await cookies()
  jar.delete("gherkin_admin")
  redirect("/login")
}

const parents = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "44444444-4444-4444-8444-444444444444",
]

async function ensureKey(userId: string) {
  const admin = await adminToken()
  if (!admin) return
  const existing = await personToken(userId)
  if (existing) {
    const check = await gherkin("/v1/me", existing)
    if (check.ok) return
  }
  const response = await gherkin("/v1/admin/tokens", admin, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, name: "manager" }),
  })
  if (!response.ok) return
  const body = (await response.json()) as { token: string }
  const jar = await cookies()
  jar.set(keyCookie(userId), body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
}

export async function preparePerson(userId: string) {
  await ensureKey(userId)
  if (!parents.includes(userId)) await ensureKey(parents[0])
}

export async function issueKey(userId: string, formData: FormData) {
  const token = await adminToken()
  if (!token) redirect("/login")
  const name = String(formData.get("name") ?? "").trim()
  const response = await gherkin("/v1/admin/tokens", token, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, name }),
  })
  if (!response.ok) return { error: "Could not issue that key." }
  const body = (await response.json()) as { id: string; token: string }
  const jar = await cookies()
  jar.set(keyCookie(userId), body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  revalidatePath(`/people/${userId}`)
  return { token: body.token }
}

export async function revokeKey(userId: string, id: string) {
  const token = await adminToken()
  if (!token) redirect("/login")
  await gherkin(`/v1/admin/tokens/${id}`, token, { method: "DELETE" })
  redirect(`/people/${userId}`)
}

export async function saveRules(userId: string, formData: FormData) {
  const token = parents.includes(userId)
    ? await personToken(userId)
    : await firstParentToken()
  if (!token) redirect(`/people/${userId}?notice=parent-key`)
  const blocked = String(formData.get("blocked") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
  const allowed = String(formData.get("allowed") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
  const response = await gherkin("/v1/family/rules", token, {
    method: "PUT",
    body: JSON.stringify({
      user_id: userId,
      blocked_domains: blocked,
      allowed_domains: allowed,
      downtime_start: String(formData.get("downtime_start") ?? ""),
      downtime_end: String(formData.get("downtime_end") ?? ""),
      web_locked: formData.get("web_locked") === "on",
    }),
  })
  if (!response.ok) redirect(`/people/${userId}?notice=rules`)
  redirect(`/people/${userId}`)
}

async function firstParentToken() {
  for (const id of parents) {
    const token = await personToken(id)
    if (token) return token
  }
  return undefined
}

export async function saveCollection(userId: string, formData: FormData) {
  const token = await personToken(userId)
  if (!token) redirect(`/people/${userId}?notice=person-key`)
  const response = await gherkin("/v1/collection", token, {
    method: "PUT",
    body: JSON.stringify({
      location: formData.get("location") === "on",
      motion: formData.get("motion") === "on",
      health: formData.get("health") === "on",
      wifi: formData.get("wifi") === "on",
      bluetooth: formData.get("bluetooth") === "on",
      battery: formData.get("battery") === "on",
    }),
  })
  if (!response.ok) redirect(`/people/${userId}?notice=collection`)
  redirect(`/people/${userId}`)
}

export async function sendCommand(userId: string, formData: FormData) {
  const token = await personToken(userId)
  if (!token) redirect(`/people/${userId}?notice=person-key`)
  const device = String(formData.get("device_id") ?? "")
  const response = await gherkin("/v1/commands", token, {
    method: "POST",
    body: JSON.stringify({
      device_id: device || null,
      kind: String(formData.get("kind") ?? "ping"),
      payload: {
        seconds: String(formData.get("seconds") ?? ""),
        facing: String(formData.get("facing") ?? ""),
      },
    }),
  })
  if (!response.ok) redirect(`/people/${userId}?notice=command`)
  redirect(`/people/${userId}`)
}
