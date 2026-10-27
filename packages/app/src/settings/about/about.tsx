import { createResource } from "solid-js"
import { useDialog } from "@opencode/ui/context/dialog"
import { CodeFluxLogo } from "@codeflux/gui/logo"
import { BRAND } from "@codeflux/gui/brand"
import { text } from "@codeflux/gui/i18n"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ExternalLink } from "@/runtime/platform/external-link"
import { showToast } from "@/shell/notifications/toast"
import { FALLBACK_OTHER_CONTRIBUTORS, loadOtherContributorCount } from "./contributors"

const writers = [
  "thdxr",
  "adamdotdev",
  "rekram1-node",
  "kitlangton",
  "iamdavidhill",
  "jayair",
  "fwang",
  "brendonovich",
  "nexxeln",
  "hona",
  "kommander",
  "jlongster",
  "vimtor",
  "r44vcorp",
  "simonklee",
  "arvsrn",
] as const

const illustrators = ["usrnk1", "ludvigrask_", "arvsrn", "iamdavidhill"] as const

const UPSTREAM = "https://github.com/anomalyco/opencode"

/**
 * CodeFlux's own details come first: product, company and website. The OpenCode information the MIT License asks
 * to be kept sits last, in a small text block.
 */
export function SettingsAbout(props: { active: boolean }) {
  const language = useLanguage()
  const platform = usePlatform()
  const dialog = useDialog()
  const t = (key: Parameters<typeof text>[1]) => text(language.locale(), key)

  const [otherContributors] = createResource(
    () => props.active || undefined,
    () => loadOtherContributorCount(platform.fetch ?? fetch),
    { initialValue: FALLBACK_OTHER_CONTRIBUTORS },
  )

  const credit = (name: string) => (
    <bdi dir="ltr">
      <ExternalLink href={profile(name)}>{name}</ExternalLink>
    </bdi>
  )

  const writerCredits = () => [
    ...writers.map(credit),
    <ExternalLink href={`${UPSTREAM}/graphs/contributors`}>
      {language.plural("settings.about.otherContributor", otherContributors.latest, {
        count: otherContributors.latest,
      })}
    </ExternalLink>,
  ]

  const showNotices = async () => {
    // The license texts load only when someone reads them.
    const loaded = await import("./notices/dialog").catch(() => undefined)

    if (!loaded) {
      showToast({ variant: "error", title: language.t("settings.about.notices.loadFailed") })

      return
    }

    void dialog.show(() => <loaded.default />)
  }

  return (
    <div class="settings-about-content">
      <div class="settings-about-brand">
        <CodeFluxLogo class="settings-about-logo" />
        <h2 class="settings-about-name">{BRAND.name}</h2>
        <p>
          {language.t("settings.about.version", {
            version: platform.version ?? language.t("settings.about.devVersion"),
          })}
        </p>
      </div>

      <div class="settings-about-company">
        <p>{t("about.company")}</p>
        <p>{t("about.copyright")}</p>
        <p>
          <ExternalLink href={BRAND.supportURL}>
            <bdi dir="ltr">{t("about.website")}</bdi>
          </ExternalLink>
        </p>
      </div>

      <section class="settings-about-opensource" aria-labelledby="settings-about-opensource-title">
        <h3 id="settings-about-opensource-title">{t("about.openSource.title")}</h3>
        <p>{t("about.openSource.body")}</p>
        <p>
          <ExternalLink href={UPSTREAM}>
            <bdi dir="ltr">{t("about.openSource.link")}</bdi>
          </ExternalLink>
          {" · "}
          <button type="button" class="settings-about-link" onClick={() => void showNotices()}>
            {language.t("settings.about.notices.title")}
          </button>
        </p>
        <p>{language.rich("settings.about.writtenByNames", { names: language.list(writerCredits()) })}</p>
        <p>
          {language.rich("settings.about.illustratedByNames", {
            names: language.list(illustrators.map(credit)),
          })}
        </p>
      </section>
    </div>
  )
}

function profile(name: string) {
  if (name === "r44vcorp") return "https://github.com/R44VC0RP"

  if (name === "ludvigrask_") return "https://x.com/ludvigrask_"

  return `https://github.com/${name}`
}
