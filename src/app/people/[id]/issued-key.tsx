"use client"

import { useState } from "react"
import { issueKey } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function IssuedKey({ userId }: { userId: string }) {
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(formData: FormData) {
    setError(null)
    const result = await issueKey(userId, formData)
    if (result && "token" in result && result.token) setSecret(result.token)
    else setError(result && "error" in result ? result.error ?? "Could not issue that key." : "Could not issue that key.")
  }

  return (
    <form action={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Key name</FieldLabel>
          <Input id="name" name="name" placeholder="agent" required />
        </Field>
        <Button type="submit">Issue key</Button>
        {secret ? <p className="text-sm">Copy this key now. It is not shown again. {secret}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </FieldGroup>
    </form>
  )
}
