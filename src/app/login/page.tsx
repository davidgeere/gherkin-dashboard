import { login } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Gherkin</CardTitle>
          <CardDescription>Manager. This is not a phone login.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="username" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </Field>
              {params.error ? <p className="text-sm text-destructive">That login was refused.</p> : null}
              <Button type="submit">Sign in</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
