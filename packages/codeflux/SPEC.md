# CodeFlux SPEC

CodeFlux is a rebrand and extension of OpenCode 2.1.4 (MIT). New work lives in two directories; upstream files only get small hook points. This file records the design, every change made to upstream files, and how to build and run.

## 1. Directories

| Path | Role |
|---|---|
| `packages/codeflux` (`@codeflux/gui`) | Brand constants, dictionary rebranding, logo/wordmark, splash, provider picker, NousFlux form and model loading, free-model filter, Vite plugin, icon script, this SPEC |
| `packages/codeflux-provider` (`@codeflux/provider-nousflux`) | Core plugin that registers the `nousflux` integration and an OpenAI-compatible provider |

`@codeflux/gui` depends on Solid and `@opencode/ui` only. `@codeflux/provider-nousflux` depends on `@opencode/plugin` and `@opencode/schema` only. Core imports the plugin in one line.

Layout of `packages/codeflux`: `assets/` (source and derived images), `src/brand.ts`, `src/i18n/{rebrand,overrides,text,index}.ts`, `src/logo/`, `src/splash/`, `src/providers/{picker,nousflux-form,models,model-filter}`, `src/vite.js`, `scripts/gen-icons.ts`, `test/`.

## 2. Images

| Source (edit these) | Derived (generated, committed) |
|---|---|
| `packages/codeflux/assets/codeflux-logo.png` | `assets/derived/logo-{16..512}.png`; desktop `icons/{dev,beta,prod}/*` (png, ico); app `public/{favicon,apple-touch-icon,web-app-manifest}*` |
| `packages/codeflux/assets/codeflux-screen.png` | `assets/derived/screen-720.webp` (splash, NousFlux page image); `public/social-share*.png` |

Regenerate from `packages/codeflux`: `bun run scripts/gen-icons.ts --derived` (derived only) or `bun run icons` (also overwrites the web and desktop icon files). Files that Windows checked out as text stubs for symlinks (`app/public/*.png` pointing into `ui/src/assets/favicon/`) are followed and the real target is rewritten. `.icns` (macOS) is not generated.

## 3. Behaviour

- **Brand**: `BRAND` in `src/brand.ts` (name CodeFlux, support URL `https://www.nousflux.com`, NousFlux ID/name/default URL).
- **Dictionary rebrand**: `brandDictionary()` runs on every loaded dictionary. Only the capitalised word `OpenCode` in values changes; commands, files, URLs and env vars stay. `overrides.ts` adds `desktop.menu.codefluxSupport` for en/zh/zht.
- **Menus**: the top-left menu button heading reads `desktop.menu.app` (CodeFlux). Help has two items: CodeFlux Support (opens `https://www.nousflux.com`) and Export Logs.
- **Settings → About**: CodeFlux logo, name, version, company line and the `www.nousflux.com` link on top. At the bottom, a small "Open source" block: OpenCode is the basis, MIT, `Copyright (c) 2025 opencode`, not affiliated, link to the OpenCode GitHub page, third-party notices, and the contributor credits.
- **Provider picker**: one NousFlux banner plus OpenAI, Anthropic and Google buttons, in the connect dialog and in the empty model picker.
- **NousFlux page**: image, NousFlux URL (default `https://www.nousflux.com`), API key, then a model list. "Load models" calls `GET {URL}/v1/models` with the key (`Authorization: Bearer`) from the renderer; the user ticks the models to add (Select all / Clear). Submit calls `integration.connect.key` with `answer: { baseURL, models }` (models comma-joined). The plugin builds `baseURL/v1` and the model list from the stored credential metadata. Provider ID and display name are fixed (`nousflux`, `NousFlux`). `www.nousflux.com` answers CORS preflight with `Access-Control-Allow-Origin: *`; another server must do the same.
- **Free models**: `useProviders()` drops free models of provider `opencode` (`withoutFreeCatalog`); paid ones stay.
- **Splash**: a static, inlined splash (white, `screen-720.webp` as base64) is injected into both HTML entries and removed by `removeSplash()` after the first frame; the desktop `LoadingSplash` renders the same `CodeFluxSplash`.

## 4. Changes to upstream files

| File | Change |
|---|---|
| `packages/app/vite.js` | `codefluxVite()`: title, inline splash |
| `packages/app/index.html`, `packages/desktop/src/renderer/index.html` | `<title>` is CodeFlux |
| `packages/app/src/app.tsx` | `<Title>CodeFlux</Title>` |
| `packages/app/src/entry.tsx` | `removeSplash()` after first render |
| `packages/app/src/runtime/i18n/language.tsx` | `brandDictionary()` on every loaded dictionary |
| `packages/app/src/runtime/i18n/desktop-native.ts` | English native strings say CodeFlux; new key `desktop.menu.codefluxSupport` |
| `packages/app/src/shell/commands/desktop-menu.ts` | Help menu reduced to two items |
| `packages/app/src/shell/titlebar/windows-menu.tsx` | Menu heading reads `desktop.menu.app` instead of the hard-coded "OpenCode" |
| `packages/app/src/providers/connect/dialog.tsx` | Picker replaced by `CodeFluxProviderPicker`; NousFlux form branch (passes `platform.fetch`); title; unused imports removed |
| `packages/app/src/providers/connect/controller.ts` | `connectKey(key, answer?)` |
| `packages/app/src/providers/models/unpaid.tsx` | Empty model picker shows the four provider buttons |
| `packages/app/src/providers/catalog/providers.ts` | `withoutFreeCatalog()` |
| `packages/app/src/providers/opencode-logo.tsx`, `models/provider-group.tsx` | CodeFlux mark |
| `packages/app/src/{new-session/view,servers/connect/screen}.tsx` | `CodeFluxWordmark` (the pin-board wordmark game is no longer shown) |
| `packages/app/src/settings/about/about.tsx`, `settings/settings.css` | New About page |
| `packages/app/src/custom-elements.d.ts` | Replaced a Windows text stub of a symlink with a `/// <reference>` |
| `packages/app/package.json`, `packages/desktop/package.json`, `packages/core/package.json` | Dependencies on the two new packages |
| `packages/desktop/src/renderer/startup/splash.tsx` | Renders `CodeFluxSplash`; `splash.css` removed |
| `packages/desktop/src/renderer/platform/notifications.ts` | Notification icon is the bundled favicon, not an opencode.ai URL |
| `packages/desktop/src/main/constants.ts`, `electron-builder.config.ts`, `script/copy-metainfo.ts`, tests | Product names CodeFlux / CodeFlux Dev / CodeFlux Beta; app IDs `com.nousflux.codeflux[.dev\|.beta]` (Windows groups taskbar buttons, pins and notifications by this ID, so OpenCode's ID showed OpenCode's icon); upstream update feed removed; metainfo rewritten |
| `packages/desktop/src/main/windows/{early,appearance}.ts` | Window titles |
| `packages/desktop/src/main/lifecycle/configure.ts` | User data in `%APPDATA%\CodeFlux`; `XDG_{DATA,CONFIG,CACHE,STATE}_HOME` point into it, so CodeFlux never shares data, the single-instance lock or the background service with an installed OpenCode |
| `packages/desktop/src/main/lifecycle/environment.ts` | No longer deletes `XDG_STATE_HOME` |
| `packages/desktop/resources/linux/opencode-desktop.desktop` | Name and path say CodeFlux |
| `packages/core/src/plugin/provider.ts` | Registers `NousFluxPlugin` |
| `LICENSE`, `NOTICE.md` | Rewritten as the enterprise license: Part 1 CodeFlux Proprietary License (owner Hongkong CONTESSA INTELLIGENCE TECH LIMITED), Part 2 the OpenCode MIT text |

## 5. Build and run (Windows x64)

Needs bun ≥ 1.4.4 (`bun upgrade`) and `bun install` at the repository root.

1. CLI, on the `latest` channel with a release version. The desktop app looks for the service registration `service.json`, which only the `latest` channel writes (`prod` writes `service-prod.json`, so the app never finds the service it started and times out). The desktop bundles the baseline build:
   `cd packages/cli`; `$env:OPENCODE_CHANNEL="latest"; $env:OPENCODE_VERSION="2.1.4"; bun run script/build.ts --single --baseline --skip-install`
2. Desktop build and package, from `packages/desktop`. The mirrors are for networks that cannot reach GitHub:
   `$env:OPENCODE_CHANNEL="prod"; $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"; bun run build; bun run pack`
3. Run `dist/desktop/app/CodeFlux.exe`. Check `dist/desktop/app/resources/opencode-cli.exe --version` prints `opencode v2.1.4`.
4. Before a re-run, stop stray `opencode-cli.exe` processes (`Get-Process opencode-cli | Stop-Process -Force`); one holding port 13420 makes the new service fail to start. To start from a clean state, delete `%APPDATA%\CodeFlux`.

## 6. Problems met and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `bun check` unknown flag | Local bun 1.4.3 | Use each package's `typecheck:tsc` |
| `tsc -b` fails on `custom-elements.d.ts` | Symlink checked out as text | `/// <reference>` |
| Icon script: "unsupported image format" | Symlink stubs in `app/public` | Script follows the stub's path |
| CLI build: needs bun ^1.4.4 | Local bun 1.4.3 | `bun upgrade` |
| Desktop build: CLI not found | It bundles `cli-windows-x64-baseline`, not the plain build | Build the CLI with `--baseline` |
| Pack: `connect ETIMEDOUT` to GitHub | Electron download blocked | npmmirror environment variables |
| "Timed out waiting for the background service to start" (1) | CodeFlux shared `%APPDATA%\ai.opencode.desktop` and the service registry with OpenCode | Own profile and XDG directories |
| Same error (2) | Stray CLI held port 13420 | Stop it |
| Same error (3) | CLI built on `prod` wrote `service-prod.json`; the app reads `service.json` | Build the CLI on `latest`; `XDG_STATE_HOME` no longer deleted |
| Same error (4) | The `latest` build failed for lack of `OPENCODE_VERSION` and the old CLI was packaged unnoticed | Pass the version; check the build result and `--version` |
| Taskbar still showed the OpenCode icon | The exe icon was already CodeFlux; Windows used OpenCode's shortcut because both shared the app ID | New app IDs |
| Top-left menu said "OpenCode" | Hard-coded in `windows-menu.tsx` | Uses `desktop.menu.app` |

## 7. Tests and checks

Run from each package directory (`bun test` cannot run from the root): `packages/codeflux` (22 tests: rebrand, free-model filter, model list parsing and fetching; all pass at completion), `packages/codeflux-provider` (10), `packages/desktop` (`electron-builder.config.test.ts`, `src/renderer`), `packages/app` (`src/shell/commands`, `src/providers`). Type checks: `bun run typecheck:tsc` in `app`, `core`, `desktop`, `codeflux`, `codeflux-provider`. Known upstream failure: `app/src/runtime/i18n/language.test.ts` ("flat string maps") because `hr`, `hu`, `is`, `lt` lack `desktop.picker.error.sizeLimit`.

## 8. License

See section 12.

## 9. Known gaps

- `.icns` (macOS) icons are still OpenCode's; generate from `icon.png` when packaging for macOS.
- TUI and CLI are unchanged by design. The deep-link scheme `opencode://` and the Linux/installer scripts' internal names are unchanged.
- The Console/Zen provider flows still exist in the code but are not reachable from the picker. Other upstream links remain in documentation and some dialogs.
- `app/public` symlink stubs (favicon, apple-touch-icon, manifest icons) are real files only after `bun run icons`; on checkouts without symlink support they are text files again after a fresh clone.
- The About page, the NousFlux model list and the layout fix have no automated UI tests; see section 13.

## 10. Later changes

- **Images**: `codeflux-screen.png` was replaced (now the CodeFlux wordmark); `assets/derived/screen-720.webp` was regenerated with `bun run scripts/gen-icons.ts --derived`. The splash and the NousFlux page use it, so the NousFlux page now shows the CodeFlux wordmark. `assets/derived/image_52ba2de5.jpg` is a stray pasted file and can be deleted.
- **NousFlux page layout**: the fields (image, URL, key, model list) sit in `.cf-nousflux-scroll`, which scrolls; the error line and the Continue button sit in `.cf-nousflux-footer` and never leave the dialog. The model list itself is capped at 160px and scrolls too.

## 11. Package size analysis (Windows x64, version 2.1.4)

Packaged app `dist/desktop/app`: 829 MB. Where it goes:

| Part | Size | Notes |
|---|---|---|
| `resources/opencode-cli.exe` | 242 MB | Bun runtime plus the CLI; about 25 MB of it is an embedded copy of the web UI the desktop never uses (`OPENCODE_DISABLE_EMBEDDED_WEB_UI=true`) |
| `CodeFlux.exe` (Electron) | 236 MB | |
| `resources/app.asar` | 218 MB | renderer 146 MB + main 4 MB + `node_modules` ≈ 70 MB |
| `locales/` | 49 MB | 55 Chromium language packs |
| other Electron files | ~85 MB | dlls, pak, icu |

Inside the renderer (`out/renderer/assets`, 5353 files): source maps 58 MB (2577 `.map` files), Office-preview wasm 35 MB (docx/pptx/xlsx), Office-preview fonts 16 MB, JavaScript 33 MB (mostly syntax-highlighting grammars).

Inside `node_modules` of the asar: the Lighthouse stack is about 75 MB (`lighthouse` 19, `@paulirish/trace_engine` 11, `@sentry/*` 9, `third-party-web` 8, `puppeteer-core` 7, `@opentelemetry` 6, `web-features` 4.5, `zod` 4, `axe-core` 3, `devtools-protocol` 2, `chromium-bidi` 2). It serves the built-in browser pane's Lighthouse audit (`gui-extensions/src/browser/lighthouse.ts`).

### Build settings that shrink the package (no feature lost)

| Change | Saves |
|---|---|
| `files: ["!out/**/*.map"]` in `electron-builder.config.ts` | ~58 MB |
| `electronLanguages: ["en-US", "zh-CN", "zh-TW"]` | ~45 MB |
| CLI built with `--skip-web-ui` | ~25 MB |

### Features that can be dropped (decision needed)

| Remove | Saves | Cost |
|---|---|---|
| `lighthouse` dependency of `packages/desktop` (and the Lighthouse tool in `gui-extensions/src/browser`) | ~75 MB | No Lighthouse audit in the browser pane |
| Office previews (`@betteroffice/*`, wasm, fonts) in `packages/gui-extensions/src/microsoft-office` | ~50 MB | No docx/pptx/xlsx preview |
| Syntax-highlighting grammars of rarely used languages | up to ~15 MB | Plain text for those languages |

### Source directories not needed for the desktop app or CLI

Found by walking the `package.json` dependencies of `@opencode/desktop`, `@opencode/cli` and the two CodeFlux packages. They do not change the installer size (they are not bundled) but shrink the repository and the install and typecheck time.

| Directory | Size | What it is |
|---|---|---|
| `packages/console` | 45 MB | OpenCode cloud console and billing site |
| `packages/web` | 13 MB | Documentation website |
| `packages/stats` | 2.1 MB | Usage statistics service |
| `services/www`, `services/changelog`, `services/update`, `services/files` | 1.9 MB | Marketing site, changelog, update and file services |
| `packages/function`, `packages/posts`, `packages/identity` | 0.1 MB | Cloud function, blog posts |
| `packages/sdk`, `sdks/` | 0.3 MB | SDK packaging and client SDKs |
| `packages/plugins` (figma) | 1.8 MB | Figma plugin, not referenced |
| `infra/`, `sst.config.ts`, `sst-env.d.ts`, `salesforce/`, `perf/`, `nix/`, `flake.*`, `.github/`, `specs/` | <1 MB | Cloud infrastructure, CI, Nix |
| `README.*.md` (21 translations), `CHANGELOG.md`, `screenshot-uk.png` | <1 MB | Upstream documentation |

Keep: `packages/{ai,app,cli,client,codemode,core,desktop,gui-extensions,http-recorder,httpapi-codegen,latex,merman,patchmark,plugin,plugin-browser,protocol,schema,script,server,session-ui,simulation,theme,tui,ui,util}`, `packages/stories` (the app's tests refer to it), `patches/`, `script/`, `LICENSE`, `NOTICE.md`.

Removing the workspaces means editing the root `package.json` `workspaces` (`packages/console/*`, `packages/stats/*`, `services/*`), running `bun install` to refresh `bun.lock`, and dropping scripts that point at them (`dev:console`, `dev:stats`, `dev:www`). Build outputs (`dist/`, `packages/*/dist`, `packages/desktop/out`) are generated and can always be deleted.

## 12. Enterprise license

Copyright owner: **Hongkong CONTESSA INTELLIGENCE TECH LIMITED**. The owner chose a proprietary license for CodeFlux's own parts.

- `LICENSE` has two parts. Part 1, the CodeFlux Proprietary License, covers the "CodeFlux Components": `packages/codeflux`, `packages/codeflux-provider`, the CodeFlux name, logos and images, the NousFlux integration, the owner's own changes to OpenCode files, and the compiled application. All rights reserved: no copying, modification, distribution or derivative works without written permission; installed use by a recipient of the compiled app is allowed. Part 2 reproduces the OpenCode MIT text, which the MIT License requires and which keeps governing the OpenCode parts.
- `NOTICE.md` states the ownership and the derivation from OpenCode.
- The installer ships both as `resources/LICENSE.txt` and `resources/NOTICE.md` (`extraResources` in `electron-builder.config.ts`); the config also sets `copyright`.
- `packages/codeflux`, `packages/codeflux-provider` and `packages/desktop` declare `"license": "SEE LICENSE IN ../../LICENSE"` and the company as author; the desktop `homepage` is `https://www.nousflux.com`.
- Settings → About shows the copyright line under the company line; the OpenCode block stays at the bottom.

Limits of this work: the license text is a draft written from the owner's choice, not reviewed by a lawyer; the owner should have counsel review it, in particular the governing law and jurisdiction clauses, which are deliberately absent. Files copied unchanged from OpenCode cannot be relicensed; the "owner's own changes" wording in 2(c) only claims what the owner actually wrote. Third-party packages keep their own licenses.

## 13. Completion record

Status: delivered. The user confirmed the build works and closed the project phase.

### Requirements and where they are met

| # | Requirement | Result |
|---|---|---|
| 1, 2 | Logo and UI identity are CodeFlux | Done (sections 3, 4); app ID `com.nousflux.codeflux` fixes the taskbar icon |
| 3 | Loading screen from `codeflux-screen.png` | Done; regenerated after the image was replaced |
| 4 | Visible "OpenCode" text becomes CodeFlux, license content kept | Done by dictionary rebranding; OpenCode block kept at the bottom of About |
| 5 | Four provider buttons; NousFlux page | Done; models are read from `{URL}/v1/models` and chosen by the user; the Continue button stays visible |
| 6, 7 | No OpenCode free models in Manage models or the model dropdown | Done (`withoutFreeCatalog`) |
| 8 | Top-left menu says CodeFlux; Help has CodeFlux Support and Export Logs | Done |
| 9 | About page: company on top, OpenCode information small at the bottom | Done |
| 10 | Enterprise license, owner Hongkong CONTESSA INTELLIGENCE TECH LIMITED | Done (section 12); shipped in the installer |

### Final deliverable

`dist/desktop/app/CodeFlux.exe` (Windows x64, version 2.1.4, bundled CLI `opencode v2.1.4` on the `latest` channel), packaged 2026-10-27. `resources/` contains `LICENSE.txt` and `NOTICE.md`. The installer exe was not built; the unpacked app runs directly.

### Decisions the user made

- NousFlux form built from scratch; OpenAI-compatible protocol.
- Rename limited to the GUI and desktop app; TUI and CLI keep OpenCode.
- Pin-board wordmark game dropped in favour of a static CodeFlux wordmark.
- bun upgraded to 1.4.4 to run the build scripts.
- Proprietary license for CodeFlux's own parts.
- Size reduction was analysed (section 11) but deliberately not applied; the package stays at about 830 MB. A trial edit to `electron-builder.config.ts` was reverted.

### Open items for later

- Have counsel review the license text and add governing law and jurisdiction.
- `.icns` (macOS) icons are not generated; macOS packaging is untested.
- The deep-link scheme `opencode://` is unchanged.
- The About page, the NousFlux model list and the layout fix were verified by type checks and unit tests plus the user's run, not by automated UI tests.
- Remove `assets/derived/image_52ba2de5.jpg` (stray file).
- Stray `opencode-cli.exe` processes can stay behind after the window closes; stop them before repackaging.
- If CodeFlux is rebuilt, keep the order: CLI (`latest`, `--baseline`) first, then desktop build and pack (section 5).

## 14. Publishing builds from GitHub

Repository: `https://github.com/ContessaIntelligence/codeflux`, default branch `main`.

**Workflow**: `.github/workflows/codeflux-release.yml` (new). It runs on a pushed tag `v*` or by hand (Actions → codeflux-release → Run workflow, enter the version). Three jobs run in parallel, each building the CLI on the `latest` channel (`--single --baseline`), then the desktop app (`build`, `pack`), and a final `publish` job creates the GitHub release with the files and `SHA256SUMS.txt`.

| Runner | Release files |
|---|---|
| `windows-2025` | `CodeFlux-win-x64.exe` (NSIS installer, built in a second `pack` pass around the unpacked app), `CodeFlux-windows-x64-portable.zip` (the unpacked app, the form verified locally) |
| `ubuntu-24.04` | `CodeFlux-linux-x86_64.AppImage`, `.deb`, `.rpm` (names follow electron-builder's `${arch}`) |
| `macos-15` (Apple Silicon) | `CodeFlux-mac-arm64.app.tar` |

The upstream scripts keep their `opencode-desktop-*` file names; the workflow renames the files to `CodeFlux-*` when collecting them, so no local script changed for this.

**Change to a local build file**: `packages/desktop/electron-builder.config.ts` now points `mac.icon` at `icon.png` (512×512) so electron-builder generates the macOS icon; the checked-in `icon.icns` is still OpenCode's. Nothing else in the local build flow changes; section 5 still works as before.

**Before the first run**
1. `bun.lock` is stale: it lacks `png-to-ico` (and `sharp`) from `packages/codeflux`, so the `bun install --frozen-lockfile` in CI fails. Run `bun install` at the repository root and commit `bun.lock`.
2. Done: the stray tracked files `exe-icon.png` and `packages/codeflux/assets/derived/image_52ba2de5.jpg` were removed with `git rm` (staged, not yet committed).
3. Done: all 19 upstream workflows in `.github/workflows/` were removed with `git rm` (staged). The `triage-*` ones had no repository guard and would have run on a schedule on the default branch. Only `codeflux-release.yml` remains; `.github/actions/setup-bun` stays because the new workflow uses it.

**Release**: `git tag v2.1.4` and `git push origin v2.1.4`, or run the workflow by hand. Builds take roughly 30–60 minutes. Files appear under the repository's Releases page.

**Limits**
- Nothing in the three builds is signed or notarized. Windows shows SmartScreen ("More info" → "Run anyway"); macOS needs `xattr -cr CodeFlux.app` after extracting the tar. Signing needs a Windows code-signing certificate and an Apple Developer ID, supplied as repository secrets.
- Only the unpacked Windows app has been run so far. The Windows installer, the Linux packages and the macOS app were not built or run, and the macOS icon conversion is untried; the first workflow run is the first test of them.
- macOS is Apple Silicon only. An Intel build needs one more matrix entry on `macos-15-intel`.
- The CLI build downloads the models catalog from `models.opencode.ai` at build time, an upstream service.
- On a private repository macOS runner minutes cost ten times Linux minutes.
