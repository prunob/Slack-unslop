(() => {
  "use strict";
  const core = globalThis.__SVNCore;
  const channel = "slack-real-names:v1";
  const selector = [
    '.c-message__sender', '[data-qa="message_sender_name"]',
    '.c-member_slug', '.c-mention', '.c-link--mention', '[data-qa="user_mention"]',
    '[data-qa="member_name"]', '[data-qa="autocomplete_user_name"]',
    '.c-search_autocomplete__suggestion_name',
    '[data-qa="channel_sidebar_name"][data-user-id]',
    '[data-qa="channel_sidebar_name"][data-member-id]'
  ].join(",");
  const ignore = 'textarea,input,pre,code,[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
  const edits = new Map();
  let team = "", enabled = true, records = {}, directory = core.index([]);
  let timer, saveTimer, routeVersion = 0;
  const pending = new Map();
  const requested = new Set();
  let bridgeReady = false, bridgeStatus = "starting", bridgeError = "";
  function diagnostics() {
    const data = { version: "0.1.1", team, enabled, bridgeReady, state: bridgeStatus,
      error: bridgeError, known: directory.ids.size, requested: requested.size };
    document.documentElement?.setAttribute("data-slack-unslop", JSON.stringify(data));
    return data;
  }
  const key = () => `directory:${team}`;
  function restore() {
    for (const [node, edit] of edits) {
      if (node.isConnected && node.nodeValue === edit.replacement) node.nodeValue = edit.original;
    }
    edits.clear();
  }
  function identity(element, isMention) {
    let current = element;
    for (let depth = 0; current && depth < (isMention ? 2 : 5); depth++, current = current.parentElement) {
      for (const attr of ["data-user-id", "data-member-id", "data-message-sender", "data-mention-id", "data-stringify-id", "data-id"]) {
        const value = current.getAttribute(attr);
        if (core.userId(value)) return value;
      }
      const href = current.getAttribute("href");
      if (href) {
        try {
          const url = new URL(href, location.href);
          if (url.protocol === "slack:" || url.hostname === "slack.com" || url.hostname.endsWith(".slack.com")) {
            const id = url.searchParams.get("user") || url.searchParams.get("id") || url.pathname.match(/\/(?:team|user)\/([UW][A-Z0-9]{8,})(?:\/|$)/)?.[1];
            if (core.userId(id)) return id;
          }
        } catch { /* Not a profile link. */ }
      }
    }
    return "";
  }
  function rewrite(element) {
    if (element.closest(ignore) || element.querySelector('input,textarea,[contenteditable="true"]')) return;
    if (element.matches('[data-mention-type="usergroup"], [data-mention-type="broadcast"], [data-stringify-type="usergroup"], [data-stringify-type="broadcast"]') || element.getAttribute("data-usergroup-id")) return;
    const nodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('svg,[aria-hidden="true"],.c-emoji,button:not(.c-message__sender)') && node.parentElement !== element) continue;
      if (node.nodeValue.trim()) nodes.push(node);
    }
    // Never collapse a label with status, metadata or nested controls into a name.
    if (nodes.length !== 1) return;
    const node = nodes[0];
    const oldEdit = edits.get(node);
    const raw = oldEdit && oldEdit.replacement === node.nodeValue ? oldEdit.original : node.nodeValue;
    const label = raw.trim();
    if (/^@(here|channel|everyone|ici|canal|tous)$/i.test(label)) return;
    const isMention = label.startsWith("@") || element.matches('.c-member_slug,.c-mention,.c-link--mention,[data-qa="user_mention"]');
    const person = core.resolve(directory, identity(element, isMention), label);
    if (!person) {
      if (oldEdit && node.nodeValue === oldEdit.replacement) node.nodeValue = oldEdit.original;
      edits.delete(node);
      return;
    }
    const replacement = `${raw.match(/^\s*/)[0]}${isMention ? "@" : ""}${person.fullName}${raw.match(/\s*$/)[0]}`;
    if (node.nodeValue !== replacement) node.nodeValue = replacement;
    edits.set(node, { original: raw, replacement });
  }
  function scan() {
    timer = undefined;
    diagnostics();
    if (!enabled || !team) return;
    for (const [node] of edits) if (!node.isConnected) edits.delete(node);
    for (const element of document.querySelectorAll(selector)) rewrite(element);
    const ids = new Set();
    for (const element of document.querySelectorAll(selector)) {
      if (element.closest(ignore)) continue;
      const id = identity(element, element.matches('.c-member_slug,.c-mention,.c-link--mention,[data-qa="user_mention"]'));
      if (core.userId(id) && !directory.ids.has(id) && !requested.has(id)) ids.add(id);
    }
    if (ids.size) {
      const batch = [...ids].slice(0, 200);
      for (const id of batch) requested.add(id);
      window.postMessage({ channel, type: "resolve", team, ids: batch }, location.origin);
      diagnostics();
    }
  }
  function schedule() {
    if (timer === undefined) timer = setTimeout(scan, 80);
  }
  async function flush() {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    if (!pending.size || !team) return;
    const saveTeam = team, updates = [...pending.values()];
    pending.clear();
    try {
      const result = await chrome.runtime.sendMessage({ type: "save-profiles", team: saveTeam, records: updates });
      if (!result?.ok) throw new Error("Save failed");
    } catch { /* Tab closing / extension reloading. */ }
  }
  async function loadWorkspace() {
    const next = core.workspace(location.href);
    if (next === team) return;
    // Finish old workspace writes before resetting its in-memory directory.
    await flush();
    restore();
    team = next;
    requested.clear();
    pending.clear();
    records = {};
    directory = core.index([]);
    const version = ++routeVersion;
    if (!team) return;
    const state = await chrome.storage.local.get([key(), "enabled"]);
    if (version !== routeVersion) return;
    records = { ...(state[key()] || {}), ...records };
    enabled = state.enabled !== false;
    directory = core.index(Object.values(records));
    window.postMessage({ channel, type: "ready", enabled }, location.origin);
    schedule();
  }
  window.addEventListener("message", event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.channel !== channel) return;
    if (data.type === "bridge-ready") {
      bridgeReady = true;
      requested.clear();
      window.postMessage({ channel, type: "ready", enabled }, location.origin);
      schedule();
      return;
    }
    if (data.type === "status" && data.team === team && typeof data.state === "string") {
      bridgeReady = true;
      bridgeStatus = data.state.slice(0, 40);
      bridgeError = typeof data.error === "string" ? data.error.slice(0, 80) : "";
      diagnostics();
      return;
    }
    if (data.type !== "profiles" || data.team !== team || !Array.isArray(data.records)) return;
    for (const raw of data.records.slice(0, 200)) {
      const record = core.sanitize(raw);
      if (!record || records[record.id]?.manual) continue;
      if (JSON.stringify(records[record.id]) === JSON.stringify(record)) continue;
      records[record.id] = record;
      pending.set(record.id, record);
    }
    directory = core.index(Object.values(records));
    if (pending.size && saveTimer === undefined) saveTimer = setTimeout(flush, 600);
    schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (!enabled) restore();
      requested.clear();
      window.postMessage({ channel, type: "ready", enabled }, location.origin);
    }
    if (team && changes[key()]) {
      records = changes[key()].newValue || {};
      for (const record of pending.values()) if (!records[record.id]?.manual) records[record.id] = record;
      directory = core.index(Object.values(records));
    }
    schedule();
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id === chrome.runtime.id && message?.type === "slack-unslop-status") respond(diagnostics());
  });
  const observer = new MutationObserver(schedule);
  observer.observe(document, { childList: true, characterData: true, subtree: true, attributes: true,
    attributeFilter: ["data-user-id", "data-member-id", "data-message-sender", "data-mention-id", "data-stringify-id", "data-id", "href", "data-qa", "class"] });
  void loadWorkspace();
  setInterval(() => {
    if (core.workspace(location.href) !== team) void loadWorkspace();
  }, 1000);
})();
