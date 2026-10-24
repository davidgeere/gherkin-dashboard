import Link from "next/link"
import { redirect } from "next/navigation"
import { issueKey, revokeKey, saveCollection, saveRules, sendCommand } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  adminToken,
  gherkin,
  personToken,
  type AgentKey,
  type Device,
  type GherkinEvent,
  type Collection,
  type Person,
  type Rules,
} from "@/lib/gherkin"
import { Capture } from "./capture"
import { IssuedKey } from "./issued-key"
import { Prepare } from "./prepare"

const asks = [
  { label: "Back photo", kind: "camera.capture", facing: "back", seconds: "" },
  { label: "Front photo", kind: "camera.capture", facing: "front", seconds: "" },
  { label: "Screen", kind: "screen.capture", facing: "", seconds: "" },
  { label: "Listen", kind: "microphone.listen", facing: "", seconds: "8" },
  { label: "Motion", kind: "motion.snapshot", facing: "", seconds: "" },
  { label: "Where", kind: "location.now", facing: "", seconds: "" },
  { label: "Wi-Fi", kind: "wifi.current", facing: "", seconds: "" },
  { label: "Nearby Wi-Fi", kind: "wifi.nearby", facing: "", seconds: "" },
  { label: "Health", kind: "health.snapshot", facing: "", seconds: "" },
  { label: "Bluetooth", kind: "bluetooth.state", facing: "", seconds: "" },
  { label: "Battery", kind: "battery.now", facing: "", seconds: "" },
  { label: "Access", kind: "permissions.status", facing: "", seconds: "" },
  { label: "Sites", kind: "screen.sites", facing: "", seconds: "" },
  { label: "Apps", kind: "screen.apps", facing: "", seconds: "" },
]

const collectors = [
  ["location", "Location"],
  ["motion", "Motion"],
  ["health", "Health"],
  ["wifi", "Current Wi-Fi"],
  ["bluetooth", "Bluetooth"],
  ["battery", "Battery"],
] as const

const notices: Record<string, string> = {
  rules: "Could not save screen time.",
  "person-key": "Issue a key for this person first.",
  command: "The phone did not accept that command.",
  collection: "Could not save background collection.",
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  const { id } = await params
  const { notice } = await searchParams
  const token = await adminToken()
  if (!token) redirect("/login")
  const peopleResponse = await gherkin("/v1/admin/people", token)
  if (peopleResponse.status === 401) redirect("/login")
  const people = (await peopleResponse.json()) as Person[]
  const person = people.find((item) => item.id === id)
  if (!person) redirect("/")

  const keysResponse = await gherkin(`/v1/admin/tokens?user_id=${id}`, token)
  const keys = (await keysResponse.json()) as AgentKey[]
  const operating = await personToken(id)
  const rulesToken = operating

  let devices: Device[] = []
  let events: GherkinEvent[] = []
  let rules: Rules | null = null
  let collection: Collection | null = null
  if (operating) {
    const [deviceResponse, eventResponse, collectionResponse] = await Promise.all([
      gherkin("/v1/devices", operating),
      gherkin("/v1/events?limit=100", operating),
      gherkin("/v1/collection", operating),
    ])
    if (deviceResponse.ok) devices = (await deviceResponse.json()) as Device[]
    if (eventResponse.ok) events = (await eventResponse.json()) as GherkinEvent[]
    if (collectionResponse.ok) collection = (await collectionResponse.json()) as Collection
  }
  if (rulesToken) {
    const rulesResponse = await gherkin(`/v1/family/rules?user_id=${id}`, rulesToken)
    if (rulesResponse.ok) rules = (await rulesResponse.json()) as Rules
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Button variant="link" className="h-auto justify-start px-0" nativeButton={false} render={<Link href="/" />}>
            People
          </Button>
          <h1 className="text-2xl font-semibold">{person.display_name}</h1>
        </div>
      </div>
      {notice && notices[notice] ? <p className="text-sm text-destructive">{notices[notice]}</p> : null}
      <Prepare userId={id} ready={Boolean(operating)} />

      {operating ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ask the phone</CardTitle>
              <CardDescription>The phone answers on its next check, then the result shows up below.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {asks.map((ask) => (
                <form key={ask.label} action={sendCommand.bind(null, id)}>
                  <input type="hidden" name="device_id" value={devices[0]?.id ?? ""} />
                  <input type="hidden" name="kind" value={ask.kind} />
                  <input type="hidden" name="facing" value={ask.facing} />
                  <input type="hidden" name="seconds" value={ask.seconds} />
                  <Button type="submit">{ask.label}</Button>
                </form>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Captured</CardTitle>
              <CardDescription>{events.length === 0 ? "Nothing stored yet." : `${events.length} records`}</CardDescription>
            </CardHeader>
            <CardContent>
              {events.map((event) => (
                <Capture key={event.id} event={event} />
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Opening this phone.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agent keys</CardTitle>
          <CardDescription>A key is the same credential an agent uses for this person.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <IssuedKey userId={id} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>State</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>{key.kind}</TableCell>
                  <TableCell>{key.revoked ? "revoked" : "live"}</TableCell>
                  <TableCell>
                    {key.revoked ? null : (
                      <form action={revokeKey.bind(null, id, key.id)}>
                        <Button variant="outline" type="submit">Revoke</Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {rulesToken ? (
          <Card>
            <CardHeader>
              <CardTitle>Screen time</CardTitle>
              <CardDescription>The phone applies this for this person.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveRules.bind(null, id)}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="blocked">Blocked sites</FieldLabel>
                    <Input id="blocked" name="blocked" defaultValue={rules?.blocked_domains.join(" ") ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="allowed">Allowed during a lock</FieldLabel>
                    <Input id="allowed" name="allowed" defaultValue={rules?.allowed_domains.join(" ") ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="downtime_start">Downtime start</FieldLabel>
                    <Input id="downtime_start" name="downtime_start" placeholder="21:00" defaultValue={rules?.downtime_start ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="downtime_end">Downtime end</FieldLabel>
                    <Input id="downtime_end" name="downtime_end" placeholder="07:00" defaultValue={rules?.downtime_end ?? ""} />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="web_locked">Lock browsing now</FieldLabel>
                    <input id="web_locked" name="web_locked" type="checkbox" defaultChecked={rules?.web_locked ?? false} className="size-4" />
                  </Field>
                  <Button type="submit">Save</Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Opening this phone.</p>
      )}

      {operating ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Background</CardTitle>
              <CardDescription>While the phone is On, these report on their own. Camera and microphone stay on request.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveCollection.bind(null, id)}>
                <FieldGroup>
                  {collectors.map(([name, label]) => (
                    <Field key={name} orientation="horizontal">
                      <FieldLabel htmlFor={name}>{label}</FieldLabel>
                      <input
                        id={name}
                        name={name}
                        type="checkbox"
                        defaultChecked={collection?.[name] ?? (name === "location" || name === "health")}
                        className="size-4"
                      />
                    </Field>
                  ))}
                  <Button type="submit">Save</Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  )
}
