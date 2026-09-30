(() => {
  "use strict";
  const core = globalThis.__SVNCore;
  const $ = id => document.getElementById(id);
  let team = "", records = {};
  async function diagnose(tabId) {
    try {
      const data = await chrome.tabs.sendMessage(tabId, { type: "slack-unslop-status" });
      if (!data) throw new Error("No content script");
      $("diagnostic").textContent = !data.bridgeReady ? "Script Slack absent : recharge l’onglet Slack."
        : data.state === "waiting-session" ? "En attente de la session Slack : recharge l’onglet."
        : data.state === "auth-error" ? `Slack refuse l’accès aux profils : ${data.error}.`
        : data.state === "resolving" ? "Récupération automatique des noms en cours…"
        : data.state === "rate-limited" ? "Slack limite les requêtes. Reprise automatique après un délai."
        : ["api-error", "network-error"].includes(data.state) ? `Impossible de récupérer un profil : ${data.error || "erreur réseau"}.`
        : `Connecté à Slack · script v${data.version}`;
    } catch { $("diagnostic").textContent = "L’extension n’est pas active sur cet onglet. Recharge Slack après avoir rechargé l’extension."; }
  }
  function status(text, error = false) {
    $("status").textContent = text;
    $("status").classList.toggle("error", error);
  }
  function refresh() {
    const entries = Object.values(records).filter(core.sanitize);
    $("count").textContent = `${entries.length} nom${entries.length === 1 ? "" : "s"} connu${entries.length === 1 ? "" : "s"} dans cet espace`;
    const selected = $("known").value;
    $("known").replaceChildren(new Option("Nouvelle personne…", ""));
    for (const record of entries.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"))) {
      $("known").add(new Option(`${record.fullName} · ${record.id}`, record.id));
    }
    $("known").value = selected;
  }
  async function start() {
    const [tabs, state] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      chrome.storage.local.get("enabled")
    ]);
    $("enabled").checked = state.enabled !== false;
    try {
      const url = new URL(tabs[0]?.url || "");
      if (url.protocol === "https:" && (url.hostname === "slack.com" || url.hostname.endsWith(".slack.com"))) team = core.workspace(url.href);
    } catch { /* No accessible tab. */ }
    for (const id of ["save", "import", "known", "user-id", "full-name", "alias"]) $(id).disabled = !team;
    if (!team) return;
    $("workspace").textContent = `Espace ${team}`;
    records = (await chrome.storage.local.get(`directory:${team}`))[`directory:${team}`] || {};
    refresh();
    await diagnose(tabs[0].id);
    setInterval(() => void diagnose(tabs[0].id), 1500);
  }
  $("enabled").addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ enabled: $("enabled").checked });
      status($("enabled").checked ? "Affichage activé." : "Noms d’origine restaurés.");
    } catch { status("Impossible de sauvegarder le réglage.", true); }
  });
  $("known").addEventListener("change", () => {
    const record = records[$("known").value];
    $("user-id").value = record?.id || "";
    $("full-name").value = record?.fullName || "";
    $("alias").value = record?.aliases?.find(alias => alias !== record.fullName) || "";
  });
  $("manual").addEventListener("submit", async event => {
    event.preventDefault();
    if (!team) return;
    const id = $("user-id").value.trim();
    const record = core.sanitize({ id, fullName: $("full-name").value,
      aliases: [$("alias").value.replace(/^@/, "")] });
    if (!record) return status("Indique un identifiant Slack valide et un nom complet.", true);
    try {
      const result = await chrome.runtime.sendMessage({ type: "save-profiles", team, manual: true, records: [record] });
      if (!result?.ok) throw new Error("Save failed");
      status(`Nom enregistré : ${record.fullName}.`);
    } catch { status("Impossible d’enregistrer le nom.", true); }
  });
  $("import").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file || !team) return;
    try {
      if (file.size > 5000000) throw new Error("Le fichier dépasse 5 Mo.");
      const data = JSON.parse(await file.text());
      if (data?.ok === false) throw new Error("Ce fichier contient une erreur de l’API Slack.");
      if (data?.team_id && data.team_id !== team) throw new Error("Ce fichier appartient à un autre espace Slack.");
      const imports = core.collect(data);
      if (!imports.length) throw new Error("Aucun profil avec identifiant et nom complet trouvé.");
      const result = await chrome.runtime.sendMessage({ type: "save-profiles", team, records: imports });
      if (!result?.ok) throw new Error(result?.error || "Impossible d’importer les profils.");
      status(`${result.count} profil(s) importé(s). Les corrections manuelles sont conservées.`);
    } catch (error) { status(error instanceof SyntaxError ? "Le fichier n’est pas un JSON valide." : error.message, true); }
    finally { event.target.value = ""; }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) $("enabled").checked = changes.enabled.newValue !== false;
    if (team && changes[`directory:${team}`]) {
      records = changes[`directory:${team}`].newValue || {};
      refresh();
    }
  });
  void start().catch(() => status("Impossible de lire les réglages. Rouvre l’extension.", true));
})();
