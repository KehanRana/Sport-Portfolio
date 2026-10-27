export function bindClasses(styles: Record<string, string>) {
  return (...names: (string | false | null | undefined)[]) =>
    names
      .filter(Boolean)
      .join(" ")
      .split(/\s+/)
      .map((name) => styles[name] ?? name)
      .join(" ");
}
