import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "CodeFlux Dev",
  beta: "CodeFlux Beta",
  prod: "CodeFlux",
}

const appIDs: Record<string, string> = {
  dev: "com.nousflux.codeflux.dev",
  beta: "com.nousflux.codeflux.beta",
  prod: "com.nousflux.codeflux",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "CodeFlux Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "com.nousflux.codeflux.dev"
