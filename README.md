# slack-unslop

A Chrome extension that displays Slack profile full names instead of nicknames in message authors and read `@mentions`. No hovering required.

For example, `@example_handle` becomes `@Alex Example`. A “full name” is the name entered in a Slack profile, not a verified identity. Changes appear only in your own browser; Slack member IDs and mention recipients stay the same.

**Version 0.1.1 · Experimental · Chrome 111+ · Manifest V3**

[Documentation en français](docs/README.fr.md) · [Privacy](docs/PRIVACY.md) · [Development](docs/DEVELOPMENT.md)

## Why it exists

Slack lets people choose display names that can be nicknames, jokes or handles. In a busy conversation, that makes it harder to recognize who is speaking or being mentioned, especially when you are new to a team. Checking each profile interrupts reading.

slack-unslop brings the full names already available in Slack profiles directly into the conversation. Open a channel or thread and read recognizable names without hovering over each person or asking teammates to change their display names.

## Install

1. [Download the extension ZIP](https://github.com/prunob/Slack-unslop/raw/refs/heads/main/dist/slack-unslop-0.1.1.zip) and extract it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the extracted `slack-unslop` folder containing `manifest.json`.
4. Reload your Slack tabs completely.

Alternatively, clone or download this repository and load the already-built `extension/` folder. No build step is needed to use it. This project is not published in the Chrome Web Store.

## How it works

- Finds member IDs in message authors and mentions as you open and navigate Slack conversations.
- Looks up full names through Slack’s `users.info` endpoint using the session already active in the page. There is no token to copy and no separate Slack app to install.
- Also learns names from profile responses and available startup data that Slack has already loaded.
- Stores member IDs, full names and display aliases locally, separately for each workspace.
- Spaces requests and respects Slack’s rate-limit responses. Previously learned names are reused immediately; new names may take a few seconds to appear.
- Offers an on/off switch, connection diagnostics, optional manual corrections and an optional JSON directory import.

The session token is used only in the Slack page’s memory for requests to Slack’s same-origin `/api/users.info`. It is not sent to an external service or saved in extension storage. See [Privacy](docs/PRIVACY.md) for details.

## Coverage and limitations

Message authors and mentions in read messages are the main targets. Some member and autocomplete labels are supported when Slack exposes matching markup. The message composer keeps Slack’s original mention labels to avoid changing editor state. Code blocks, collective mentions and bot profiles are left alone.

Slack’s web markup, startup data and session transport are internal implementation details. Automatic name lookup can fail if Slack changes them, hides member IDs, loads authentication only in a worker, or refuses profile requests. Profiles without a full name remain unchanged. Duplicate aliases are resolved only when identity is unambiguous. This affects Slack web in Chrome, not Slack’s desktop or mobile apps.

The startup crash from 0.1.0 is covered by a regression test. Synthetic browser tests pass; compatibility with a particular live workspace is not guaranteed. The popup reports when the page script is absent, a session is unavailable, or a profile request fails.

## Update or troubleshoot

Replace the files in the folder already loaded in Chrome, click **Reload** on the extension in `chrome://extensions`, then reload Slack. Keeping the same loaded folder retains the extension identity and its local settings.

Open the extension popup while viewing a Slack conversation. It shows the script version, workspace ID, known-name count and current connection state. If automatic lookup remains unavailable, an optional manual correction or authorized `users.list` JSON import can supply the names.

Do not attach session tokens, private messages or a real member directory to public bug reports. Report the extension version and the short status message instead.

## Build and test

Node.js 20+ is required for development; Python 3 is used only for ZIP packaging. No npm dependencies are needed.

```sh
npm run build
npm test
npm run test:browser
# Open http://127.0.0.1:8787/client/TTEST00001/CTEST00001
# Stop the local fixture server with Ctrl+C when finished.
npm run package
```

`src/` contains editable sources, `extension/` contains generated installable files, and `dist/` contains the packaged extension. The test fixture uses fictitious profiles and a local mock API; it does not connect to a real Slack workspace.

## References

- [Slack user object](https://docs.slack.dev/reference/objects/user-object/)
- [Slack users.info](https://docs.slack.dev/reference/methods/users.info/)
- [Slack users.list](https://docs.slack.dev/reference/methods/users.list/)
- [Chrome content script manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)

## License

[MIT](LICENSE)
