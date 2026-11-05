import { createHash, randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { homedir, hostname } from "node:os"
import path from "node:path"
import { Option, Schema } from "effect"

/** The CodeFlux account service. `CODEFLUX_ACCOUNT_URL` points development builds at another origin. */
const origin = () => process.env.CODEFLUX_ACCOUNT_URL || "https://routok.com"

/** Where the signed-in session is kept between launches. `CODEFLUX_ACCOUNT_FILE` overrides it. */
const file = () => process.env.CODEFLUX_ACCOUNT_FILE || path.join(homedir(), ".codeflux", "account.json")

const SIGN_IN_TIMEOUT_MS = 10 * 60_000
/** The access token lasts 15 minutes; refreshing every 10 keeps it valid and refreshes the plan snapshot. */
export const REFRESH_EVERY_MS = 10 * 60_000

const User = Schema.Struct({ id: Schema.Number, email: Schema.String, display_name: Schema.String })
const Plan = Schema.Struct({ tier_name: Schema.String, status: Schema.String, expires_at: Schema.Number })

const Grant = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  refresh_expires_at: Schema.Number,
  user: User,
  plan: Plan,
  sync: Schema.Struct({ server_time: Schema.Number, snapshot_valid_until: Schema.Number }),
})

const Envelope = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.optional(Schema.String),
  code: Schema.optional(Schema.String),
  data: Schema.optional(Grant),
})

/** The session as kept on disk. `received_at` anchors the server clock so the local clock is only used for elapsed time. */
const Stored = Schema.Struct({
  refresh_token: Schema.String,
  refresh_expires_at: Schema.Number,
  user: User,
  plan: Plan,
  server_time: Schema.Number,
  snapshot_valid_until: Schema.Number,
  received_at: Schema.Number,
})

type Stored = typeof Stored.Type
type Grant = typeof Grant.Type

export type AccountView = {
  signedIn: boolean
  pending: boolean
  licensed: boolean
  expired: boolean
  user?: { id: number; email: string; displayName: string }
  tierName?: string
  expiresAt?: number
  failure?: string
}

type Flow = {
  state: string
  verifier: string
  redirectURI: string
  server: Server
  timer: ReturnType<typeof setTimeout>
}

type Result = { ok: true; grant: Grant } | { ok: false; status: number; code?: string; message: string }

let stored: Stored | undefined
let accessToken: string | undefined
let flow: Flow | undefined
let failure: string | undefined
// Refreshes, sign-outs and their file writes run one at a time, so a refresh never races a sign-out.
let queue: Promise<void> = Promise.resolve()
const listeners = new Set<() => void>()

/** The local model is allowed only with an active plan that has not reached its end and whose snapshot is still trusted. */
export function licensedAt(account: Stored | undefined, serverSeconds: number) {
  return (
    account !== undefined &&
    account.plan.status === "active" &&
    serverSeconds < account.plan.expires_at &&
    serverSeconds < account.snapshot_valid_until
  )
}

/** PKCE S256 challenge: base64url(SHA256(verifier)), without padding. */
export function challengeFor(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url")
}

function serverSeconds(now = Date.now() / 1000) {
  return stored ? stored.server_time + (now - stored.received_at) : now
}

export function isLicensed() {
  return licensedAt(stored, serverSeconds())
}

export function accountView(): AccountView {
  const now = serverSeconds()

  return {
    signedIn: stored !== undefined,
    pending: flow !== undefined,
    licensed: licensedAt(stored, now),
    expired: stored !== undefined && stored.plan.expires_at > 0 && now >= stored.plan.expires_at,
    user: stored ? { id: stored.user.id, email: stored.user.email, displayName: stored.user.display_name } : undefined,
    tierName: stored?.plan.tier_name,
    expiresAt: stored?.plan.expires_at,
    failure,
  }
}

export function onAccountChange(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  for (const listener of listeners) listener()
}

/** Reads the saved session at startup, and resets the in-memory session to what the file holds. */
export async function loadAccount() {
  const location = file()
  const loaded = existsSync(location)
    ? Option.getOrUndefined(Schema.decodeUnknownOption(Schema.fromJsonString(Stored))(await Bun.file(location).text()))
    : undefined

  if (loaded && loaded.refresh_expires_at > Date.now() / 1000) {
    stored = loaded
    return
  }
  stored = undefined
  await rm(location, { force: true })
}

/** Opens a PKCE authorization: starts the loopback listener and returns the page to open in the browser. */
export async function beginSignIn() {
  if (flow) finish(flow)

  const verifier = randomBytes(48).toString("base64url")
  const state = randomBytes(24).toString("base64url")
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as AddressInfo).port
  const redirectURI = `http://127.0.0.1:${port}/callback`

  const current: Flow = {
    state,
    verifier,
    redirectURI,
    server,
    timer: setTimeout(() => finish(current, "Sign-in timed out"), SIGN_IN_TIMEOUT_MS),
  }
  server.on("request", (req, res) => receive(current, req, res))
  flow = current
  failure = undefined
  notify()

  const url = new URL("/authorize.html", origin())
  url.search = new URLSearchParams({
    code_challenge: challengeFor(verifier),
    code_challenge_method: "S256",
    redirect_uri: redirectURI,
    state,
    device_name: `CodeFlux Desktop · ${hostname()}`.slice(0, 100),
  }).toString()

  return url.toString()
}

function receive(current: Flow, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", current.redirectURI)
  if (url.pathname !== "/callback") return page(res, 404, "Not found.")
  // A mismatched state is not this sign-in: reject it without ending the one in progress.
  if (url.searchParams.get("state") !== current.state) return page(res, 400, "This sign-in request is not valid.")

  const code = url.searchParams.get("code")
  if (!code) {
    page(res, 200, "Sign-in was cancelled. You can close this window.")
    return finish(current, url.searchParams.get("error") === "access_denied" ? "Sign-in was cancelled" : "Sign-in failed")
  }

  page(res, 200, "Signed in to CodeFlux. You can close this window.")
  finish(current)
  void exchange(current, code)
}

function page(res: ServerResponse, status: number, text: string) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" })
  res.end(`<!doctype html><meta charset="utf-8"><title>CodeFlux</title><p style="font:16px system-ui;margin:48px">${text}</p>`)
}

function finish(current: Flow, message?: string) {
  clearTimeout(current.timer)
  current.server.close()
  if (flow === current) flow = undefined
  if (message !== undefined) failure = message
  notify()
}

async function exchange(current: Flow, code: string) {
  const result = await request("token", {
    grant_type: "authorization_code",
    code,
    code_verifier: current.verifier,
    redirect_uri: current.redirectURI,
  }).catch((error: unknown) => ({ ok: false as const, status: 0, message: String(error) }))

  if (!result.ok) {
    failure = result.message
    return notify()
  }
  await remember(result.grant)
}

/** Refreshes the session and the plan snapshot. Offline or server errors keep the cached snapshot. */
export function refreshAccount() {
  queue = queue.then(refreshNow).catch(() => undefined)

  return queue
}

async function refreshNow() {
  if (!stored) return
  const result = await request("refresh", { refresh_token: stored.refresh_token }).catch(() => undefined)

  if (result?.ok) return remember(result.grant)
  if (result?.status === 401 && result.code === "refresh_invalid") {
    return forget("Signed out: this device's session has ended")
  }
}

/** Signs out on the server, then clears the local session whatever the server answers. */
export function signOutAccount() {
  queue = queue.then(logoutNow).catch(() => undefined)

  return queue
}

async function logoutNow() {
  await refreshNow()
  if (accessToken) await request("logout", {}, accessToken).catch(() => undefined)
  await forget()
}

async function remember(grant: Grant) {
  stored = {
    refresh_token: grant.refresh_token,
    refresh_expires_at: grant.refresh_expires_at,
    user: grant.user,
    plan: grant.plan,
    server_time: grant.sync.server_time,
    snapshot_valid_until: grant.sync.snapshot_valid_until,
    received_at: Math.floor(Date.now() / 1000),
  }
  accessToken = grant.access_token
  failure = undefined
  // A failed write only loses the session across launches; the signed-in state stays in memory.
  await persist(stored).catch(() => undefined)
  notify()
}

async function persist(account: Stored) {
  const location = file()
  await mkdir(path.dirname(location), { recursive: true })
  await writeFile(`${location}.tmp`, JSON.stringify(account), { mode: 0o600 })
  await rename(`${location}.tmp`, location)
}

async function forget(message?: string) {
  stored = undefined
  accessToken = undefined
  failure = message
  await rm(file(), { force: true })
  notify()
}

async function request(route: string, body: unknown, bearer?: string): Promise<Result> {
  const response = await fetch(`${origin()}/api/agent/${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const envelope = Option.getOrUndefined(Schema.decodeUnknownOption(Envelope)(await response.json()))

  if (envelope?.success && envelope.data) return { ok: true, grant: envelope.data }

  return {
    ok: false,
    status: response.status,
    code: envelope?.code,
    message: envelope?.message || `HTTP ${response.status}`,
  }
}
