import { Schema } from "effect"
import { Rpc } from "@opencode/schema/rpc"

/** The local-model provider: Qwen3-4B served by the bundled llama.cpp `llama-server`, presented as CodeFlux-4B. */
export const LOCAL_ID = "codeflux-4b"
export const LOCAL_NAME = "CodeFlux-4B"
/** The model alias `llama-server` answers to (`--alias`). */
export const LOCAL_MODEL = "qwen3-4b"
export const LOCAL_DEFAULT_PORT = 18080
export const LOCAL_DEFAULT_BASE_URL = `http://127.0.0.1:${LOCAL_DEFAULT_PORT}/v1`
/** The page where a customer renews or registers. */
export const ACCOUNT_RENEW_URL = "https://www.routok.com"

// Standard Schema keeps the definition portable, so the promise client's `rpc(definition)` accepts it.
const Empty = Schema.toStandardSchemaV1(Schema.Struct({}))

/** The customer account and whether it currently allows the local model. */
const AccountState = Schema.Struct({
  signedIn: Schema.Boolean,
  /** A browser sign-in is waiting for the customer to finish on the website. */
  pending: Schema.Boolean,
  /** Signed in, with an active plan that has not reached its end. */
  licensed: Schema.Boolean,
  /** Signed in, with a plan whose end has passed. */
  expired: Schema.Boolean,
  user: Schema.optional(Schema.Struct({ id: Schema.Int, email: Schema.String, displayName: Schema.String })),
  tierName: Schema.optional(Schema.String),
  /** Unix seconds when the current service period ends. */
  expiresAt: Schema.optional(Schema.Int),
  failure: Schema.optional(Schema.String),
})

const AccountOutput = Schema.toStandardSchemaV1(AccountState)

const SignInOutput = Schema.toStandardSchemaV1(Schema.Struct({ url: Schema.String }))

/** `probe` reports what is already on disk so the form can ask before downloading anything. */
const ProbeOutput = Schema.toStandardSchemaV1(
  Schema.Struct({
    /** The bundled `llama-server` executable exists in this build. */
    runtime: Schema.Boolean,
    /** The model file is fully downloaded. */
    model: Schema.Boolean,
    /** Approximate download size of the model, for the confirmation text. */
    sizeBytes: Schema.Int,
  }),
)

/** `setup` answers immediately and runs the download and the server start in the background. */
const SetupOutput = Schema.toStandardSchemaV1(
  Schema.Struct({
    /** `unlicensed` means no active plan: nothing was started. */
    state: Schema.Literals(["started", "joined", "unlicensed"]),
  }),
)

const CancelOutput = Schema.toStandardSchemaV1(Schema.Struct({ cancelled: Schema.Boolean }))

/** `restart` answers when the local model server is up again, or says why it was not restarted. */
const RestartOutput = Schema.toStandardSchemaV1(
  Schema.Struct({
    state: Schema.Literals(["restarted", "unlicensed", "not-installed", "busy", "failed"]),
    failure: Schema.optional(Schema.String),
  }),
)

const Progress = Schema.toStandardSchemaV1(
  Schema.Struct({
    stage: Schema.Literals(["checking", "downloading", "starting", "ready", "error"]),
    /** One-based step of `total`; each stage is one step. */
    step: Schema.Int,
    total: Schema.Int,
    /** Bytes of the model downloaded so far and in total, present on `downloading` events. */
    received: Schema.optional(Schema.Number),
    size: Schema.optional(Schema.Number),
    /** Download speed in bytes per second. */
    speed: Schema.optional(Schema.Number),
    /** Endpoint to connect with, present on the `ready` stage only. */
    port: Schema.optional(Schema.Int),
    baseURL: Schema.optional(Schema.String),
    /** Why the run failed, present on the `error` stage only. */
    failure: Schema.optional(Schema.String),
  }),
)

/** The `codeflux.local` RPC: the app's Local sign-in probes, then calls `setup` and renders the `progress` events. */
export const LocalRpc = Rpc.define({
  id: "codeflux.local",
  methods: {
    probe: { input: Empty, output: ProbeOutput },
    /**
     * Downloads Qwen3-4B (GGUF, resumable) when it is missing and starts the bundled `llama-server`. The work runs in
     * the background and reports through the `progress` events, because the download is gigabytes.
     */
    setup: { input: Empty, output: SetupOutput },
    /** Stops a running download; the partial file stays so the next `setup` resumes it. */
    cancel: { input: Empty, output: CancelOutput },
    /** Stops the local model server and starts it again, then reloads the connection. */
    restart: { input: Empty, output: RestartOutput },
    /** The current account state. */
    account: { input: Empty, output: AccountOutput },
    /** Starts a browser sign-in and returns the page to open. The result arrives later as an `account` event. */
    signIn: { input: Empty, output: SignInOutput },
    /** Signs out on the server and forgets the local session. */
    signOut: { input: Empty, output: Empty },
  },
  events: {
    progress: { schema: Progress },
    account: { schema: AccountOutput },
  },
})
