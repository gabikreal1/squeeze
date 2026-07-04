export function gbp(n: number, opts?: { sign?: boolean; decimals?: boolean }) {
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: opts?.decimals ? 2 : 0,
    maximumFractionDigits: opts?.decimals ? 2 : 0,
  }).format(abs)
  const prefix = n < 0 ? "−£" : opts?.sign ? "+£" : "£"
  return `${prefix}${formatted}`
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`
}
