import type { GherkinEvent } from "@/lib/gherkin"

const hidden = new Set(["imageBase64", "audioBase64"])

function text(value: unknown) {
  if (value == null || value === "") return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

export function summarize(event: GherkinEvent) {
  const payload = event.payload ?? {}
  if (text(payload.imageBase64)) return "Photo"
  if (text(payload.audioBase64)) return "Audio"
  if (typeof payload.error === "string" && payload.error) return payload.error
  if (payload.latitude != null && payload.longitude != null) {
    return `${payload.latitude}, ${payload.longitude}`
  }
  const details = Object.entries(payload).filter(([key, value]) => !hidden.has(key) && text(value) !== "")
  if (details.length === 0) return ""
  return details.slice(0, 2).map(([key, value]) => `${key} ${text(value)}`).join(" · ")
}

export function Capture({ event }: { event: GherkinEvent }) {
  const payload = event.payload ?? {}
  const image = text(payload.imageBase64)
  const audio = text(payload.audioBase64)
  const details = Object.entries(payload).filter(([key, value]) => !hidden.has(key) && text(value) !== "")

  return (
    <article className="flex flex-col gap-3 border-b py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-medium">{event.kind}</h3>
        <time className="text-sm text-muted-foreground">{new Date(event.recorded_at).toLocaleString()}</time>
      </div>
      {image ? <Photo src={image} alt={event.kind} /> : null}
      {audio ? <audio controls src={"data:audio/mp4;base64," + audio} /> : null}
      {details.length > 0 ? (
        <dl className="grid gap-1 text-sm">
          {details.map(([key, value]) => (
            <div key={key} className="grid grid-cols-2 gap-4">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="break-all">{text(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  )
}

function Photo({ src, alt }: { src: string; alt: string }) {
  return <img alt={alt} className="max-h-96 w-full rounded-lg object-contain" src={"data:image/jpeg;base64," + src} />
}
