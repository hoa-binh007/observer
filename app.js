// --- Firebase live ID listener (minimal add-on) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  databaseURL: "https://rote-ginseng-vn-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "rote-ginseng-vn",
  appId: "...",
};


// --------------------------------------------------

const STORAGE_KEY = "hongshot_observations_v1";

const $ = (id) => document.getElementById(id);

const state = {
  current: null,
  place: null,
  groups: {
    age: null,
    persona: null,
    company: null,

    clothing: null,
    afford: null,
    reaction: null,
    compare: null,
  },
  live: {
    city: "SG",        // Default für Start Saigon
    lastId: null,
  },
};

function nowIso() {
  return new Date().toISOString();
}

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function setLastAction(text) {
  $("lastAction").textContent = `${text} · ${nowIso()}`;
}

function newSession() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const now = new Date();

  state.current = {
    id: crypto?.randomUUID
      ? crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`,

    tester_id: "",
    place: null,

    // bestehend (UTC, maschinenlesbar)
    session_start: nowIso(),

    // 🔥 NEU – lokal & menschlich
    timezone: tz,                              // z.B. "Asia/Bangkok"
    session_start_local: now.toLocaleString(), // lokale Anzeige
    tz_offset_min: -now.getTimezoneOffset(),   // Bangkok = 420

    ts_first_sip: null,
    ts_first_comment: null,
    ts_finish: null,

    estimated_age: null,
    persona: null,
    company: null,
    clothing: null,
    afford: null,
    reaction: null,
    compare: null,

    first_comment: "",
    notes: "",
  };

  state.place = null;
  Object.keys(state.groups).forEach((k) => (state.groups[k] = null));

  $("testerId").value = "";
  $("comment").value = "";
  $("sessionStart").textContent = state.current.session_start_local;
  $("lastAction").textContent = "–";

  deactivateAllChips();
  setLastAction("Neu gestartet");
}


function deactivateAllChips() {
  document.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
}

function activateOneInContainer(container, btn) {
  container.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function wireChips() {
  document.querySelectorAll(".chips[data-group]").forEach((container) => {
    const group = container.getAttribute("data-group");
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;

      activateOneInContainer(container, btn);
      const val = btn.getAttribute("data-value");
      state.groups[group] = val;

      state.current[group === "age" ? "estimated_age" : group] = val;

      setLastAction(`${group}: ${val}`);
      autosaveDraft();
    });
  });

  $("placeChips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    activateOneInContainer($("placeChips"), btn);
    const val = btn.getAttribute("data-value");
    state.place = val;
    state.current.place = val;
    setLastAction(`place: ${val}`);
    autosaveDraft();
  });
}

function autosaveDraft() {
  state.current.tester_id = ($("testerId").value || "").trim();
  state.current.first_comment = ($("comment").value || "").trim();
  state.current.notes = ($("miscNotes").value || "").trim();
}

function validateMinimal() {
  const tid = ($("testerId").value || "").trim();
  if (!tid) return { ok: false, msg: "Bitte Tester-ID eintragen (z. B. SG-0001)." };
  return { ok: true };
}

function addRecordAndReset() {
  const v = validateMinimal();
  if (!v.ok) {
    alert(v.msg);
    return;
  }

  autosaveDraft();
  state.current.ts_finish = nowIso();

  const all = loadAll();
  all.push(state.current);
  saveAll(all);

  setLastAction("Gespeichert");
  renderList();

  newSession();
}

function markTime(field, label) {
  autosaveDraft();
  state.current[field] = nowIso();
  setLastAction(label);
  autosaveDraft();
}

function renderList() {
  const all = loadAll().slice().reverse();
  const wrap = $("records");
  wrap.innerHTML = "";

  if (all.length === 0) {
    wrap.innerHTML = `<div class="kv">Noch keine Beobachtungen gespeichert.</div>`;
    return;
  }

  all.forEach((rec) => {
    const div = document.createElement("div");
    div.className = "rec";

    const top = document.createElement("div");
    top.className = "rec__top";

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:900;font-size:16px">${escapeHtml(rec.tester_id || "—")}</div>
      <div class="kv">Start: ${escapeHtml(rec.session_start || "—")}</div>
      <div class="kv">Finish: ${escapeHtml(rec.ts_finish || "—")}</div>
      <div class="kv">Ort: ${escapeHtml(rec.place || "—")}</div>
      ${rec.notes ? `<div class="kv">Notiz: ${escapeHtml(rec.notes)}</div>` : ""}
    `;

    const right = document.createElement("div");
    const btnDel = document.createElement("button");
    btnDel.className = "smallbtn";
    btnDel.textContent = "Löschen";
    btnDel.onclick = () => deleteRecord(rec.id);

    right.appendChild(btnDel);
    top.appendChild(left);
    top.appendChild(right);

    const body = document.createElement("div");
    body.style.marginTop = "10px";
    body.innerHTML = `
      <div class="kv">Alter: ${escapeHtml(rec.estimated_age || "—")} · Wirkt wie: ${escapeHtml(rec.persona || "—")} · Begleitung: ${escapeHtml(rec.company || "—")}</div>
      <div class="kv">Kleidung: ${escapeHtml(rec.clothing || "—")} · Zahlungsfähigkeit: ${escapeHtml(rec.afford || "—")}</div>
      <div class="kv">Reaktion: ${escapeHtml(rec.reaction || "—")} · Vergleich: ${escapeHtml(rec.compare || "—")}</div>
      <div class="kv">Erster Schluck: ${escapeHtml(rec.ts_first_sip || "—")} · Kommentar: ${escapeHtml(rec.ts_first_comment || "—")}</div>
      <div style="margin-top:8px">${escapeHtml(rec.first_comment || "")}</div>
    `;

    div.appendChild(top);
    div.appendChild(body);
    wrap.appendChild(div);
  });
}

function deleteRecord(id) {
  const all = loadAll();
  const next = all.filter((r) => r.id !== id);
  saveAll(next);
  renderList();
}

function download(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const all = loadAll();
  download(`hongshot_observations_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(all, null, 2));
}

function toCsvRow(obj, headers) {
  return headers
    .map((h) => {
      const v = obj[h] ?? "";
      const s = String(v).replaceAll('"', '""');
      return `"${s}"`;
    })
    .join(",");
}

function exportCsv() {
  const all = loadAll();
  if (all.length === 0) {
    alert("Keine Daten vorhanden.");
    return;
  }

  const headers = [
    "id",
    "tester_id",
    "place",
    "session_start",
    "ts_first_sip",
    "ts_first_comment",
    "ts_finish",
    "estimated_age",
    "persona",
    "company",
    "clothing",
    "afford",
    "reaction",
    "compare",
    "first_comment",
    "notes",
  ];

  const lines = [];
  lines.push(headers.join(","));
  all.forEach((r) => lines.push(toCsvRow(r, headers)));

  download(`hongshot_observations_${new Date().toISOString().slice(0,10)}.csv`, lines.join("\n"), "text/csv");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showList(show) {
  $("listView").hidden = !show;
}

function wireInputs() {
  $("testerId").addEventListener("input", autosaveDraft);
  $("comment").addEventListener("input", autosaveDraft);
  $("miscNotes").addEventListener("input", autosaveDraft); // ✅ FIX: Notizen richtig live speichern
}

function wireTopbar() {
  $("btnNew").onclick = () => {
    showList(false);
    newSession();
  };
  $("btnList").onclick = () => {
    showList(true);
    renderList();
  };
}

function wireTimeButtons() {
  $("btnFirstSip").onclick = () => markTime("ts_first_sip", "Erster Schluck");
  $("btnFirstComment").onclick = () => markTime("ts_first_comment", "Erster Kommentar");
  $("btnFinish").onclick = () => addRecordAndReset();
}

function wireExports() {
  $("btnExportJson").onclick = exportJson;
  $("btnExportCsv").onclick = exportCsv;
  $("btnClearAll").onclick = () => {
    const ok = confirm("Wirklich ALLES löschen? localStorage wird geleert.");
    if (!ok) return;
    saveAll([]);
    renderList();
  };
}

// --- Live Tester-ID Empfang ---
function inferCityFromTesterId(tid) {
  const m = String(tid || "").trim().match(/^([A-Z]{2})-/);
  return m ? m[1] : "SG";
}

function setTesterIdFromLive(tid, sourceLabel) {
  const incoming = String(tid || "").trim();
  if (!incoming) return;

  // optional: city automatisch nachführen
  state.live.city = inferCityFromTesterId(incoming);

  if ($("testerId").value.trim() === incoming) return;

  $("testerId").value = incoming;
  autosaveDraft();
  setLastAction(`${sourceLabel}: ${incoming}`);
  state.live.lastId = incoming;
}

function startFirebaseListener() {
  try {
    const fbApp = initializeApp(FIREBASE_CONFIG);
    const db = getDatabase(fbApp);

    const city = state.live.city || "SG";
    const liveRef = ref(db, `live/${city}/currentTesterId`);

    onValue(liveRef, (snap) => {
      const v = snap.val();
      if (!v || !v.tester_id) return;
      setTesterIdFromLive(v.tester_id, "LIVE ID");
      // Offline fallback auch aktualisieren
      localStorage.setItem(`liveTesterId_${city}`, String(v.tester_id));
    });

    setLastAction(`LIVE Listener aktiv (${city})`);
  } catch (e) {
    console.warn("Firebase listener failed, fallback to localStorage", e);
  }
}

function fallbackPollLocalStorage() {
  // falls Firebase nicht verfügbar ist, alle 2s schauen ob Survey in localStorage was abgelegt hat
  setInterval(() => {
    const city = state.live.city || "SG";
    const tid = localStorage.getItem(`liveTesterId_${city}`);
    if (tid && tid !== state.live.lastId) {
      setTesterIdFromLive(tid, "LOCAL ID");
    }
  }, 2000);
}
// -----------------------------

function init() {
  wireChips();
  wireInputs();
  wireTopbar();
  wireTimeButtons();
  wireExports();

  newSession();
  showList(false);

  startFirebaseListener();
  fallbackPollLocalStorage();
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch (e) {
    console.error("[Observer] init crashed:", e);
    alert("Observer-Fehler: " + (e?.message || e));
  }
});





