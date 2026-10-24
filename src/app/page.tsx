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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">People</h1>
        <form action={logout}>
          <Button variant="outline" type="submit">Sign out</Button>
        </form>
      </div>
      <div className="grid gap-3">
        {people.map((person) => (
          <Card key={person.id}>
            <CardHeader>
              <CardTitle>{person.display_name}</CardTitle>
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
