/**
 * Ambient declarations for CSS Modules imports (Vite handles them at build;
 * this lets `tsc --noEmit` resolve `*.module.css` imports as typed records).
 */
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
