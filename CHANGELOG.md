# Changelog

## 0.1.1

- Rename the extension to `slack-unslop`.
- Bundle content-script helpers privately to fix a missing-helper startup crash.
- Add readiness synchronization so early lookup requests can be retried.
- Show page connection and profile lookup status in the popup.
- Add a startup regression test and synthetic browser checks.

## 0.1.0

- Initial local prototype with automatic profile lookup for authors and read mentions.
- Per-workspace local name storage, display toggle, manual overrides and optional JSON import.
