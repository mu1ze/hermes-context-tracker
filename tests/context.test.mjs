import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
const base = fileURLToPath(new URL("../", import.meta.url));
const screenshots = path.join(base, "screenshots");
await mkdir(screenshots, { recursive: true });
const source = await readFile(`${base}/plugin.js`, "utf8").catch(() => null);
assert.ok(
  source,
  "Context tracker plugin must exist and contribute a top-left context ring",
);
const result = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import plugin from ${JSON.stringify(path.join(base, "plugin.js"))};window.mount=()=>{const ctx={register:c=>{window.contribution=c;createRoot(document.getElementById('toolbar')).render(React.createElement(QueryClientProvider,{client:new QueryClient()},c.render()));},onDispose:()=>{}};plugin.register(ctx);};`,
    resolveDir: base,
  },
  bundle: true,
  write: false,
  format: "iife",
  plugins: [
    {
      name: "sdk-fixture",
      setup(b) {
        b.onResolve({ filter: /^@hermes\/plugin-sdk$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `import React from 'react';import {Popover as P} from 'radix-ui';export const Popover=P.Root;export const PopoverTrigger=P.Trigger;export const PopoverContent=({children,...props})=>React.createElement(P.Portal,null,React.createElement(P.Content,props,children));export const Button=props=>React.createElement('button',props);export {useQuery,useQueryClient} from '@tanstack/react-query';export const host=window.host;export const TITLEBAR_AREAS={left:'titleBar.left'};export const useValue=a=>React.useSyncExternalStore(a.subscribe,a.get);export function Tip({label,children,className}){const [open,setOpen]=React.useState(false);if(!label)return children;return React.createElement('div',{onMouseEnter:()=>setOpen(true),onMouseLeave:()=>setOpen(false),onFocus:()=>setOpen(true),onKeyDown:e=>e.key==='Escape'&&setOpen(false)},children,open&&React.createElement('div',{role:'tooltip',className:'tooltip-bubble '+(className||''),style:{position:'absolute',top:80,padding:12}},label,React.createElement('svg',{'data-slot':'tooltip-arrow',width:10,height:5},React.createElement('path',{d:'M0 0h10L5 5Z'}))));}`,
          resolveDir: base,
        }));
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 650 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(
    `<style>.tooltip-bubble{background:var(--ui-text-primary);color:var(--ui-bg-elevated)}.tooltip-bubble [data-slot="tooltip-arrow"]{fill:var(--ui-text-primary)}:root{--ui-text-primary:#e4e1db;--ui-text-secondary:#bdb9b1;--ui-stroke-secondary:#55514b;--ui-bg-elevated:#302d29;--ui-accent:#d0ac78;--ui-control-hover-background:#403b35}body{font:12px system-ui;background:#24221f;color:var(--ui-text-primary)}#toolbar{display:flex}</style><p>Context tracker · synthetic test fixture</p><div id="toolbar"></div>`,
  );
  await page.evaluate(() => {
    window.values = {
      id: "session-a",
      usage: {
        context_used: 25000,
        context_max: 100000,
        input: 90000,
        output: 5000,
        compressions: 2,
      },
      busy: false,
      profile: "default",
      gateway: "open",
    };
    window.listeners = new Set();
    const atom = (k) => ({
      get: () => window.values[k],
      subscribe: (fn) => {
        window.listeners.add(fn);
        return () => window.listeners.delete(fn);
      },
    });
    window.update = (v) => {
      Object.assign(window.values, v);
      window.listeners.forEach((fn) => fn());
    };
    window.host = {
      activeConnectionId: () => window.values.connection || "fixture",
      state: {
        connectionId: atom("connection"),
        focusedSessionId: atom("id"),
        focusedUsage: atom("usage"),
        busy: atom("busy"),
        focusedSessionProfile: atom("profile"),
        gateway: atom("gateway"),
      },
      request: async (method, args) => {
        window.lastRequest = { method, args };
        return {
          model: "Fixture model",
          context_used: 25000,
          context_max: 100000,
          context_percent: 25,
          context_estimated: false,
          categories: [
            { id: "system", label: "System prompt", tokens: 4000 },
            { id: "messages", label: "Conversation", tokens: 21000 },
          ],
        };
      },
    };
  });
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.evaluate(() => window.mount());
  const ring = page.locator("[data-context-tracker]");
  await ring.waitFor();
  assert.equal(
    await page.evaluate(() => window.contribution.area),
    "titleBar.left",
  );
  await ring.hover();
  await page
    .getByRole("tooltip")
    .getByText("25,000", { exact: true })
    .waitFor();
  assert.match(await page.getByRole("tooltip").innerText(), /100,000/);
  assert.match(await page.getByRole("tooltip").innerText(), /75,000/);
  assert.match(await page.getByRole("tooltip").innerText(), /System prompt/);
  assert.equal(
    await page.evaluate(() => window.lastRequest.method),
    "session.context_breakdown",
  );
  assert.equal(
    await ring.locator('[role="meter"]').getAttribute("aria-valuenow"),
    "25",
  );
  await page.evaluate(() =>
    window.update({
      busy: true,
      usage: {
        context_used: 60000,
        context_max: 100000,
        context_estimated: true,
      },
    }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('[role="meter"]').getAttribute("aria-valuenow") ===
      "60",
  );
  assert.match(await page.getByRole("tooltip").innerText(), /Estimated/);
  await page.evaluate(() => window.update({ id: "session-b", usage: null }));
  await page.waitForFunction(
    () =>
      !document.querySelector('[role="meter"]').hasAttribute("aria-valuenow"),
  );
  assert.match(
    await page.getByRole("tooltip").innerText(),
    /unavailable|Waiting/i,
  );
  await page.evaluate(() =>
    window.update({ usage: { context_used: 120000, context_max: 100000 } }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('[role="meter"]').getAttribute("aria-valuenow") ===
      "100",
  );
  await page.evaluate(() =>
    window.update({ usage: { context_used: 0, context_max: 100000 } }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('[role="meter"]').getAttribute("aria-valuenow") ===
      "0",
  );
  await page.evaluate(() =>
    window.update({
      id: "session-a",
      busy: false,
      usage: { context_used: 25000, context_max: 100000, compressions: 2 },
    }),
  );
  await page
    .getByRole("tooltip")
    .getByText("25,000", { exact: true })
    .waitFor();
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.evaluate(() => {
        document.documentElement.style.cssText =
          "--ui-text-primary:#25231f;--ui-text-secondary:#56524b;--ui-bg-elevated:#fbfaf8;--ui-stroke-secondary:#c4bfb6;--ui-accent:#80603b";
        document.body.style.background = "#f1eee8";
      });
    const contrast = await page.evaluate(() => {
      const tip = document.querySelector('[role="tooltip"]'),
        bg = getComputedStyle(tip).backgroundColor;
      const c = document.createElement("canvas").getContext("2d");
      const rgba = (s) => {
        c.clearRect(0, 0, 1, 1);
        c.fillStyle = s;
        c.fillRect(0, 0, 1, 1);
        return [...c.getImageData(0, 0, 1, 1).data];
      };
      const expected = getComputedStyle(
        document.documentElement,
      ).getPropertyValue("--ui-bg-elevated");
      if (rgba(bg).join() !== rgba(expected).join())
        throw Error(
          "Tooltip must use the live elevated app surface, not inverted foreground",
        );
      if (rgba(bg)[3] !== 255) throw Error("Tooltip must be opaque");
      if (
        rgba(
          getComputedStyle(tip.querySelector('[data-slot="tooltip-arrow"]'))
            .fill,
        ).join() !== rgba(bg).join()
      )
        throw Error("Arrow must match tooltip surface");
      const lum = (rgb) =>
        rgb
          .slice(0, 3)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratios = [
        ...tip.querySelectorAll(
          ".ctx-ring-label,.ctx-ring-value,.ctx-ring-footnote,.ctx-ring-model,strong",
        ),
      ].map((n) => {
        const fg = rgba(getComputedStyle(n).color),
          base = rgba(bg),
          composed = fg.map((v, i) =>
            i < 3 ? (v * fg[3]) / 255 + base[i] * (1 - fg[3] / 255) : 255,
          ),
          a = lum(composed),
          b = lum(base);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      const min = Math.min(...ratios);
      if (min < 4.5) throw Error("Tooltip text contrast below 4.5:1: " + min);
      return min;
    });
    console.log(
      theme + " tooltip minimum contrast: " + contrast.toFixed(2) + ":1",
    );
    assert.equal(
      await ring.evaluate((e) => e.getBoundingClientRect().width),
      28,
    );
    await page.screenshot({
      path: path.join(screenshots, `context-tracker-${theme}.png`),
    });
    await ring.click();
    const pinnedPanel = page.getByRole("dialog", { name: "Context details" });
    await pinnedPanel.waitFor();
    const surface = await pinnedPanel.evaluate((e) => ({
      bg: getComputedStyle(e).backgroundColor,
      expected: getComputedStyle(document.documentElement)
        .getPropertyValue("--ui-bg-elevated")
        .trim(),
      color: getComputedStyle(e).color,
    }));
    assert.ok(surface.bg && surface.color);
    await page.screenshot({
      path: path.join(screenshots, `context-tracker-pinned-${theme}.png`),
    });
    await page.keyboard.press("Escape");
    await pinnedPanel.waitFor({ state: "hidden" });
    await ring.hover();
    await page.getByRole("tooltip").waitFor();
  }
  // Clicking pins an interactive dialog; leaving the trigger must not dismiss it.
  await ring.click();
  const details = page.getByRole("dialog", { name: "Context details" });
  await details.waitFor({ timeout: 2000 });
  await page.mouse.move(700, 600);
  assert.equal(await details.isVisible(), true);
  assert.equal(await page.getByRole("tooltip").count(), 0);
  await page.keyboard.press("Escape");
  await details.waitFor({ state: "hidden" });
  await ring.click();
  await details.waitFor();
  await page.locator("body").click({ position: { x: 700, y: 600 } });
  await details.waitFor({ state: "hidden" });
  console.log(
    "PASS: click pins, pointer-leave persists, Escape/outside click dismiss",
  );
  // Compaction is an explicit click, scoped to the focused session and owner.
  await ring.click();
  await details.waitFor();
  const compact = details.getByRole("button", {
    name: "Compact session",
    exact: true,
  });
  await compact.waitFor({ timeout: 2000 });
  await page.evaluate(() => {
    window.compressRequests = [];
    const original = window.host.request;
    window.host.request = async (method, args, timeout) => {
      if (method !== "session.compress") return original(method, args);
      window.compressRequests.push({ args, timeout });
      return new Promise((resolve, reject) => {
        window.completeCompress = resolve;
        window.failCompress = () =>
          reject(new Error("Gateway refused compaction"));
      });
    };
  });
  await page.evaluate(() => window.update({ busy: true }));
  assert.equal(await compact.isDisabled(), true);
  await page.evaluate(() => window.update({ busy: false }));
  await compact.click();
  await page.waitForFunction(() => window.compressRequests.length === 1);
  assert.deepEqual(await page.evaluate(() => window.compressRequests[0]), {
    args: { session_id: "session-a", profile: "default" },
    timeout: 660000,
  });
  assert.equal(
    await details.getByRole("button", { name: "Compacting…" }).isDisabled(),
    true,
  );
  await page.evaluate(() => {
    window.compacted = true;
    window.completeCompress({
      status: "ok",
      summary: { headline: "Compacted context" },
    });
  });
  await details
    .getByRole("status")
    .getByText("Compacted context", { exact: true })
    .waitFor();
  assert.equal(await compact.isDisabled(), false);
  await compact.click();
  await page.evaluate(() => window.failCompress());
  await details
    .getByRole("alert")
    .getByText(/Gateway refused compaction/)
    .waitFor();
  await compact.click();
  await page.evaluate(() => window.completeCompress({ status: "pending" }));
  await details
    .getByRole("status")
    .getByText(/still running/i)
    .waitFor();
  assert.equal(
    await details.getByRole("button", { name: "Compacting…" }).isDisabled(),
    true,
  );
  await page.evaluate(() =>
    window.update({
      usage: { context_used: 10000, context_max: 100000, compressions: 3 },
    }),
  );
  await details
    .getByRole("status")
    .getByText("Session compacted.", { exact: true })
    .waitFor();
  await page.evaluate(() =>
    window.update({ id: "session-b", profile: "other" }),
  );
  await details.waitFor({ state: "hidden" });
  await ring.click();
  await details.waitFor();
  await details
    .getByRole("button", { name: "Compact session", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(() => window.compressRequests.at(-1).args),
    { session_id: "session-b", profile: "other" },
  );
  await page.evaluate(() => window.update({ id: "session-c" }));
  await details.waitFor({ state: "hidden" });
  await page.evaluate(() =>
    window.completeCompress({
      status: "ok",
      summary: { headline: "Late result for B" },
    }),
  );
  await ring.click();
  await details.waitFor();
  assert.doesNotMatch(await details.innerText(), /Late result for B/);
  console.log(
    "PASS: busy guard, scoped compaction RPC, progress, success, error, pending, completion and late-result isolation",
  );
  await ring.click();
  await details.waitFor({ state: "hidden" });
  await ring.focus();
  await page.keyboard.press("Enter");
  await details.waitFor();
  await page.keyboard.press("Escape");
  await details.waitFor({ state: "hidden" });
  await ring.click();
  await details.waitFor();
  await page.evaluate(() => window.update({ gateway: "closed" }));
  assert.equal(await compact.isDisabled(), true);
  await page.evaluate(() => window.update({ gateway: "open", id: null }));
  await details.waitFor({ state: "hidden" });
  await ring.click();
  await details.waitFor();
  assert.equal(await compact.isDisabled(), true);
  await page.evaluate(() => window.update({ id: "session-a" }));
  await details.waitFor({ state: "hidden" });
  await ring.click();
  await details.waitFor();
  await compact.click();
  await page.evaluate(() =>
    window.completeCompress({ summary: { noop: true } }),
  );
  await details
    .getByRole("status")
    .getByText("No compaction needed.", { exact: true })
    .waitFor();
  await compact.click();
  await page.evaluate(() =>
    window.completeCompress({
      summary: { aborted: true, note: "Insufficient context." },
    }),
  );
  await details
    .getByRole("alert")
    .getByText("Insufficient context.", { exact: true })
    .waitFor();
  await page.evaluate(() =>
    window.update({ id: "session-c", connection: "another-host" }),
  );
  await details.waitFor({ state: "hidden" });
  await ring.click();
  await details.waitFor();
  await compact.click();
  await page.evaluate(() => window.completeCompress({}));
  await details
    .getByRole("alert")
    .getByText(/did not confirm/)
    .waitFor();
  await page.evaluate(() => window.update({ connection: "third-host" }));
  await details.waitFor({ state: "hidden" });
  console.log(
    "PASS: toggle/keyboard, offline/no-session guards, no-op, aborted, unconfirmed result and connection isolation",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: top-left contribution, focused-session RPC, ring occupancy, full hover details, live updates, estimates, session isolation, unknown, zero, over-capacity, dark/light rendering.",
  );
} finally {
  await browser.close();
}
