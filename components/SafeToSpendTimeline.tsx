export type TimelineDay = {
  date?: string;
  label: string;
  balance: number;
  buffer: number;
  isLowDay?: boolean;
};

type SafeToSpendTimelineProps = {
  days: TimelineDay[];
  currency?: string;
};

function formatShortAmount(value: number, currency: string) {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${currency}${(value / 1000).toFixed(1)}k`;
  }
  return `${currency}${Math.round(value)}`;
}

export function SafeToSpendTimeline({
  days,
  currency = "£",
}: SafeToSpendTimelineProps) {
  if (days.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--card)] text-sm text-[var(--muted)]">
        Loading timeline…
      </div>
    );
  }

  const values = days.flatMap((day) => [day.balance, day.buffer]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  const toHeight = (value: number) =>
    `${Math.max(8, ((value - min) / range) * 100)}%`;

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--foreground)]">
          14-day cash curve
        </h2>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--lemon)]" />
            Balance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-[var(--buffer-line)]" />
            Safe buffer
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="flex h-36 items-end gap-1 sm:gap-1.5">
          {days.map((day, index) => {
            const belowBuffer = day.balance < day.buffer;

            return (
              <div
                key={day.date ?? `${day.label}-${index}`}
                className="group flex flex-1 flex-col items-center gap-1"
              >
                <div className="relative flex h-28 w-full items-end justify-center">
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-[var(--buffer-line)]"
                    style={{ bottom: toHeight(day.buffer) }}
                    aria-hidden
                  />

                  <div
                    className={`w-full max-w-[2rem] rounded-t transition-colors ${
                      day.isLowDay
                        ? "bg-[var(--danger)]"
                        : belowBuffer
                          ? "bg-amber-500/80"
                          : "bg-[var(--lemon)]/90"
                    } ${day.isLowDay ? "ring-2 ring-[var(--danger)]/40" : ""}`}
                    style={{ height: toHeight(day.balance) }}
                    title={`${day.label}: ${formatShortAmount(day.balance, currency)}`}
                  />
                </div>

                <span
                  className={`text-[10px] sm:text-xs ${
                    day.isLowDay
                      ? "font-semibold text-[var(--danger)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
