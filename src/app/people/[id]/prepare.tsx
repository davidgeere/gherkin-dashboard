"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { preparePerson } from "@/app/actions"

export function Prepare({ userId, ready }: { userId: string; ready: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (ready) return
    let cancelled = false
    preparePerson(userId).then(() => {
      if (!cancelled) router.refresh()
    })
    return () => {
      cancelled = true
    }
  }, [ready, router, userId])

  useEffect(() => {
    if (!ready) return
    const timer = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(timer)
  }, [ready, router])

  return null
}
