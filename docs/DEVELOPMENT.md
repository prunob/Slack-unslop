# Development

Use Node.js 20+ for builds and tests, plus Python 3 for ZIP packaging. No third-party packages are required.

## Layout

| Path | Purpose |
| --- | --- |
| `src/` | Editable JavaScript, popup, styles and manifest |
| `scripts/build.cjs` | Build self-contained content scripts into `extension/` |
| `scripts/package.py` | Create a deterministic ZIP in `dist/` |
| `extension/` | Built files ready to load in Chrome |
| `tests/` | Unit/startup tests and a synthetic browser fixture |
| `docs/` | Installation, privacy and development documentation |

`src/core.js` provides name validation and directory lookup helpers. The build embeds a private copy of these helpers in each content script. The page script therefore does not depend on a shared page global at startup. The popup and service worker load the helper in their own extension contexts.

`src/bridge.js` runs in MAIN at document start. It observes profile responses, reuses page-local Slack authentication and resolves queued visible member IDs. A readiness message lets the isolated content script retry requests if the bridge starts later.

`src/content.js` runs in ISOLATED. It watches Slack's changing DOM, maps labels to member IDs, preserves mention destinations and restores labels when disabled. It does not alter the composer. Name writes are serialized by `src/worker.js` across tabs and the popup, with manual corrections taking priority.

## Commands

```sh
npm run build
npm test
npm run test:browser
npm run package
```

The browser fixture server binds only to `127.0.0.1:8787`. Open:

```text
http://127.0.0.1:8787/client/TTEST00001/CTEST00001
```

The page runs assertions automatically and prints pass/fail results. Its profiles, tokens and IDs are fictitious. The fixture uses a mock extension API and a local mock Slack API, not a real Chrome extension context or authenticated Slack workspace. Stop the server with Ctrl+C.

## Validation scope

Unit tests cover profile extraction, ambiguous aliases, missing names, bots and workspace IDs. Startup tests evaluate the built scripts without the global helper and exercise readiness in a minimal simulated environment. Browser checks cover automatic labels, mention destinations, serialized storage, manual overrides, restoring names, recycled DOM nodes and workspace separation.

These checks do not prove compatibility with every live Slack workspace. Manual validation should check a current Slack page after loading the built extension and fully reloading the page. Avoid saving real credentials or private workspace data in fixtures, logs or public reports.

## Diagnostics

The popup shows the page script version and a short connection state. A DOM diagnostic attribute, `data-slack-unslop`, contains version, workspace ID, enablement, readiness, record counts and short error codes. It never contains a session token, message text or profile payload.

After changing sources, rebuild, reload the extension in `chrome://extensions`, then reload Slack. Commit updated generated files and ZIP alongside their source changes. Update the manifest, package version, visible popup version and diagnostic version together when releasing a new version.
