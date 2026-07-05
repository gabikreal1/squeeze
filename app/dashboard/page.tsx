"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Newspaper,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { enrichForecast } from "@/lib/enrich-forecast";
import type { ForecastResponse, SqueezeAction, TimelinePoint } from "@/lib/squeeze-data";
import { cn } from "@/lib/utils";
import { SqueezeLogo } from "@/components/squeeze/logo";
import { TodayView } from "@/components/squeeze/today-view";
import { ActionsView } from "@/components/squeeze/actions-view";
import { ScenariosView } from "@/components/squeeze/scenarios-view";
import { BriefingPage } from "@/components/squeeze/briefing-page";
import { Copilot } from "@/components/squeeze/copilot";
import { useForecastEvents } from "@/components/squeeze/use-forecast-events";
import { ThemeToggle } from "@/components/squeeze/theme-toggle";
import type { ApiForecastResponse } from "@/lib/api/format-forecast";
import type { ForecastUpdatedPayload } from "@/lib/events/sse-hub";

type ViewId = "today" | "plan" | "customers" | "briefing";

const NAV: { id: ViewId; label: string; icon: LucideIcon; badge?: boolean }[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "plan", label: "Plan", icon: SlidersHorizontal },
  { id: "customers", label: "Customers", icon: ListChecks, badge: true },
  { id: "briefing", label: "Briefing", icon: Newspaper },
];

export default function DashboardPage() {
  const [view, setView] = useState<ViewId>("today");
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [apiForecast, setApiForecast] = useState<ApiForecastResponse | null>(null);
  const [ghostTimeline, setGhostTimeline] = useState<TimelinePoint[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healing, setHealing] = useState(false);
  const [callStates, setCallStates] = useState<
    Record<string, "idle" | "calling" | "done">
  >({});
  const [messageStates, setMessageStates] = useState<
    Record<string, "idle" | "sending" | "sent" | "error">
  >({});
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [xeroConnected, setXeroConnected] = useState<boolean | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const awaitingPaymentRef = useRef(false);

  useEffect(() => {
    awaitingPaymentRef.current = awaitingPayment;
  }, [awaitingPayment]);

  const healed = Boolean(forecast?.gapClosed);

  const showToast = useCallback((title: string, detail: string) => {
    setToast({ title, detail });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const applyForecastUpdate = useCallback(
    (payload: ForecastUpdatedPayload) => {
      const api = payload.forecast;
      setForecast((prev) => {
        if (prev && !prev.gapClosed && api.gapClosed) {
          setGhostTimeline(prev.timeline);
        }
        return enrichForecast(api);
      });
      setApiForecast(api);
      setLastUpdated(new Date());
      setAwaitingPayment(false);
      awaitingPaymentRef.current = false;
      setHealing(false);

      if (api.gapClosed) {
        setCallStates((prev) => {
          const next = { ...prev };
          for (const action of api.actions) {
            if (action.customer.includes("BrightBuild")) {
              next[action.id] = "done";
            }
          }
          return next;
        });
        const amount = payload.paymentAmount ?? api.paymentReceived;
        showToast(
          "Payment received",
          amount
            ? `${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount)} landed via Xero — forecast healed.`
            : "Xero webhook updated your forecast.",
        );
      }
    },
    [showToast],
  );

  useForecastEvents({
    enabled: xeroConnected === true,
    onConnected: () => setSseConnected(true),
    onDisconnected: () => setSseConnected(false),
    onForecastUpdated: applyForecastUpdate,
  });

  const loadForecast = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/forecast", { cache: "no-store" });
      if (!response.ok) throw new Error("Forecast unavailable");
      const raw = (await response.json()) as ApiForecastResponse;
      setApiForecast(raw);
      const data = enrichForecast(raw);
      setForecast((prev) => {
        if (prev && !prev.gapClosed && data.gapClosed) {
          setGhostTimeline(prev.timeline);
        }
        return data;
      });
      setLastUpdated(new Date());
      if (data.gapClosed) {
        setCallStates((prev) => {
          const next = { ...prev };
          for (const action of raw.actions) {
            if (action.customer.includes("BrightBuild")) {
              next[action.id] = "done";
            }
          }
          return next;
        });
        setAwaitingPayment(false);
        awaitingPaymentRef.current = false;
        setHealing(false);
      }
    } catch {
      setError("Could not load forecast. Check Xero connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadForecast();
    void fetch("/api/xero/status")
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setXeroConnected(d.connected))
      .catch(() => setXeroConnected(false));
  }, [loadForecast]);

  const sendWhatsApp = async (action: SqueezeAction) => {
    if (!action.messageRung) return;
    setMessageStates((prev) => ({ ...prev, [action.id]: "sending" }));
    setError(null);
    try {
      const response = await fetch("/api/messages/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: action.customer,
          contactId: action.id,
          contactPhone: action.contactPhone,
          invoiceNumber: action.invoiceNumber,
          amount: action.invoiceAmount,
          daysOverdue: action.daysOverdue,
          rung: action.messageRung,
          dontSqueeze: action.dontSqueeze,
          orgName: forecast?.orgName,
        }),
      });
      const data = (await response.json()) as { error?: string; preview?: string };
      if (!response.ok) throw new Error(data.error ?? "WhatsApp send failed");
      setMessageStates((prev) => ({ ...prev, [action.id]: "sent" }));
      showToast("WhatsApp sent", `Nudge delivered to ${action.customer}.`);
    } catch (err) {
      setMessageStates((prev) => ({ ...prev, [action.id]: "error" }));
      setError(err instanceof Error ? err.message : "Could not send WhatsApp message.");
    }
  };

  const recordPayment = async (invoiceNumber = "SQZ-BB-2400") => {
    if (!forecast || healing || awaitingPayment) return;
    setHealing(true);
    setAwaitingPayment(true);
    setGhostTimeline(forecast.timeline);
    setError(null);
    try {
      const response = await fetch("/api/xero/record-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber }),
      });
      const data = (await response.json()) as {
        error?: string;
        amount?: number;
        recorded?: boolean;
        forecast?: ApiForecastResponse;
      };
      if (!response.ok) throw new Error(data.error ?? "Payment recording failed");

      if (data.forecast) {
        applyForecastUpdate({
          forecast: data.forecast,
          source: "payment",
          paymentAmount: data.amount,
        });
      }

      showToast(
        "Payment received",
        data.amount
          ? `${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(data.amount)} recorded in Xero — forecast healed.`
          : "Payment recorded in Xero — forecast updated.",
      );

      // Fallback if webhook/SSE is slow (e.g. ngrok not running).
      window.setTimeout(async () => {
        if (!awaitingPaymentRef.current) return;
        await loadForecast(true);
      }, 8000);
    } catch (err) {
      setGhostTimeline(undefined);
      setAwaitingPayment(false);
      setHealing(false);
      setError(err instanceof Error ? err.message : "Could not record payment in Xero.");
    }
  };

  const approveCall = async (action: SqueezeAction) => {
    setCallStates((prev) => ({ ...prev, [action.id]: "calling" }));
    setError(null);

    try {
      const response = await fetch("/api/calls/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: action.contactPhone,
          contactName: action.customer,
          invoiceAmount: action.invoiceAmount,
          daysOverdue: action.daysOverdue,
          invoiceNumber: action.invoiceNumber,
        }),
      });
      const data = (await response.json()) as { error?: string; to?: string };
      if (!response.ok) throw new Error(data.error ?? "AI call failed");

      showToast(
        "AI call started",
        data.to
          ? `Dialling ${action.customer} at ${data.to}…`
          : `Dialling ${action.customer}…`,
      );

      window.setTimeout(() => {
        setCallStates((prev) =>
          prev[action.id] === "calling" ? { ...prev, [action.id]: "idle" } : prev,
        );
      }, 30000);
    } catch (err) {
      setCallStates((prev) => ({ ...prev, [action.id]: "idle" }));
      setError(err instanceof Error ? err.message : "Could not place AI call.");
    }
  };

  const resetDemo = async () => {
    setError(null);
    try {
      const response = await fetch("/api/demo/heal", { method: "DELETE" });
      const data = (await response.json()) as {
        reset?: boolean;
        forecast?: ApiForecastResponse;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not reset demo");

      setGhostTimeline(undefined);
      setCallStates({});
      setMessageStates({});
      setAwaitingPayment(false);
      setHealing(false);

      if (data.forecast) {
        setApiForecast(data.forecast);
        setForecast(enrichForecast(data.forecast));
        setLastUpdated(new Date());
      } else {
        await loadForecast(true);
      }

      showToast("Demo reset", "Gap restored — ready to run the beat again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset demo.");
    }
  };

  const orgName = forecast?.orgName ?? "Squeeze";
  const isLive = forecast?.source === "xero";

  return (
    <div className="min-h-screen text-foreground">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <SqueezeLogo className="size-7" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Squeeze</div>
              <div className="text-[10px] text-muted-foreground">AI Credit Controller</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-2">
            {NAV.map((n) => {
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setView(n.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm transition",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                  )}
                >
                  <n.icon className={cn("size-4", active && "text-primary")} />
                  {n.label}
                  {n.badge && !healed && forecast && forecast.actions.some((a) => a.accent === "danger") && (
                    <span className="ml-auto flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-danger-foreground">
                      1
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-sidebar-border p-3">
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Sparkles className="size-4" />
              Ask Copilot
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="flex items-center gap-3">
                <SqueezeLogo className="size-6 lg:hidden" />
                <div>
                  <h1 className="text-sm font-semibold md:text-base">{orgName}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium",
                        isLive
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-warning/30 bg-warning/10 text-warning",
                      )}
                    >
                      <Wifi className="size-2.5" />
                      {isLive ? "Live Xero" : "Demo data"}
                    </span>
                    {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString("en-GB")}</span>}
                    {sseConnected && isLive && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <span className="size-1.5 rounded-full bg-success animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />
                {healed ? (
                  <button
                    type="button"
                    onClick={() => void resetDemo()}
                    className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
                  >
                    <RefreshCw className="size-3.5" /> Replay demo
                  </button>
                ) : (
                  !healing && (
                    <button
                      type="button"
                      onClick={() => void recordPayment()}
                      disabled={healing || loading || xeroConnected !== true}
                      className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50 sm:inline-flex"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {awaitingPayment ? "Waiting for webhook…" : "Record payment in Xero"}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => void loadForecast(true)}
                  disabled={loading || refreshing}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                  <span className="hidden sm:inline">{refreshing ? "Refreshing" : "Refresh"}</span>
                </button>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setView(n.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
                    view === n.id ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <n.icon className="size-3.5" />
                  {n.label}
                </button>
              ))}
            </div>
          </header>

          {xeroConnected === false && (
            <div className="mx-4 mt-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 md:mx-6">
              <p className="text-sm font-medium text-primary">Connect Xero for live data</p>
              <a href="/api/xero/connect" className="mt-2 inline-block text-xs underline">
                Connect now
              </a>
            </div>
          )}

          <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
            {loading || !forecast ? (
              <LoadingState />
            ) : (
              <>
                {view === "today" && (
                  <TodayView
                    forecast={forecast}
                    healed={healed}
                    ghostTimeline={ghostTimeline}
                    onGoToCustomers={() => setView("customers")}
                  />
                )}
                {view === "plan" && forecast && (
                  <ScenariosView forecast={forecast} healed={healed} />
                )}
                {view === "customers" && (
                  <ActionsView
                    forecast={forecast}
                    onApproveCall={approveCall}
                    callStates={callStates}
                    onSendMessage={sendWhatsApp}
                    messageStates={messageStates}
                  />
                )}
                {view === "briefing" && forecast && (
                  <BriefingPage forecast={forecast} healed={healed} />
                )}
              </>
            )}
            {error && <p className="mt-4 text-center text-xs text-danger">{error}</p>}
          </main>
        </div>
      </div>

      <Copilot
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        forecastContext={apiForecast}
      />

      <div
        className={cn(
          "fixed bottom-5 left-1/2 z-50 -translate-x-1/2 transition-all duration-500",
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-success/40 bg-card px-5 py-3 shadow-2xl">
          <span className="flex size-9 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">{toast?.title ?? "Done"}</div>
            <div className="text-xs text-muted-foreground">{toast?.detail ?? ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <SqueezeLogo className="size-12 animate-pulse" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Reading your Xero data…
      </div>
    </div>
  );
}
