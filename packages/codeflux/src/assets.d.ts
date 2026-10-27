// Vite resolves these imports; the package only needs the compiler to accept them, including the ones inside
// `@opencode/ui` components that it type-checks along the way.
declare module "*.css"

declare module "*.png" {
  const src: string
  export default src
}

declare module "*.webp" {
  const src: string
  export default src
}

declare module "*.svg" {
  const src: string
  export default src
}
