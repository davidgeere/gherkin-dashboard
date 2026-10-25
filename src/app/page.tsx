import Link from "next/link"
import { redirect } from "next/navigation"
import { logout } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { adminToken, gherkin, type Person } from "@/lib/gherkin"

export default async function HomePage() {
  const token = await adminToken()
  if (!token) redirect("/login")
  const response = await gherkin("/v1/admin/people", token)
  if (response.status === 401) redirect("/login")
  const people = (await response.json()) as Person[]

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium">People</h1>
          <p className="text-sm text-muted-foreground">Open a person to see the phone, ask it something, and manage keys.</p>
        </div>
        <form action={logout}>
          <Button variant="outline" type="submit">Sign out</Button>
        </form>
      </div>
      <div className="grid gap-3">
        {people.map((person) => (
          <Card key={person.id}>
            <CardHeader className="flex flex-row items-center gap-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-sm font-medium">
                {person.display_name.slice(0, 1)}
              </span>
              <CardTitle className="flex-1">{person.display_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button nativeButton={false} render={<Link href={`/people/${person.id}`} />}>Open</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
