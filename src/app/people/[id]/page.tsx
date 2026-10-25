import Link from "next/link"
import { redirect } from "next/navigation"
import { issueKey, revokeKey, saveCollection, saveRules, sendCommand } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
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
  type Capability,
  type Collection,
  type Person,
  type PhoneCommand,
  type Rules,
} from "@/lib/gherkin"
import { Capture, summarize } from "./capture"
import { IssuedKey } from "./issued-key"
import { Prepare } from "./prepare"

const asks = [
  { group: "Listen", label: "Listen", kind: "microphone.listen", facing: "", seconds: "8" },
  { group: "Place", label: "Where", kind: "location.now", facing: "", seconds: "" },
  { group: "Place", label: "Wi-Fi", kind: "wifi.current", facing: "", seconds: "" },
  { group: "Body", label: "Motion", kind: "motion.snapshot", facing: "", seconds: "" },
  { group: "Body", label: "Health", kind: "health.snapshot", facing: "", seconds: "" },
  { group: "Device", label: "Bluetooth", kind: "bluetooth.state", facing: "", seconds: "" },
  { group: "Device", label: "Battery", kind: "battery.now", facing: "", seconds: "" },
  { group: "Device", label: "Access", kind: "permissions.status", facing: "", seconds: "" },
]

const collectors = [
  ["location", "Location"],
  ["motion", "Motion"],
  ["health", "Health"],
  ["wifi", "Current Wi-Fi"],
  ["bluetooth", "Bluetooth"],
  ["battery", "Battery"],
] as const

const capabilityFor: Record<string, string> = {
  "microphone.listen": "microphone",
  "motion.snapshot": "motion",
  "location.now": "location",
  "health.snapshot": "health",
  "bluetooth.state": "bluetooth",
}

const capabilityLabels: Record<string, string> = {
  location: "Location",
  microphone: "Microphone",
  motion: "Motion",
  health: "Health",
  notifications: "Notifications",
  bluetooth: "Bluetooth",
  screen_time: "Screen Time",
}

function unavailable(capabilities: Record<string, Capability> | null, kind: string) {
  const key = capabilityFor[kind]
  if (!key) return null
  const item = capabilities?.[key]
  if (!item || item.status === "not_asked") return "Not requested on the phone"
  if (item.status === "denied") return "Denied on the phone"
  if (!item.enabled) return "Turned off on the phone"
  return null
}

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
  searchParams: Promise<{ notice?: string; tab?: string }>
}) {
  const { id } = await params
  const { notice, tab } = await searchParams
  const section = tab === "phone" || tab === "queue" || tab === "records" || tab === "setup" ? tab : "ask"
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
  let capabilities: Record<string, Capability> | null = null
  let queue: PhoneCommand[] = []
  if (operating) {
    const [deviceResponse, eventResponse, collectionResponse, capabilityResponse, commandResponse] = await Promise.all([
      gherkin("/v1/devices", operating),
      gherkin("/v1/events?limit=100", operating),
      gherkin("/v1/collection", operating),
      gherkin("/v1/capabilities", operating),
      gherkin("/v1/commands", operating),
    ])
    if (deviceResponse.ok) devices = (await deviceResponse.json()) as Device[]
    if (eventResponse.ok) events = (await eventResponse.json()) as GherkinEvent[]
    if (collectionResponse.ok) collection = (await collectionResponse.json()) as Collection
    if (capabilityResponse.ok) capabilities = (await capabilityResponse.json()) as Record<string, Capability>
    if (commandResponse.ok) queue = (await commandResponse.json()) as PhoneCommand[]
  }
  if (rulesToken) {
    const rulesResponse = await gherkin(`/v1/family/rules?user_id=${id}`, rulesToken)
    if (rulesResponse.ok) rules = (await rulesResponse.json()) as Rules
  }

  const readyCount = Object.keys(capabilityLabels).filter((key) => {
    const item = capabilities?.[key]
    return item?.status === "granted" && item.enabled
  }).length
  const latest = new Map<string, GherkinEvent>()
  for (const event of events) {
    if (!latest.has(event.kind)) latest.set(event.kind, event)
  }
  const records = [...latest.values()]
  const media = events.filter((event) => event.payload?.imageBase64 || event.payload?.audioBase64)
  const openCount = queue.filter((item) => item.status === "pending" || item.status === "delivered" || item.status === "running").length
  const askGroups = [...new Set(asks.map((ask) => ask.group))]
  const setup = (
    <>
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
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Field>
                    <FieldLabel htmlFor="downtime_start">Downtime start</FieldLabel>
                    <Input id="downtime_start" name="downtime_start" placeholder="21:00" defaultValue={rules?.downtime_start ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="downtime_end">Downtime end</FieldLabel>
                    <Input id="downtime_end" name="downtime_end" placeholder="07:00" defaultValue={rules?.downtime_end ?? ""} />
                  </Field>
                </div>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="web_locked">Lock browsing now</FieldLabel>
                  <input id="web_locked" name="web_locked" type="checkbox" defaultChecked={rules?.web_locked ?? false} className="size-4" />
                </Field>
                <Button type="submit">Save</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {operating ? (
        <Card>
          <CardHeader>
            <CardTitle>Background</CardTitle>
            <CardDescription>While the phone is signed in, these report on their own. Camera and microphone stay on request.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveCollection.bind(null, id)}>
              <FieldGroup>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                </div>
                <Button type="submit">Save</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </>
  )

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" className="w-fit px-2" nativeButton={false} render={<Link href="/" />}>
            People
          </Button>
          <h1 className="text-2xl font-medium">{person.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {operating ? `${readyCount} of ${Object.keys(capabilityLabels).length} controls ready` : "Opening this phone."}
          </p>
        </div>
      </div>
      {notice ? <p className="text-sm text-destructive">{notices[notice] ?? decodeURIComponent(notice)}</p> : null}
      <Prepare userId={id} ready={Boolean(operating)} />

      {operating ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["ask", "Ask"],
                ["phone", "Phone"],
                ["queue", openCount > 0 ? `Queue ${openCount}` : "Queue"],
                ["records", "Records"],
                ["setup", "Setup"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                variant={section === key ? "default" : "outline"}
                nativeButton={false}
                render={<Link href={key === "ask" ? `/people/${id}` : `/people/${id}?tab=${key}`} />}
              >
                {label}
              </Button>
            ))}
          </div>

          {section === "ask" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {askGroups.map((group) => (
                <Card key={group}>
                  <CardHeader>
                    <CardTitle>{group}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-3">
                      {asks.filter((ask) => ask.group === group).map((ask) => {
                        const reason = unavailable(capabilities, ask.kind)
                        return (
                          <form key={ask.label} action={sendCommand.bind(null, id)} className="flex flex-col gap-1">
                            <input type="hidden" name="device_id" value={devices[0]?.id ?? ""} />
                            <input type="hidden" name="kind" value={ask.kind} />
                            <input type="hidden" name="facing" value={ask.facing} />
                            <input type="hidden" name="seconds" value={ask.seconds} />
                            <Button type="submit" disabled={Boolean(reason)}>{ask.label}</Button>
                            {reason ? <span className="max-w-40 text-xs text-muted-foreground">{reason}</span> : null}
                          </form>
                        )
                      })}
                    </div>
                    {group === "Listen"
                      ? media
                          .filter((event) => event.kind === "microphone.clip")
                          .map((event) => <Capture key={event.id} event={event} />)
                      : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {section === "phone" ? (
            <Card>
              <CardHeader>
                <CardTitle>On the phone</CardTitle>
                <CardDescription>A control stays off until that person requests it and leaves the switch on.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {Object.entries(capabilityLabels).map(([key, label]) => {
                  const item = capabilities?.[key]
                  const state = !item || item.status === "not_asked"
                    ? "Not requested"
                    : item.status === "denied"
                      ? "Denied"
                      : item.enabled
                        ? "Ready"
                        : "Turned off"
                  const variant = state === "Ready" ? "default" : state === "Denied" ? "destructive" : state === "Turned off" ? "outline" : "secondary"
                  return (
                    <div key={key} className="flex items-center justify-between gap-4 rounded-xl bg-secondary px-3 py-2 text-sm">
                      <span>{label}</span>
                      <Badge variant={variant}>{state}</Badge>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : null}

          {section === "queue" ? (
            <Card>
              <CardHeader>
                <CardTitle>Queue</CardTitle>
                <CardDescription>{openCount === 0 ? "Nothing waiting." : `${openCount} open`}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.kind}</TableCell>
                        <TableCell>{item.status}</TableCell>
                        <TableCell>{typeof item.result?.error === "string" ? item.result.error : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {section === "records" ? (
            <Card>
              <CardHeader>
                <CardTitle>Latest of each</CardTitle>
                <CardDescription>{media.length === 0 ? "No pictures or audio stored yet." : `${media.length} pictures and clips. The table is only the newest status of each kind.`}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kind</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{event.kind}</TableCell>
                        <TableCell>{new Date(event.recorded_at).toLocaleString()}</TableCell>
                        <TableCell>{summarize(event)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {media.map((event) => (
                  <Capture key={event.id} event={event} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {section === "setup" ? <div className="flex flex-col gap-6">{setup}</div> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6">{setup}</div>
      )}
    </main>
  )
}
