/* Shared pure helpers, loaded independently in each execution world. */
(() => {
  "use strict";
  const userId = value => typeof value === "string" && /^[UW][A-Z0-9]{8,}$/.test(value);
  const teamId = value => typeof value === "string" && /^T[A-Z0-9]{8,}$/.test(value);
  const clean = value => typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 160) : "";
  const aliasKey = value => clean(value).replace(/^@/, "").normalize("NFC").toLocaleLowerCase();
  function workspace(url) {
    try { return new URL(url).pathname.match(/^\/client\/(T[A-Z0-9]{8,})(?:\/|$)/)?.[1] || ""; }
    catch { return ""; }
  }
  function entry(user, hint = "") {
    if (!user || typeof user !== "object" || user.is_bot || user.is_app_user || user.id === "USLACKBOT") return null;
    const id = user.id || user.user_id || hint;
    if (!userId(id)) return null;
    const profile = user.profile || user;
    const fullName = clean(profile.real_name || user.real_name);
    if (!fullName) return null;
    const aliases = [...new Set([profile.display_name, user.name, fullName].map(clean).filter(Boolean))];
    return { id, fullName, aliases };
  }
  function sanitize(record) {
    if (!record || !userId(record.id)) return null;
    const fullName = clean(record.fullName);
    if (!fullName) return null;
    return { id: record.id, fullName, aliases: [...new Set(
      (Array.isArray(record.aliases) ? record.aliases.slice(0, 20) : []).map(clean).filter(Boolean)
    )] };
  }
  function collect(data, hint = "") {
    const found = new Map();
    const seen = new WeakSet();
    let budget = 50000;
    function visit(value, depth) {
      if (!value || typeof value !== "object" || depth > 12 || --budget < 0 || seen.has(value)) return;
      seen.add(value);
      const record = entry(value);
      if (record) found.set(record.id, record);
      for (const [key, child] of Object.entries(value)) {
        // Indexed user dictionaries sometimes omit the id within the value.
        if (userId(key)) {
          const indexed = entry(child, key);
          if (indexed) found.set(indexed.id, indexed);
        }
        visit(child, depth + 1);
      }
    }
    visit(data, 0);
    if (hint && data?.profile) {
      const record = entry({ id: hint, profile: data.profile });
      if (record) found.set(record.id, record);
    }
    return [...found.values()];
  }
  function index(records) {
    const ids = new Map();
    const aliases = new Map();
    for (const raw of records) {
      const record = sanitize(raw);
      if (!record) continue;
      ids.set(record.id, record);
      for (const alias of [...record.aliases, record.fullName]) {
        const key = aliasKey(alias);
        if (aliases.has(key) && aliases.get(key) !== record.id) aliases.set(key, null);
        else if (!aliases.has(key)) aliases.set(key, record.id);
      }
    }
    return { ids, aliases };
  }
  function resolve(directory, id, label) {
    // A known identity must never fall back to another person's alias.
    if (userId(id)) return directory.ids.get(id) || null;
    const matched = directory.aliases.get(aliasKey(label));
    return matched ? directory.ids.get(matched) : null;
  }
  globalThis.__SVNCore = Object.freeze({ userId, teamId, clean, aliasKey, workspace, entry, sanitize, collect, index, resolve });
})();
