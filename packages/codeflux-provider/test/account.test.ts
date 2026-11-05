import { afterAll, beforeAll, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import {
  accountView,
  beginSignIn,
  challengeFor,
  licensedAt,
  loadAccount,
  refreshAccount,
  signOutAccount,
} from "../src/account"

const now = () => Math.floor(Date.now() / 1000)

// The fake routok service: it checks the PKCE verifier against the challenge the sign-in page received.
const fake = { plan: { tier_name: "Pro", status: "active", expires_at: 0 }, challenge: "" }

const grant = () => ({
  access_token: "access-1",
  access_expires_at: now() + 900,
  refresh_token: "refresh-1",
  refresh_expires_at: now() + 90 * 86_400,
  user: { id: 7, email: "a@example.com", display_name: "Acme" },
  plan: fake.plan,
  sync: { server_time: now(), snapshot_valid_until: now() + 7 * 86_400 },
})

const envelope = (data: unknown) => Response.json({ success: true, message: "", data })

let dir: string
let server: ReturnType<typeof Bun.serve>
let file: string

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "codeflux-account-"))
  file = path.join(dir, "account.json")
  fake.plan = { tier_name: "Pro", status: "active", expires_at: now() + 3600 }
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const body = (await request.json()) as Record<string, string>
      if (url.pathname === "/api/agent/token") {
        if (body.code !== "good-code" || challengeFor(body.code_verifier) !== fake.challenge) {
          return Response.json({ success: false, message: "bad code", code: "agent_code_invalid" })
        }
        return envelope(grant())
      }
      if (url.pathname === "/api/agent/refresh") {
        if (body.refresh_token !== "refresh-1") {
          return Response.json({ success: false, message: "revoked", code: "refresh_invalid" }, { status: 401 })
        }
        return envelope(grant())
      }
      if (url.pathname === "/api/agent/logout") return Response.json({ success: true, message: "" })
      return new Response("not found", { status: 404 })
    },
  })
  process.env.CODEFLUX_ACCOUNT_URL = `http://127.0.0.1:${server.port}`
  process.env.CODEFLUX_ACCOUNT_FILE = file
})

afterAll(async () => {
  server.stop(true)
  delete process.env.CODEFLUX_ACCOUNT_URL
  delete process.env.CODEFLUX_ACCOUNT_FILE
  await rm(dir, { recursive: true, force: true })
})

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await Bun.sleep(10)
  expect(check()).toBe(true)
}

const stored = (plan: { expires_at: number; status?: string }, overrides: Record<string, number> = {}) => ({
  refresh_token: "refresh-1",
  refresh_expires_at: now() + 86_400,
  user: { id: 7, email: "a@example.com", display_name: "Acme" },
  plan: { tier_name: "Pro", status: plan.status ?? "active", expires_at: plan.expires_at },
  server_time: now(),
  snapshot_valid_until: now() + 86_400,
  received_at: now(),
  ...overrides,
})

test("a license needs an active plan inside its period and a trusted snapshot", () => {
  const current = now()
  const account = stored({ expires_at: current + 3600 })

  expect(licensedAt(account, current)).toBe(true)
  expect(licensedAt(undefined, current)).toBe(false)
  expect(licensedAt(stored({ expires_at: current + 3600, status: "free" }), current)).toBe(false)
  expect(licensedAt(stored({ expires_at: current - 1 }), current)).toBe(false)
  expect(licensedAt({ ...account, snapshot_valid_until: current - 1 }, current)).toBe(false)
})

test("the PKCE challenge is base64url(SHA256(verifier)) as RFC 7636 defines it", () => {
  expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
})

test("signs in through the loopback callback and stores the license", async () => {
  const url = new URL(await beginSignIn())
  const redirect = url.searchParams.get("redirect_uri") ?? ""
  const state = url.searchParams.get("state") ?? ""
  fake.challenge = url.searchParams.get("code_challenge") ?? ""

  expect(url.pathname).toBe("/authorize.html")
  expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  expect(redirect).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
  expect(accountView().pending).toBe(true)

  // A callback with another state is refused and leaves the sign-in waiting.
  expect((await fetch(`${redirect}?code=good-code&state=other`)).status).toBe(400)
  expect(accountView().pending).toBe(true)

  await fetch(`${redirect}?code=good-code&state=${state}`)
  await waitFor(() => accountView().signedIn)

  expect(accountView()).toMatchObject({
    signedIn: true,
    pending: false,
    licensed: true,
    expired: false,
    tierName: "Pro",
    user: { id: 7, displayName: "Acme" },
  })
  expect(existsSync(file)).toBe(true)
})

test("a refresh after the plan ended turns the license off but keeps the session", async () => {
  fake.plan = { tier_name: "Pro", status: "active", expires_at: now() - 1 }
  await refreshAccount()

  expect(accountView()).toMatchObject({ signedIn: true, licensed: false, expired: true })
})

test("a saved session is read at launch and an expired plan stays unlicensed", async () => {
  await Bun.write(file, JSON.stringify(stored({ expires_at: now() + 3600 })))
  await loadAccount()
  expect(accountView()).toMatchObject({ signedIn: true, licensed: true })

  await Bun.write(file, JSON.stringify(stored({ expires_at: now() - 1 })))
  await loadAccount()
  expect(accountView()).toMatchObject({ signedIn: true, licensed: false, expired: true })
})

test("a session past its refresh expiry is dropped at launch", async () => {
  await Bun.write(file, JSON.stringify(stored({ expires_at: now() + 3600 }, { refresh_expires_at: now() - 1 })))
  await loadAccount()

  expect(accountView().signedIn).toBe(false)
  expect(existsSync(file)).toBe(false)
})

test("sign-out clears the local session and the saved file", async () => {
  await Bun.write(file, JSON.stringify(stored({ expires_at: now() + 3600 })))
  await loadAccount()
  await signOutAccount()

  expect(accountView()).toMatchObject({ signedIn: false, licensed: false })
  expect(existsSync(file)).toBe(false)
})

// The `account` RPC output and event travel as JSON, and effect rejects a key whose value is `undefined`:
// "Expected JSON value at [\"output\"]". The picker could then never read the account again.
test("the account view is a JSON value signed in and signed out", async () => {
  const isJson = Schema.is(Schema.Json)

  await Bun.write(file, JSON.stringify(stored({ expires_at: now() + 3600 })))
  await loadAccount()
  expect(accountView().signedIn).toBe(true)
  expect(isJson(accountView())).toBe(true)

  await signOutAccount()
  expect(accountView().signedIn).toBe(false)
  expect(isJson(accountView())).toBe(true)
})
