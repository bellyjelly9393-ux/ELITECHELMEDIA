(() => {
  const $ = (id) => document.getElementById(id);
  let files = [];
  let downloadsEnabled = false;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const gb = (b) => (Number(b || 0) / 1e9).toFixed(2) + " GB";
  const dur = (s) => { const n = Math.round(Number(s) || 0); if (!n) return "—"; const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`; };

  async function token() {
    const db = window.VVHLBackend?.db;
    const { data } = db ? await db.auth.getSession() : { data: null };
    const t = data?.session?.access_token;
    if (!t) throw new Error("Sign in with a staff account to open the archive.");
    return t;
  }
  async function api(query = "") {
    const res = await fetch("/api/vod-archive" + query, { headers: { Authorization: "Bearer " + (await token()) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Archive request failed (HTTP " + res.status + ")");
    return body;
  }

  function render() {
    const q = ($("vaSearch").value || "").toLowerCase();
    const month = $("vaMonth").value;
    const list = files.filter((f) => (!month || String(f.game_date || "").startsWith(month)) &&
      (!q || [f.file_name, f.streamer, f.twitch_vod_id, ...(f.teams || [])].join(" ").toLowerCase().includes(q)));
    $("vaCount").textContent = files.length;
    $("vaSize").textContent = gb(files.reduce((a, f) => a + Number(f.bytes || 0), 0));
    $("vaVerified").textContent = files.filter((f) => f.verified_at).length + " / " + files.length;
    $("vaLinked").textContent = files.filter((f) => f.review_session_id).length;
    const body = $("vaRows");
    if (!list.length) { body.innerHTML = `<tr><td colspan="6"><div class="va-empty">${files.length ? "No files match the filter." : "No archived VODs yet."}</div></td></tr>`; return; }
    body.innerHTML = list.map((f) => `<tr>
      <td data-label="Date">${esc(f.game_date || "—")}</td>
      <td data-label="VOD"><span class="va-file">${esc(f.streamer || f.file_name)}</span><span class="va-sub">${esc(f.file_name)}</span></td>
      <td data-label="Teams">${(f.teams || []).map((t) => `<span class="va-tag">${esc(t)}</span>`).join("") || "—"}</td>
      <td data-label="Length">${dur(f.duration_seconds)}</td>
      <td data-label="Size">${gb(f.bytes)} <span class="va-sub ${f.verified_at ? "va-ok" : "va-pending"}">${f.verified_at ? "SHA-256 verified" : "Verifying"}</span></td>
      <td data-label=""><button class="va-btn" data-dl="${esc(f.id)}" ${downloadsEnabled ? "" : "disabled title=\"Archive storage not configured\""}>Download</button></td>
    </tr>`).join("");
  }

  async function load() {
    $("vaStatus").textContent = "Loading archive…";
    try {
      const body = await api();
      files = body.files || []; downloadsEnabled = Boolean(body.downloadsEnabled);
      const months = [...new Set(files.map((f) => String(f.game_date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
      $("vaMonth").innerHTML = `<option value="">All months</option>` + months.map((m) => `<option>${m}</option>`).join("");
      $("vaStatus").textContent = "PRIVATE · STAFF ONLY";
      render();
    } catch (e) { $("vaStatus").textContent = e.message; }
  }

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-dl]"); if (!btn) return;
    btn.disabled = true; const label = btn.textContent; btn.textContent = "Signing…";
    try { const { url } = await api("?download=" + encodeURIComponent(btn.dataset.dl)); window.location.assign(url); }
    catch (e) { alert(e.message); }
    finally { btn.disabled = false; btn.textContent = label; }
  });
  document.addEventListener("input", (ev) => { if (ev.target.id === "vaSearch" || ev.target.id === "vaMonth") render(); });
  window.addEventListener("vvhl-auth-change", load);
  window.VodArchive = { load, _setFiles: (f, d) => { files = f; downloadsEnabled = d; render(); } };
  if (document.readyState !== "loading") setTimeout(load, 0); else document.addEventListener("DOMContentLoaded", () => setTimeout(load, 0));
})();
