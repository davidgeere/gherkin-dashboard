# Gherkin

The phone, the agents, and the manager are three different callers. They share one data API. The manager is not a phone user and does not claim a person.

Base URL: `https://gherkin-api.onrender.com`

## Who calls what

| Caller | Credential | What it is |
|---|---|---|
| iPhone | `ghk_` device token from claim | One person, remembered on that phone |
| Agent | `ghk_` key issued by the manager | Acts as one person |
| Manager | `gha_` session from email login, then a `ghk_` key | david@geere.org only. Issues keys. Then uses the same data routes an agent uses |

A phone token and an agent key are both stored in `tokens`. An admin session is stored separately and cannot read events, devices, rules, or commands.

## Phone

Before anyone is claimed, the phone asks who it is and stores a passkey. After that it shows the pickle, On/Off, the access it has, and a small sign out. On stops location updates and command polling. Off does not sign the person out.

The phone records events and answers commands for the signed-in person only. It applies that person's screen-time rules. It does not list the family and it does not edit anyone's rules.

Commands the phone performs are listed under Actions. Background collectors are separate and only run while the phone is On.

## What an agent can get

On request, the phone posts an event and the matching webhooks fire.

| Ask | Event | Comes back |
|---|---|---|
| `microphone.listen` with `seconds` from 1 to 30 | `microphone.clip` | AAC audio, base64 |
| `camera.capture` with `facing` `back` or `front` | `camera.capture` | JPEG, base64, and which camera |
| `screen.capture` | `screen.capture` | JPEG of the phone's display. iOS asks the first time and shows the recording dot |
| `location.now` | `location.update` | Latitude, longitude, accuracy |
| `wifi.current` | `wifi.current` | The joined network name and BSSID |
| `motion.snapshot` | `motion.snapshot` | Walking, running, automotive, cycling, or stationary, plus steps today |
| `health.snapshot` | `health.snapshot` | Steps, active energy, walking distance today |
| `bluetooth.state` | `bluetooth.state` | On, off, or denied |
| `battery.now` | `battery.now` | Percent and charging state |
| `permissions.status` | `permission.status` | What the person has allowed |
| `notify` with `title` and `body` | | A notification on the phone |

`wifi.nearby`, `screen.sites`, and `screen.apps` answer immediately with `available: false`. iOS does not let an app list nearby Wi-Fi, read Safari history, or read time spent in other apps. Screen time that does work is the rules endpoint: blocked sites, downtime, and a web lock. The phone enforces those. It cannot report which sites were opened or how long each app was used.

## Background

`GET` and `PUT /v1/collection` on the person's own key. While the phone is On, each enabled collector reports about every 15 minutes, and again when the set changes.

| Collector | Default | Reports |
|---|---|---|
| `location` | on | `location.update` as the phone moves |
| `motion` | off | `motion.snapshot` |
| `health` | off | `health.snapshot` |
| `wifi` | off | `wifi.current` |
| `bluetooth` | off | `bluetooth.state` |
| `battery` | off | `battery.now` |

Camera and microphone are never background collectors. The manager sets this with the same key an agent uses. The phone does not show these switches.

## Manager

Email and password. Only `david@geere.org`. From that account:

- See David, Stephanie, Maya, and Test.
- Issue and revoke agent keys. The secret is shown once.
- The newest key issued in that browser becomes the key the manager uses for that person.
- Read devices and recent events, set screen time, and send the same commands an agent can send.

Screen time the API can set: blocked sites, sites allowed during a lock, downtime as `HH:MM` to `HH:MM`, and an immediate web lock. The phone enforces it. Per-app shields stay on the device.

## Open routes

| Method | Path | |
|---|---|---|
| GET | `/health` | Service is up |
| GET | `/v1/people` | People who are not yet claimed |

## Claim

`POST /v1/claim` with `{ "user_id", "device": { "name", "model", "system", "vendor_id" } }` returns the phone token once. A claimed person disappears from `/v1/people`.

## Data routes

Bearer `ghk_` (phone or agent). The person is taken from the token.

| Method | Path | |
|---|---|---|
| GET | `/v1/me` | The token's person |
| GET | `/v1/devices` | Devices for that person |
| POST | `/v1/devices` | Register a device |
| GET | `/v1/events` | Recent events. `limit` optional |
| POST | `/v1/events` | Record an event. Fans out to webhooks |
| GET | `/v1/webhooks` | Registered hooks |
| POST | `/v1/webhooks` | `{ "url", "kinds" }`. Secret returned once |
| DELETE | `/v1/webhooks/{id}` | Remove a hook |
| POST | `/v1/commands` | `{ "device_id", "kind", "payload" }` |
| GET | `/v1/commands/pending` | Phone long-poll. `device_id`, `wait` up to 25 seconds |
| POST | `/v1/commands/{id}/result` | Phone posts the result |
| GET | `/v1/family/rules` | Rules for this person |
| PUT | `/v1/family/rules` | Set rules for this person |
| GET | `/v1/family/activity` | Screen-time activity |
| POST | `/v1/family/activity` | Phone reports what it applied |
| GET | `/v1/collection` | Which background collectors are on for this person |
| PUT | `/v1/collection` | Turn those collectors on or off |
| GET | `/v1/family/people` | Family list for a parent token. The phone UI does not show this |
| GET | `/v1/tokens` | Keys for the token's person, without secrets |
| DELETE | `/v1/tokens/{id}` | Revoke one |

`PUT /v1/family/rules` body:

```json
{
  "user_id": "…",
  "blocked_domains": ["example.com"],
  "allowed_domains": [],
  "downtime_start": "21:00",
  "downtime_end": "07:00",
  "web_locked": false
}
```

Downtime is both times or neither.

## Webhooks

`POST /v1/events` delivers matching hooks. Body:

```json
{
  "id": "…",
  "user_id": "…",
  "device_id": "…",
  "kind": "location.update",
  "recorded_at": "…",
  "payload": {}
}
```

Headers: `X-Gherkin-Event` is the kind. `X-Gherkin-Signature` is `sha256=` plus HMAC-SHA256 of the raw body using the hook secret. Delivery retries three times.

## Manager routes

Bearer `gha_`. These do not read or write phone data.

| Method | Path | |
|---|---|---|
| POST | `/v1/admin/login` | `{ "email", "password" }` for david@geere.org. Returns the session once |
| GET | `/v1/admin/people` | Everyone, including people a phone has already claimed |
| GET | `/v1/admin/tokens?user_id=` | Keys for that person, without secrets |
| POST | `/v1/admin/tokens` | `{ "user_id", "name" }` issues a `ghk_` agent key. Secret returned once |
| DELETE | `/v1/admin/tokens/{id}` | Revoke |

The manager then calls the data routes with the issued `ghk_` key. There is no second business API.
