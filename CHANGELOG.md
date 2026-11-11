# Changelog

## 1.1.0

- Click the ring to pin an interactive details popover; keep the hover preview.
- Dismiss with another click, Escape or outside click; close on session/connection changes.
- Add an explicit focused-session Compact session action, using the native RPC.
- Disable during turns, disconnection and in-flight compaction; guard stale gestures and duplicate requests.
- Show progress, pending/uncertain outcomes, errors, no-op/aborted results and completion.
- Refresh context details after confirmed completion; isolate late results by connection/profile/session.
- Add real Radix popover interaction tests and pinned-panel screenshots.

## 1.0.0

- Initial standalone release of the top-left context occupancy ring.
- Focused-conversation live usage and idle context breakdown.
- Explicit unknown/estimate states and separate cumulative accounting.
- Theme-aware tooltip surface, arrow and text with dark/light contrast regression tests.
- Portable test harness, synthetic screenshots and CI.
