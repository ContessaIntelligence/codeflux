/** Fades out and removes the static splash that `codefluxVite()` puts in the page before any script runs. */
export function removeSplash() {
  const splash = document.getElementById("codeflux-splash")

  if (!splash) return
  splash.dataset.leaving = ""
  // The fade is skipped when transitions are disabled, so the timer is what guarantees removal.
  setTimeout(() => splash.remove(), 250)
}
