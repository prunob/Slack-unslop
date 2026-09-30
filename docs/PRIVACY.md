# Privacy and permissions

slack-unslop changes labels locally in Slack web. It does not edit Slack profiles, send messages, change mention recipients, or change how names appear for other members.

## Data stored locally

Chrome's `storage.local` stores:

- Workspace and member IDs.
- Full profile names and display aliases.
- Manual name overrides and the display-enabled preference.

These values are not synced by this extension. Real directories are never part of the source repository or distribution ZIP. Uninstalling the extension removes its local storage.

## Session authentication

The page script observes authentication already present in Slack API requests or available startup data. It keeps the session token only in the page script's memory and uses it for same-origin `/api/users.info` requests. Normal browser-managed cookies accompany those requests; the extension does not read cookies directly.

The token is not saved, logged or passed to the isolated content script, popup or service worker. Page-to-extension messages carry extracted name records and short diagnostic states. Member IDs sent to the page script are validated before lookup. The page can interfere with a MAIN-world script, so this is a convenience extension for a trusted Slack page, not a security boundary against that page.

## Network traffic

Profile lookup requests go only to the current Slack page's origin. There is no analytics, telemetry, remote code, advertising or third-party profile service. Existing Slack profile responses are observed to avoid unnecessary lookup requests. Queued requests are spaced and honor Slack rate-limit responses.

## Permissions

- `storage`: keep names and preferences locally.
- `activeTab`: identify the active workspace and read extension status when the popup opens.
- Content scripts match `https://app.slack.com/*` and `https://*.slack.com/*`.

No cookie, browsing-history or additional cross-origin network permission is requested.

## Public documentation and reports

Examples and test profiles are fictional. Documentation does not include a real workspace, real member IDs, local user paths, session credentials, private messages or company-specific screenshots. Bug reports should contain the extension version and short diagnostic state rather than private Slack data.
