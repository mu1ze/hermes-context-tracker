import {
  host,
  useValue,
  useQuery,
  useQueryClient,
  Tip,
  TITLEBAR_AREAS,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from "@hermes/plugin-sdk";
import { useState, useRef, useEffect } from "react";
import { jsx } from "react/jsx-runtime";

const fallbackConnection = {
  get: () => host.activeConnectionId?.() || "local",
  subscribe: () => () => {},
};
const finite = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const number = (value) =>
  finite(value) ? Math.round(value).toLocaleString() : "—";
const row = (label, value, key = label) =>
  jsx(
    "div",
    {
      className: "ctx-ring-row",
      children: [
        jsx("span", { className: "ctx-ring-label", children: label }),
        jsx("span", { className: "ctx-ring-value", children: value }),
      ],
    },
    key,
  );

function ContextTracker() {
  const session = useValue(host.state.focusedSessionId);
  const usage = useValue(host.state.focusedUsage);
  const busy = useValue(host.state.busy);
  const profile = useValue(host.state.focusedSessionProfile);
  const gateway = useValue(host.state.gateway);
  const connection =
    useValue(host.state.connectionId || fallbackConnection) ||
    host.activeConnectionId?.() ||
    "local";
  const scope = JSON.stringify([connection, profile, session]);
  const [pinnedScope, setPinnedScope] = useState(null);
  const pinned = pinnedScope === scope;
  const query = useQuery({
    queryKey: [
      "context-tracker",
      connection,
      profile,
      session,
      busy,
      usage?.compressions,
      usage?.calls,
    ],
    enabled: Boolean(session) && !busy && gateway === "open",
    queryFn: async () => {
      const result = await host.request("session.context_breakdown", {
        session_id: session,
      });
      if (
        !result ||
        !finite(result.context_max) ||
        result.context_max === 0 ||
        !finite(result.context_used)
      )
        throw new Error("Context unavailable");
      return result;
    },
    staleTime: 0,
    gcTime: 60000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    refetchOnWindowFocus: true,
  });
  const queryClient = useQueryClient();
  const jobs = useRef(new Map());
  const [, redraw] = useState(0);
  const writeJob = (key, value) => {
    jobs.current.set(key, value);
    redraw((n) => n + 1);
  };
  const job = jobs.current.get(scope);
  const compacting = ["working", "pending", "uncertain"].includes(job?.state);
  useEffect(() => {
    setPinnedScope(null);
  }, [scope]);
  useEffect(() => {
    if (
      ["pending", "uncertain"].includes(job?.state) &&
      finite(usage?.compressions) &&
      usage.compressions > job.baseline
    ) {
      writeJob(scope, { state: "success", message: "Session compacted." });
      void queryClient.invalidateQueries({
        queryKey: ["context-tracker", connection, profile, session],
      });
    }
  }, [scope, usage?.compressions, job?.state]);
  const compact = async () => {
    // Re-read the live scope at the gesture; never mutate a stale render's session.
    const liveSession = host.state.focusedSessionId.get();
    const liveProfile = host.state.focusedSessionProfile.get();
    const liveConnection = host.activeConnectionId?.() || "local";
    if (
      !liveSession ||
      JSON.stringify([liveConnection, liveProfile, liveSession]) !== scope ||
      host.state.busy.get() ||
      host.state.gateway.get() !== "open" ||
      ["working", "pending", "uncertain"].includes(
        jobs.current.get(scope)?.state,
      )
    )
      return;
    const baseline = host.state.focusedUsage.get()?.compressions || 0;
    writeJob(scope, {
      state: "working",
      baseline,
      message: "Compacting this session…",
    });
    try {
      // Match Desktop's native /compress deadline; do not retry a mutation.
      const result = await host.request(
        "session.compress",
        { session_id: liveSession, profile: liveProfile },
        660000,
      );
      if (
        !result ||
        result.error ||
        ["error", "failed", "rejected"].includes(result.status) ||
        (!result.summary &&
          !result.usage &&
          !result.info &&
          !Array.isArray(result.messages) &&
          !["ok", "completed", "compacted", "pending"].includes(result.status))
      )
        throw new Error(
          result?.message || "Gateway did not confirm compaction.",
        );
      if (result.status === "pending") {
        writeJob(scope, {
          state: "pending",
          baseline,
          message:
            "Compaction is still running on the gateway. Waiting for updated session usage.",
        });
      } else if (result.summary?.aborted) {
        writeJob(scope, {
          state: "error",
          message:
            result.summary.note ||
            "Compaction was aborted; the session was not compacted.",
        });
      } else {
        writeJob(scope, {
          state: "success",
          message:
            result.summary?.headline ||
            (result.summary?.noop
              ? "No compaction needed."
              : "Session compacted."),
        });
        void queryClient.invalidateQueries({
          queryKey: ["context-tracker", connection, profile, session],
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Compaction failed.";
      const uncertain =
        /timeout|timed out|deadline|disconnect|socket|connection.*closed/i.test(
          message,
        );
      writeJob(scope, {
        state: uncertain ? "uncertain" : "error",
        baseline,
        message: uncertain
          ? "Compaction could still be running after the connection or deadline ended. Check the session before retrying; no automatic retry was sent."
          : `Compaction failed: ${message}`,
      });
    }
  };
  // Never use an idle snapshot during a turn or after a gateway disconnect.
  // Streamed occupancy is the current prompt, NOT cumulative input/output.
  const detail =
    !busy && gateway === "open" && !query.isFetching && !query.isError
      ? query.data
      : null;
  const source = gateway === "open" ? detail || usage : null;
  const known =
    Boolean(session) &&
    finite(source?.context_used) &&
    finite(source?.context_max) &&
    source.context_max > 0;
  const used = known ? source.context_used : null;
  const max = known ? source.context_max : null;
  const percent = known ? Math.min(100, Math.max(0, (used / max) * 100)) : null;
  const estimated = Boolean(source?.context_estimated);
  const categories = Array.isArray(detail?.categories)
    ? detail.categories.filter((c) => finite(c.tokens))
    : [];
  const summary = known
    ? `${estimated ? "Estimated " : ""}context: ${percent.toFixed(1)}% · ${number(used)} / ${number(max)} tokens`
    : "Context usage unavailable";
  const panel = jsx("div", {
    className: "ctx-ring-info",
    children: [
      jsx("div", {
        className: "ctx-ring-heading",
        children: [
          jsx("strong", { children: "Context window" }),
          jsx("span", {
            className: "ctx-ring-value",
            children: known
              ? `${estimated ? "~" : ""}${percent.toFixed(1)}% full`
              : "—",
          }),
        ],
      }),
      detail?.model &&
        jsx("div", { className: "ctx-ring-model", children: detail.model }),
      known
        ? jsx("div", {
            className: "ctx-ring-section",
            children: [
              row("Used tokens", number(used)),
              row("Window size", number(max)),
              row("Remaining", `${number(Math.max(0, max - used))} tokens`),
              row("Measurement", estimated ? "Estimated" : "Provider-reported"),
            ],
          })
        : jsx("p", {
            className: "ctx-ring-label",
            children: session
              ? "Waiting for context usage. Data unavailable until the gateway reports it."
              : "Select a conversation to see its context usage.",
          }),
      categories.length > 0 &&
        jsx("div", {
          className: "ctx-ring-section",
          children: [
            jsx("div", {
              className: "ctx-ring-label ctx-ring-caption",
              children: "Context breakdown · estimated tokens",
            }),
            ...categories.map((c) =>
              row(c.label || c.id, `~${number(c.tokens)}`, c.id),
            ),
          ],
        }),
      !categories.length &&
        known &&
        jsx("div", {
          className: "ctx-ring-footnote",
          children: busy
            ? "Live occupancy · breakdown refreshes after this turn."
            : query.isError
              ? "Detailed breakdown unavailable."
              : "Loading context breakdown…",
        }),
      usage &&
        jsx("div", {
          className: "ctx-ring-section",
          children: [
            finite(usage.compressions) &&
              row("Compressions", number(usage.compressions)),
            finite(usage.calls) && row("API calls", number(usage.calls)),
            finite(usage.input) && row("Session input", number(usage.input)),
            finite(usage.output) && row("Session output", number(usage.output)),
            jsx("div", {
              className: "ctx-ring-footnote",
              children: "Session totals are cumulative, not window occupancy.",
            }),
          ],
        }),
      source?.context_source &&
        jsx("div", {
          className: "ctx-ring-footnote",
          children: `Source: ${String(source.context_source).replaceAll("_", " ")}`,
        }),
    ],
  });
  const trigger = jsx("button", {
    type: "button",
    "data-context-tracker": "",
    className: "ctx-ring-trigger",
    "aria-label": summary,
    children: jsx("svg", {
      width: 18,
      height: 18,
      viewBox: "0 0 20 20",
      role: "meter",
      "aria-label": "Context window used",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      ...(known ? { "aria-valuenow": Number(percent.toFixed(2)) } : {}),
      "aria-valuetext": summary,
      children: [
        jsx("circle", {
          cx: 10,
          cy: 10,
          r: 7.5,
          fill: "none",
          stroke: "var(--ui-stroke-secondary)",
          strokeWidth: 2.5,
        }),
        known &&
          jsx("circle", {
            cx: 10,
            cy: 10,
            r: 7.5,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2.5,
            pathLength: 100,
            strokeDasharray: `${percent} 100`,
            strokeLinecap: "butt",
            transform: "rotate(-90 10 10)",
          }),
        !known &&
          jsx("text", {
            x: 10,
            y: 13,
            textAnchor: "middle",
            fill: "currentColor",
            fontSize: 9,
            children: "?",
          }),
      ],
    }),
  });
  return jsx(Popover, {
    open: pinned,
    onOpenChange: (open) => setPinnedScope(open ? scope : null),
    children: [
      jsx(Tip, {
        className: "ctx-ring-tooltip",
        label: pinned ? null : panel,
        side: "bottom",
        align: "start",
        sideOffset: 8,
        delayDuration: 200,
        children: jsx(PopoverTrigger, { asChild: true, children: trigger }),
      }),
      jsx(PopoverContent, {
        className: "ctx-ring-popover",
        "aria-label": "Context details",
        side: "bottom",
        align: "start",
        sideOffset: 8,
        children: [
          panel,
          jsx("div", {
            className: "ctx-ring-actions",
            children: [
              jsx("div", {
                className: "ctx-ring-footnote",
                children:
                  "Summarizes older context in this session. This may use model tokens.",
              }),
              jsx(Button, {
                type: "button",
                size: "sm",
                variant: "outline",
                className: "ctx-ring-compact",
                disabled: !session || busy || gateway !== "open" || compacting,
                onClick: compact,
                children: compacting ? "Compacting…" : "Compact session",
              }),
              busy &&
                jsx("div", {
                  className: "ctx-ring-footnote",
                  children:
                    "Wait for the current turn to finish before compacting.",
                }),
              job &&
                jsx("div", {
                  role:
                    job.state === "error" || job.state === "uncertain"
                      ? "alert"
                      : "status",
                  className: "ctx-ring-feedback",
                  children: job.message,
                }),
            ],
          }),
        ],
      }),
    ],
  });
}

export default {
  id: "context-tracker",
  name: "Context tracker",
  register(ctx) {
    const style = document.createElement("style");
    style.textContent = `.ctx-ring-popover{--popover-surface:var(--ui-bg-elevated);background:var(--ui-bg-elevated);color:var(--ui-text-primary);border:1px solid var(--ui-stroke-secondary);border-radius:8px;padding:12px;width:auto;max-width:calc(100vw - 24px);max-height:var(--radix-popover-content-available-height,calc(100vh - 48px));overflow-y:auto}.ctx-ring-actions{width:280px;max-width:calc(100vw - 48px);margin-top:10px;padding-top:8px;border-top:1px solid var(--ui-stroke-secondary);font-size:12px}.ctx-ring-compact{margin-top:10px;width:100%;cursor:pointer}.ctx-ring-compact:disabled{cursor:not-allowed}.ctx-ring-feedback{margin-top:8px;color:var(--ui-text-primary);overflow-wrap:anywhere}.ctx-ring-trigger[aria-expanded=true]{background:var(--ui-control-hover-background)}.tooltip-bubble.ctx-ring-tooltip{background:var(--ui-bg-elevated);color:var(--ui-text-primary);border:1px solid var(--ui-stroke-secondary);border-radius:8px;padding:12px}.tooltip-bubble.ctx-ring-tooltip [data-slot="tooltip-arrow"]{fill:var(--ui-bg-elevated)}.ctx-ring-trigger{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--ui-text-primary);cursor:default;-webkit-app-region:no-drag}.ctx-ring-trigger:hover{background:var(--ui-control-hover-background)}.ctx-ring-trigger:focus-visible{outline:2px solid var(--ui-accent);outline-offset:2px}.ctx-ring-info{width:280px;max-width:calc(100vw - 48px);font-size:12px;line-height:1.5;color:var(--ui-text-primary);text-align:left;font-weight:400}.ctx-ring-heading,.ctx-ring-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px}.ctx-ring-heading strong{font-size:12px;font-weight:600}.ctx-ring-value{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ui-text-primary)}.ctx-ring-label,.ctx-ring-model,.ctx-ring-footnote{color:var(--ui-text-secondary)}.ctx-ring-model{margin-top:4px;overflow-wrap:anywhere}.ctx-ring-section{margin-top:10px;padding-top:8px;border-top:1px solid var(--ui-stroke-secondary)}.ctx-ring-row+.ctx-ring-row{margin-top:3px}.ctx-ring-caption{margin-bottom:5px}.ctx-ring-footnote{font-size:11px;margin-top:6px}`;
    document.head.append(style);
    ctx.onDispose(() => style.remove());
    ctx.register({
      id: "ring",
      area: TITLEBAR_AREAS.left,
      order: 90,
      render: () => jsx(ContextTracker, {}),
    });
  },
};
