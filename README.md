# Hermes Context Tracker

A small context-window ring in the **top-left toolbar of Hermes Desktop**. Hover or focus it for a preview; **click to pin** an interactive context panel. Its tooltip follows your app theme, including custom theme colors.

![Dark theme — synthetic test data](screenshots/context-tracker-dark.png)
![Light theme — synthetic test data](screenshots/context-tracker-light.png)

The screenshots are browser fixtures with synthetic values, not account usage.

## Features

- Click-to-pin details remain open until you click the ring again, click outside, press Escape or switch session/connection.
- **Compact session** summarizes the focused conversation through Hermes’ native compaction RPC, with progress and error feedback.
- Ring fills with `context_used / context_max`, not cumulative session input/output.
- Follows the focused conversation, including tiled chats.
- Streams occupancy during turns and refreshes the detailed breakdown when idle.
- Shows used/max tokens, remaining capacity, model, estimated category breakdown, compressions and session totals when reported.
- Distinguishes estimates, a real zero and unavailable data (`?`).
- Uses Hermes theme tokens for the ring, tooltip, arrow, borders and text.
- Supports keyboard focus and accessible meter labels.
- No Python backend, credentials, external account calls or production dependencies.

## Requirements

Hermes **Desktop**, not the web dashboard or CLI alone. This release needs the Desktop SDK's `TITLEBAR_AREAS.left`, `Tip`, `Popover`/`PopoverTrigger`/`PopoverContent`, `Button`, React Query and focused-session atoms, plus a gateway exposing `session.context_breakdown`. Compatibility is API-based; no minimum app version has been established. Older gateways can still show streamed occupancy when it is available, but may lack a breakdown.

## Install from a release ZIP

1. Extract the ZIP.
2. Create `$HERMES_HOME/desktop-plugins/context-tracker/` (normally `~/.hermes/desktop-plugins/context-tracker/`).
3. Copy **only `plugin.js`** into that folder.
4. Hermes hot-loads the plugin. If needed, use the command palette's **Reload desktop plugins** command.

The folder must be named `context-tracker`, matching the plugin's ID. Desktop plugins are app-level; you do not need a separate copy for every connected profile or remote gateway. Do not copy `node_modules`, tests or package metadata to install it. Node/npm are needed only for development, not installation.

### Install from Git

Open **Capabilities → Plugins → Install from Git**, paste this repository URL and select the **Desktop** target:

```text
https://github.com/mu1ze/hermes-context-tracker
```

No agent/backend installation is required. Enable **Context tracker** if it is off after installing.

Install link for websites and supported URL handlers:

```text
hermes://plugin/install?repo=mu1ze/hermes-context-tracker&enable=1
```

A link does not bypass the app's installation confirmation.

### Update or uninstall

For manual installations, replace `plugin.js` with the new release; saves hot-reload. For Git installations, use the app's update/rescan controls. Disable it in **Capabilities → Plugins**; remove the `context-tracker` folder to uninstall a manual copy. Avoid installing both a manual and Git-managed copy with the same ID.

## Manual compaction

Click the ring to pin the details panel, then choose **Compact session**. The action applies to that focused session and its owning profile, not every open chat. It summarizes older context and may consume model tokens; it is not merely a visual refresh and has no undo control in this plugin.

The button is disabled during a turn, while disconnected, without a selected session or while its compaction request is pending. It uses the native `session.compress` RPC with Desktop’s 660-second deadline and does not automatically retry mutations. Confirmed completion refreshes the context breakdown. No-op, aborted and failed operations have separate messages.

If the gateway reports `pending`, the panel says it is still running rather than claiming success. The button remains disabled until the session’s reported compression counter advances. A timeout/disconnection can also leave the outcome uncertain; check the session rather than submitting a duplicate. This state is in-memory; reloading the plugin clears it, so do not reload merely to retry an operation that may still be running. Older gateways may not report the completion counter.

## What the numbers mean

The ring measures current context occupancy. Session input/output are cumulative accounting totals and are shown separately, never added to the ring. A provider-reported prompt count and an estimated category breakdown are different measurements; estimate labels preserve that distinction. Capacity and counts come from Hermes, not an independently queried provider catalog.

During a turn, the tooltip can show live occupancy without categories. Categories refresh after the turn. If the gateway is disconnected or has not reported context, the ring shows `?` rather than pretending the window is empty. Percent fill is visually capped at 100%; raw token counts are not hidden.

## Privacy and trust

This plugin reads focused-session state and calls the existing gateway RPC `session.context_breakdown`. It does not fetch external URLs, read credentials or persist conversation contents. It mutates a session only when you explicitly click **Compact session**, using the native `session.compress` RPC. The tooltip displays token metadata, not the text of your system prompt or messages.

Hermes Desktop plugins execute with app authority: review source code before installing any plugin. This plugin's lack of a backend is not a sandbox/security guarantee. See the [official SDK security model](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk#security-model).

## Develop and test

Node.js 22+ and npm:

```sh
npm ci
npx playwright install chromium
npm test
```

On Linux CI, use `npx playwright install --with-deps chromium`.

Tests bundle the real plugin with React, React Query, real Radix popover primitives and a small SDK adapter. They cover placement, the context RPC, hover details, live updates, estimate labels, session isolation, unknown/zero/over-capacity values, and dynamic dark/light theme contrast (at least 4.5:1 for small text). They also cover click-to-pin/dismissal, keyboard operation, busy/offline/no-session guards, exact session/profile routing, compaction progress, successful/no-op/aborted/failed/pending results, unconfirmed replies and cross-session/connection isolation. Compaction requests are synthetic test fixtures; tests never compact a live conversation. Screenshots are regenerated in `screenshots/`. The SDK tooltip fixture explicitly reproduces native inverted defaults so incorrect theme overrides fail the test.

These tests do not boot Electron or prove compatibility with every Desktop release. Smoke-test the actual app when upgrading SDK dependencies.

No build step is needed for `plugin.js`. Its only runtime imports are the app-provided SDK and React JSX runtime. `package.json` is private to prevent accidental npm publication; the distributable is the plugin source, not an npm runtime package.

```sh
npm run pack
```

This creates an npm-format tarball containing the plugin, README, license and screenshots. A release ZIP can distribute the same source with the tests and lockfile for reproducibility.

## License

MIT. Independent community plugin; not an official Nous Research release.
