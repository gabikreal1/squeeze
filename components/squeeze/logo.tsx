export function SqueezeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M16 3C9.5 9 6 13.5 6 19a10 10 0 0 0 20 0c0-5.5-3.5-10-10-16Z"
        fill="var(--primary)"
      />
      <path
        d="M16 3C9.5 9 6 13.5 6 19a10 10 0 0 0 10 10V3Z"
        fill="var(--primary)"
        fillOpacity="0.55"
      />
      <path d="M16 10v14" stroke="var(--primary-foreground)" strokeWidth="1.4" strokeOpacity="0.6" />
      <path d="M11 15.5 16 19l5-3.5" stroke="var(--primary-foreground)" strokeWidth="1.4" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
