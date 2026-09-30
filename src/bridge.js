/* Resolve visible members with Slack's current session, kept only in this page. */
(() => {
  "use strict";
  const core = globalThis.__SVNCore;
  const channel = "slack-real-names:v1";
  const cache = new Map();
  const sessions = new Map();
  const jobs = new Map();
  let enabled = true, running = false;
  let lastStatus = "";
  const originalFetch = window.fetch;
  function status(state, error = "") {
    const data = { state, error };
    const encoded = JSON.stringify(data);
    if (encoded === lastStatus) return;
    lastStatus = encoded;
    window.postMessage({ channel, type: "status", team: core.workspace(location.href), ...data }, location.origin);
  }
  function parameters(body) {
    if (body instanceof URLSearchParams || body instanceof FormData) return body;
    if (typeof body !== "string") return new URLSearchParams();
    if (body.trim().startsWith("{")) {
      try { return new URLSearchParams(JSON.parse(body)); } catch { return new URLSearchParams(); }
    }
    return new URLSearchParams(body);
  }
  function learnSession(rawUrl, body, headers) {
    try {
      const url = new URL(rawUrl, location.href);
      // Only reuse auth from Slack's API on the page's own origin.
      if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return;
      const params = parameters(body);
      const token = params.get("token") || url.searchParams.get("token") || new Headers(headers).get("authorization")?.replace(/^Bearer\s+/i, "");
      if (typeof token !== "string" || !/^xox[a-z]-[a-zA-Z0-9-]+$/.test(token)) return;
      const context = params.get("team_id") || url.searchParams.get("team_id") || core.workspace(location.href);
      if (!core.teamId(context)) return;
      sessions.set(context, token);
      status("session-ready");
      void pump();
    } catch { /* Unsupported request format: let Slack continue normally. */ }
  }
  async function pump() {
    if (running || !enabled) return;
    running = true;
    try {
      while (enabled) {
        const team = core.workspace(location.href);
        const token = sessions.get(team);
        const next = [...jobs.entries()].find(([, job]) => job.team === team);
        if (!token || !next) {
          status(!token ? "waiting-session" : "idle");
          break;
        }
        const [key, job] = next;
        jobs.delete(key);
        if (cache.has(key)) continue;
        status("resolving");
        try {
          const body = new URLSearchParams({ token, user: job.id, team_id: team });
          const response = await Reflect.apply(originalFetch, window, [new URL("/api/users.info", location.origin).href, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
          }]);
          if (response.status === 429) {
            status("rate-limited");
            if (job.attempt < 2) jobs.set(key, { ...job, attempt: job.attempt + 1 });
            const seconds = Number(response.headers.get("retry-after")) || 60;
            await new Promise(resolve => setTimeout(resolve, Math.min(Math.max(seconds, 1), 300) * 1000));
            continue;
          }
          const data = response.ok ? await response.json() : null;
          if (data?.ok) publish(core.collect(data, job.id), team);
          else if (["invalid_auth", "not_authed", "token_revoked", "missing_scope"].includes(data?.error)) {
            status("auth-error", data.error);
            sessions.delete(team);
            break;
          }
          else status("api-error", String(data?.error || `http_${response.status}`).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80));
        } catch { status("network-error"); }
        // Slack API limits apply even to the user's web session.
        await new Promise(resolve => setTimeout(resolve, 1300));
      }
    } finally { running = false; }
  }
  function publish(records, team = core.workspace(location.href)) {
    if (!core.teamId(team)) return;
    const changed = [];
    for (const record of records) {
      const key = `${team}:${record.id}`;
      if (JSON.stringify(cache.get(key)) === JSON.stringify(record)) continue;
      cache.set(key, record);
      changed.push(record);
    }
    for (let offset = 0; offset < changed.length; offset += 200) {
      window.postMessage({ channel, type: "profiles", team, records: changed.slice(offset, offset + 200) }, location.origin);
    }
  }
  function requestInfo(rawUrl, body) {
    try {
      const url = new URL(rawUrl, location.href);
      if (!(url.hostname === "slack.com" || url.hostname.endsWith(".slack.com"))) return null;
      if (!/\/(?:api\/(?:users\.(?:info|list|profile\.get|search)|client\.boot)|[^/]*\/users\/(?:search|info|list))(?:\/|$)/.test(url.pathname)) return null;
      let hint = url.searchParams.get("user") || "";
      let team = core.workspace(location.href);
      const params = parameters(body);
      if (params) {
        hint = params.get("user") || hint;
        const requestTeam = params.get("team_id") || params.get("team");
        if (core.teamId(requestTeam)) team = requestTeam;
      }
      return { hint: core.userId(hint) ? hint : "", team };
    } catch { return null; }
  }
  function accept(data, info) {
    try { publish(core.collect(data, info.hint), info.team); } catch { /* Slack must continue unaffected. */ }
  }
  window.fetch = function (...args) {
    const input = args[0];
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    learnSession(rawUrl, args[1]?.body, args[1]?.headers || (input instanceof Request ? input.headers : undefined));
    let bodyDetails = Promise.resolve("");
    let isApi = false;
    try { const url = new URL(rawUrl, location.href); isApi = url.origin === location.origin && url.pathname.startsWith("/api/"); } catch {}
    if (isApi && input instanceof Request && !args[1]?.body && input.method !== "GET") {
      try {
        bodyDetails = input.clone().text().then(body => {
          learnSession(input.url, body, args[1]?.headers || input.headers);
          return body;
        }).catch(() => "");
      } catch { /* Already used request body. */ }
    }
    const info = requestInfo(rawUrl, args[1]?.body);
    const result = Reflect.apply(originalFetch, this, args);
    if (info) {
      let requestDetails = Promise.resolve(info);
      if (input instanceof Request && !args[1]?.body && input.method !== "GET") {
        requestDetails = bodyDetails.then(body => requestInfo(input.url, body) || info);
      }
      void result.then(response => {
        if (!response.ok) return;
        // Clone immediately, before Slack consumes its original response.
        const copy = response.clone();
        return Promise.all([copy.json(), requestDetails]).then(([data, details]) => accept(data, details));
      }).catch(() => {});
    }
    return result;
  };
  const requests = new WeakMap();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalHeader = XMLHttpRequest.prototype.setRequestHeader;
  const authHeaders = new WeakMap();
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    requests.set(this, String(url));
    authHeaders.delete(this);
    return Reflect.apply(originalOpen, this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (String(name).toLowerCase() === "authorization") authHeaders.set(this, String(value));
    return Reflect.apply(originalHeader, this, [name, value]);
  };
  XMLHttpRequest.prototype.send = function (body) {
    learnSession(requests.get(this), body, authHeaders.has(this) ? { authorization: authHeaders.get(this) } : undefined);
    const info = requestInfo(requests.get(this), body);
    if (info) this.addEventListener("load", () => {
      try {
        if (this.status < 200 || this.status >= 300) return;
        const data = this.responseType === "json" ? this.response
          : (!this.responseType || this.responseType === "text") ? JSON.parse(this.responseText) : null;
        if (data) accept(data, info);
      } catch { /* Ignore non-JSON responses. */ }
    }, { once: true });
    return Reflect.apply(originalSend, this, [body]);
  };
  function boot() {
    try {
      for (const data of [window.TS?.boot_data, window.boot_data]) {
        if (!data) continue;
        publish(core.collect(data));
        if (typeof data.api_token === "string") {
          learnSession(new URL("/api/client.boot", location.origin).href,
            new URLSearchParams({ token: data.api_token, team_id: core.workspace(location.href) }));
        }
      }
      for (const script of document.querySelectorAll('script[type="application/json"]')) {
        if (script.textContent.length > 5000000) continue;
        try { publish(core.collect(JSON.parse(script.textContent))); } catch { /* Not a profile payload. */ }
      }
    } catch { /* Bootstrap structure is not a public API. */ }
  }
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== channel) return;
    if (event.data.type === "resolve") {
      const data = event.data;
      if (data.team !== core.workspace(location.href) || !Array.isArray(data.ids)) return;
      for (const id of data.ids.slice(0, 200)) {
        if (core.userId(id) && id !== "USLACKBOT") jobs.set(`${data.team}:${id}`, { team: data.team, id, attempt: 0 });
      }
      void pump();
      return;
    }
    if (event.data.type !== "ready") return;
    lastStatus = "";
    enabled = event.data.enabled !== false;
    boot();
    void pump();
    const team = core.workspace(location.href);
    const records = [...cache.entries()].filter(([key]) => key.startsWith(`${team}:`)).map(([, record]) => record);
    for (let i = 0; i < records.length; i += 200) {
      window.postMessage({ channel, type: "profiles", team, records: records.slice(i, i + 200) }, location.origin);
    }
  });
  document.addEventListener("DOMContentLoaded", boot, { once: true });
  window.postMessage({ channel, type: "bridge-ready" }, location.origin);
})();
