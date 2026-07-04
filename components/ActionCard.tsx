type RiskLevel = "low" | "medium" | "high";

export type ActionCardProps = {
  customer: string;
  invoiceAmount: number;
  summary: string;
  recommendation: string;
  speed: RiskLevel;
  cost: RiskLevel;
  relationshipRisk: RiskLevel;
  accent?: "lemon" | "danger" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
  currency?: string;
};

const riskStyles: Record<
  RiskLevel,
  { label: string; bar: string; text: string }
> = {
  low: {
    label: "Low",
    bar: "bg-emerald-500/80",
    text: "text-emerald-400",
  },
  medium: {
    label: "Med",
    bar: "bg-amber-500/80",
    text: "text-amber-400",
  },
  high: {
    label: "High",
    bar: "bg-[var(--danger)]/80",
    text: "text-[var(--danger)]",
  },
};

const riskWidth: Record<RiskLevel, string> = {
  low: "w-1/3",
  medium: "w-2/3",
  high: "w-full",
};

const accentStyles = {
  lemon: "border-[var(--lemon)]/25 bg-[var(--lemon-dim)]",
  danger: "border-[var(--danger)]/25 bg-[var(--danger-dim)]",
  neutral: "border-[var(--card-border)] bg-[var(--card)]",
};

function RiskMeter({
  label,
  level,
}: {
  label: string;
  level: RiskLevel;
}) {
  const style = riskStyles[level];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--muted)]">{label}</span>
        <span className={style.text}>{style.label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${style.bar} ${riskWidth[level]}`} />
      </div>
    </div>
  );
}

export function ActionCard({
  customer,
  invoiceAmount,
  summary,
  recommendation,
  speed,
  cost,
  relationshipRisk,
  accent = "neutral",
  actionLabel,
  onAction,
  currency = "£",
}: ActionCardProps) {
  return (
    <article
      className={`rounded-xl border p-4 ${accentStyles[accent]} transition-colors`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">{customer}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{summary}</p>
        </div>
        <span className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-sm font-medium tabular-nums">
          {currency}
          {invoiceAmount.toLocaleString("en-GB")}
        </span>
      </header>

      <p className="mb-4 text-sm leading-relaxed text-[var(--foreground)]/90">
        {recommendation}
      </p>

      <div className="mb-4 space-y-2.5">
        <RiskMeter label="Speed" level={speed} />
        <RiskMeter label="Cost" level={cost} />
        <RiskMeter label="Relationship" level={relationshipRisk} />
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
            accent === "danger"
              ? "bg-[var(--danger)] text-white hover:bg-red-400"
              : "bg-[var(--lemon)] text-[#1a1f0a] hover:bg-[#e0ed6a]"
          }`}
        >
          {actionLabel}
        </button>
      )}
    </article>
  );
}
