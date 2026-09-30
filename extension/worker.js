/* Serialize directory changes across Slack tabs and the popup. */
importScripts("core.js");
(() => {
  "use strict";
  const core = globalThis.__SVNCore;
  let queue = Promise.resolve();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "save-profiles") return;
    if (!core.teamId(message.team) || !Array.isArray(message.records) || message.records.length > 20000) {
      respond({ ok: false, error: "Correspondances invalides." });
      return;
    }
    // Only an extension page can assign a manual override.
    const manual = message.manual === true && !sender.tab;
    const work = async () => {
      const storageKey = `directory:${message.team}`;
      const stored = (await chrome.storage.local.get(storageKey))[storageKey] || {};
      let count = 0;
      for (const raw of message.records) {
        const record = core.sanitize(raw);
        if (!record || (!manual && stored[record.id]?.manual)) continue;
        stored[record.id] = manual ? { ...record,
          aliases: [...new Set([...(stored[record.id]?.aliases || []), ...record.aliases])].slice(-20), manual: true
        } : record;
        count++;
      }
      await chrome.storage.local.set({ [storageKey]: stored });
      return { ok: true, count };
    };
    queue = queue.then(work, work);
    queue.then(respond, () => respond({ ok: false, error: "Impossible de sauvegarder les noms." }));
    return true;
  });
})();
