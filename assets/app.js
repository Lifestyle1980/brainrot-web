/* Steal a Brainroot (Robloc) — Web
 * Funktionen wie Desktop: Login, Accounts, Kapazität, Add/Remove/Transfer,
 * DB erweitern, Mutationen (nur MPS), Stats, Export/Import, Bestes Brainroot.
 * Persistenz: localStorage ("accountsData","brainrootsDB"). 
 * Quelle Vorlage: brainroot_manager.py, brainroots_db.py
 */
const APP_PASSWORD = "Benjustus1509"; // wie Desktop
const LS_ACCOUNTS = "accountsData";
const LS_DB = "brainrootsDB";

let DB = { BRAINROOTS:{}, MUTATION_MULTIPLIERS:{} };
let DATA = {}; // { [account]: { password, capacity, brainroots: [] } }
let CURRENT = { account: null, selectedIndex: null };

// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toast(msg) { alert(msg); }

function loadDB() {
  const fromLS = localStorage.getItem(LS_DB);
  if (fromLS) {
    try { DB = JSON.parse(fromLS); return; } catch {}
  }
  // initial aus /public laden
  fetch("public/brainroots_db.json")
    .then(r=>r.json())
    .then(json => { DB = json; localStorage.setItem(LS_DB, JSON.stringify(DB)); })
    .catch(()=> toast("Konnte brainroots_db.json nicht laden."));
}

function loadData() {
  const raw = localStorage.getItem(LS_ACCOUNTS);
  DATA = raw ? JSON.parse(raw) : {};
}
function saveData() { localStorage.setItem(LS_ACCOUNTS, JSON.stringify(DATA)); }

function sum(arr, f) { return arr.reduce((a,b)=>a+f(b),0); }
function bestBy(arr, f) { if(!arr.length) return null; return arr.slice().sort((a,b)=>f(b)-f(a))[0]; }
function fmt(n){ try { return Number(n).toLocaleString("de-DE", {maximumFractionDigits:2}); } catch { return String(n); } }

function computeMPS(base, mutations) {
  let mult = 1.0;
  for (const m of (mutations||[])) {
    const x = Number(DB.MUTATION_MULTIPLIERS[m] || 1.0);
    mult *= x;
  }
  return Math.round((Number(base||0)*mult)*100)/100;
}

// ---------- Login ----------
function initLogin() {
  const overlay = $("#login-overlay");
  const input = $("#login-input");
  $("#login-btn").onclick = () => {
    if (input.value === APP_PASSWORD) {
      overlay.style.display = "none";
    } else {
      toast("Falsches Passwort. Zugriff verweigert.");
    }
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") $("#login-btn").click(); });
}

// ---------- Accounts UI ----------
function renderAccounts() {
  const grid = $("#accounts-grid");
  grid.innerHTML = "";
  const names = Object.keys(DATA).sort();
  if (!names.length) {
    grid.innerHTML = `<div class="center-muted">Rechts oben: <b>＋ Account</b> — oder DB füllen.</div>`;
    return;
  }
  for (const name of names) {
    const acc = DATA[name];
    const totalValue = sum(acc.brainroots||[], b=>Number(b.value||0));
    const totalMps   = sum(acc.brainroots||[], b=>Number(b.money_per_sec||0));
    const best       = bestBy(acc.brainroots||[], b=>Number(b.value||0));
    const bestName   = best ? best.name : "—";
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <h3>${name}</h3>
      <div class="badge">Max: ${acc.capacity}</div>
      <p style="margin:.5rem 0 .7rem; color:#cbd5e1">
        Belegt: ${acc.brainroots?.length||0} • Einkommen/s: <b>${fmt(totalMps)}</b><br/>
        Gesamtwert: <b>${fmt(totalValue)}</b> • Bestes: <b>${bestName}</b>
      </p>
      <div class="actions">
        <button data-open="${name}">Öffnen</button>
      </div>`;
    el.querySelector("[data-open]").onclick = () => openAccount(name);
    grid.appendChild(el);
  }
}

// ---------- Account Dialog ----------
function openAccount(name) {
  CURRENT.account = name;
  CURRENT.selectedIndex = null;

  const dlg = $("#modal-account");
  const acc = DATA[name];

  $("#modal-account-title").textContent = `Account: ${name}`;
  $("#stats-line-1").textContent = `Max: ${acc.capacity}  |  Belegt: ${acc.brainroots.length}`;
  const totalValue = sum(acc.brainroots, b=>Number(b.value||0));
  const totalMps   = sum(acc.brainroots, b=>Number(b.money_per_sec||0));
  const best       = bestBy(acc.brainroots, b=>Number(b.value||0));
  $("#stats-line-2").textContent = `Gesamtwert: ${fmt(totalValue)}   |   Einkommen/s: ${fmt(totalMps)}   |   Bestes: ${best?best.name:"—"}`;

  renderTable(acc);
  dlg.showModal();
}
function closeModal() { $("#modal-account").close(); }
$$("[data-close]").forEach(b=>b.addEventListener("click", closeModal));

function renderTable(acc) {
  const tbody = $("#table-brainroots tbody");
  tbody.innerHTML = "";
  acc.brainroots.forEach((b, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${b.name}</td>
      <td>${b.rarity}</td>
      <td>${fmt(b.value)}</td>
      <td>${fmt(b.base_mps)}</td>
      <td>${(b.mutations||[]).join(", ") || "—"}</td>
      <td>${fmt(b.money_per_sec)}</td>`;
    tr.onclick = () => {
      CURRENT.selectedIndex = i;
      $$("#table-brainroots tbody tr").forEach(row=>row.style.background="");
      tr.style.background = "rgba(122,162,255,.12)";
    };
    tbody.appendChild(tr);
  });
}

// ---------- Actions Topbar ----------
function addAccount() {
  const name = prompt("Account-Name:");
  if (!name) return;
  if (DATA[name]) { toast("Account existiert bereits."); return; }
  const pw = prompt("Account-Passwort:") ?? "";
  const cap = Number(prompt("Maximale Brainroots:"));
  if (!(cap>0)) { toast("Ungültige Kapazität."); return; }
  DATA[name] = { password: pw, capacity: cap, brainroots: [] };
  saveData(); renderAccounts();
}
function delAccount() {
  const names = Object.keys(DATA);
  if (!names.length) return toast("Keine Accounts vorhanden.");
  const name = prompt(`Welchen Account löschen?\nVorhanden:\n- ${names.join("\n- ")}`);
  if (!name || !DATA[name]) return;
  const p = prompt(`Passwort von '${name}' eingeben:`) ?? "";
  if (p !== DATA[name].password) return toast("Falsches Passwort.");
  if (!confirm(`Account '${name}' wirklich löschen?`)) return;
  if (!confirm("Letzte Bestätigung — Aktion kann nicht rückgängig gemacht werden.")) return;
  delete DATA[name]; saveData(); renderAccounts(); if ($("#modal-account").open) closeModal();
}
function reloadAll() { loadData(); renderAccounts(); }

// ---------- Export / Import ----------
function exportJSON() {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "accounts_export.json"; a.click();
  URL.revokeObjectURL(url);
}
function importJSON() {
  const file = $("#hidden-file");
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      const txt = await f.text();
      const incoming = JSON.parse(txt);
      if (typeof incoming !== "object") throw 0;
      if (!confirm("Vorhandene Accounts ggf. überschreiben/zusammenführen?")) return;
      Object.assign(DATA, incoming);
      saveData(); renderAccounts();
    } catch { toast("Ungültiges Import-Format."); }
    file.value = "";
  };
  file.click();
}

// ---------- DB erweitern ----------
function addToBrainrootDB() {
  const name = prompt("Name des Brainroots:");
  if (!name) return;
  if (DB.BRAINROOTS[name]) return toast("Brainroot existiert bereits.");
  const rarity = prompt("Rarity (z.B. Common/Rare/Epic/...):") || "Custom";
  const mps = Number(prompt("Geld pro Sekunde (MPS):"));
  const val = Number(prompt("Wert (Gesamtwert):"));
  if (!Number.isFinite(mps) || !Number.isFinite(val)) return toast("MPS/Wert müssen Zahlen sein.");
  DB.BRAINROOTS[name] = { rarity, money_per_sec:mps, value:val };
  localStorage.setItem(LS_DB, JSON.stringify(DB));
  toast("Brainroot hinzugefügt und DB gespeichert.");
}
function addMutationDB() {
  const name = prompt("Mutations-Name:");
  if (!name) return;
  if (DB.MUTATION_MULTIPLIERS[name]) return toast("Mutation existiert bereits.");
  const mult = Number(prompt("Multiplikator (z.B. 1.25):"));
  if (!Number.isFinite(mult)) return toast("Multiplikator muss eine Zahl sein.");
  DB.MUTATION_MULTIPLIERS[name] = mult;
  localStorage.setItem(LS_DB, JSON.stringify(DB));
  toast("Mutation hinzugefügt und DB gespeichert.");
}

// ---------- Account-Toolbar Aktionen ----------
function uiAddBrainrootToAccount() {
  const name = CURRENT.account; if (!name) return;
  const acc = DATA[name];
  if (acc.brainroots.length >= Number(acc.capacity||0)) return toast("Die maximale Anzahl an Brainroots ist erreicht.");

  // Brainroot wählen
  const brNames = Object.keys(DB.BRAINROOTS);
  const pick = prompt(`Brainroot auswählen:\n- ${brNames.join("\n- ")}`);
  if (!pick || !DB.BRAINROOTS[pick]) return;

  // Mutationen wählen (kommagetrennt)
  const muts = Object.keys(DB.MUTATION_MULTIPLIERS);
  const mutInput = prompt(`Mutationen wählen (optional, kommagetrennt):\n- ${muts.join("\n- ")}`) || "";
  const chosen = mutInput.split(",").map(s=>s.trim()).filter(s=>s && DB.MUTATION_MULTIPLIERS[s]);

  const brDef = DB.BRAINROOTS[pick];
  const base_mps = Number(brDef.money_per_sec||0);
  const final_mps = computeMPS(base_mps, chosen);
  const value = Number(brDef.value||0);

  const info = `Brainroot: ${pick}
Rarity: ${brDef.rarity}
Wert: ${value}
Basis MPS: ${base_mps} → Final MPS: ${final_mps}
Mutationen: ${chosen.length? chosen.join(", "): "—"}

Hinzufügen?`;
  if (!confirm(info)) return;

  const entry = {
    name: pick,
    rarity: brDef.rarity || "Custom",
    value,
    base_mps,
    mutations: chosen,
    money_per_sec: final_mps,
    added_at: new Date().toISOString().slice(0,19)
  };

  acc.brainroots.push(entry);
  saveData();
  openAccount(name); // refresh
  toast(`Brainroot '${pick}' wurde hinzugefügt.`);
}

function uiRemoveBrainrootFromAccount() {
  const name = CURRENT.account; if (!name) return;
  const acc = DATA[name];
  if (!(acc.brainroots||[]).length) return toast("Dieser Account hat keine Brainroots.");
  let idx = CURRENT.selectedIndex;
  if (idx==null) {
    const opts = acc.brainroots.map((b,i)=>`${i+1}. ${b.name} (Wert ${b.value}, MPS ${b.money_per_sec})`);
    const pick = prompt(`Welches Brainroot entfernen?\n${opts.join("\n")}`);
    if (!pick) return;
    const n = Number(pick.split(".")[0]); idx = n-1;
  }
  if (!(idx>=0 && idx<acc.brainroots.length)) return;
  const b = acc.brainroots[idx];
  if (!confirm(`'${b.name}' wirklich entfernen?`)) return;
  acc.brainroots.splice(idx,1);
  saveData();
  openAccount(name);
}

function uiTransferBrainroot() {
  const name = CURRENT.account; if (!name) return;
  const acc = DATA[name];
  if (!(acc.brainroots||[]).length) return toast("Es gibt keine Brainroots zum Übertragen.");
  const others = Object.keys(DATA).filter(a=>a!==name);
  if (!others.length) return toast("Kein Ziel-Account vorhanden.");

  let idx = CURRENT.selectedIndex;
  if (idx==null) {
    const opts = acc.brainroots.map((b,i)=>`${i+1}. ${b.name} (Wert ${b.value}, MPS ${b.money_per_sec})`);
    const pick = prompt(`Welches Brainroot übertragen?\n${opts.join("\n")}`);
    if (!pick) return;
    const n = Number(pick.split(".")[0]); idx = n-1;
  }
  if (!(idx>=0 && idx<acc.brainroots.length)) return;

  const target = prompt(`Ziel-Account wählen:\n- ${others.join("\n- ")}`);
  if (!target || !DATA[target]) return;

  if ((DATA[target].brainroots||[]).length >= Number(DATA[target].capacity||0))
    return toast(`Ziel-Account '${target}' ist voll.`);

  const entry = acc.brainroots[idx];
  if (!confirm(`'${entry.name}' von '${name}' zu '${target}' übertragen?`)) return;

  DATA[target].brainroots.push(entry);
  acc.brainroots.splice(idx,1);
  saveData();
  openAccount(name);
}

// ---------- Events ----------
function wireEvents() {
  $("#btn-add-account").onclick = addAccount;
  $("#btn-del-account").onclick = delAccount;
  $("#btn-reload").onclick = reloadAll;
  $("#btn-export").onclick = exportJSON;
  $("#btn-import").onclick = importJSON;

  $("#btn-add-brainroot-db").onclick = addToBrainrootDB;
  $("#btn-add-mutation-db").onclick = addMutationDB;

  $("#btn-add-br-to-acc").onclick = uiAddBrainrootToAccount;
  $("#btn-rem-br-from-acc").onclick = uiRemoveBrainrootFromAccount;
  $("#btn-move-br").onclick = uiTransferBrainroot;
}

// ---------- Init ----------
(function init(){
  initLogin();
  loadDB();
  loadData();
  wireEvents();
  renderAccounts();
})();
