export function renderNameWithFallback(name: string, useShort: boolean) {
  if (!useShort) return name
  return name.slice(0, 1)
}
