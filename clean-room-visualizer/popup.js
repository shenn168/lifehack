async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function colorizeScore(scoreEl, score) {
  scoreEl.textContent = String(score);
  if (score >= 80) scoreEl.style.color = "var(--good)";
  else if (score >= 50) scoreEl.style.color = "var(--warn)";
  else scoreEl.style.color = "var(--bad)";
}

function renderList(listEl, items) {
  listEl.innerHTML = "";

  if (!items || items.length === 0) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = "No third-party requests captured yet. Refresh after the page loads.";
    listEl.appendChild(div);
    return;
  }

  for (const it of items.slice(0, 40)) {
    const row = document.createElement("div");
    row.className = "item";

    const left = document.createElement("div");
    left.className = "left";

    const domain = document.createElement("div");
    domain.className = "domain";
    domain.textContent = it.domain;

    const meta = document.createElement("div");
    meta.className = "meta";

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "3rd-party";
    meta.appendChild(chip);

    if (it.tracker) {
      const trk = document.createElement("span");
      trk.className = "chip tracker";
      trk.textContent = "tracker";
      meta.appendChild(trk);
    }

    left.appendChild(domain);
    left.appendChild(meta);

    const count = document.createElement("div");
    count.className = "count";
    count.textContent = String(it.count);

    row.appendChild(left);
    row.appendChild(count);
    listEl.appendChild(row);
  }
}

async function getSummary() {
  const tab = await getCurrentTab();
  if (!tab?.id) return null;
  return await chrome.runtime.sendMessage({ type: "GET_TAB_SUMMARY", tabId: tab.id });
}

async function refresh() {
  const siteEl = document.getElementById("site");
  const scoreEl = document.getElementById("score");
  const fpEl = document.getElementById("fpCount");
  const tpEl = document.getElementById("tpCount");
  const trkEl = document.getElementById("trkCount");
  const listEl = document.getElementById("list");
  const toggle = document.getElementById("quietToggle");
  const hint = document.getElementById("quietHint");

  const res = await getSummary();
  if (!res?.ok) {
    siteEl.textContent = "Unavailable";
    listEl.innerHTML = `<div class="empty">Could not read tab summary.</div>`;
    toggle.disabled = true;
    return;
  }

  siteEl.textContent = res.siteHost || "—";
  colorizeScore(scoreEl, res.score);

  fpEl.textContent = String(res.firstPartyCount ?? "—");
  tpEl.textContent = String(res.thirdPartyCount ?? "—");
  trkEl.textContent = String(res.trackerCount ?? "—");

  renderList(listEl, res.thirdParty);

  toggle.disabled = !res.siteKey;
  toggle.checked = !!res.quietEnabled;

  if (!toggle.checked) {
    hint.textContent = "Off";
  } else {
    const blocked = res.blockedCount || 0;
    hint.textContent = blocked > 0 ? `On • ${blocked} blocked (this tab)` : "On • blocking enabled";
  }

  // stash siteKey for toggle handler
  toggle.dataset.siteKey = res.siteKey || "";
}

async function setQuietMode(enabled) {
  const toggle = document.getElementById("quietToggle");
  const siteKey = toggle.dataset.siteKey;

  if (!siteKey) return;

  await chrome.runtime.sendMessage({
    type: "TOGGLE_QUIET_MODE",
    siteKey,
    enabled
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const refreshBtn = document.getElementById("refresh");
  const toggle = document.getElementById("quietToggle");
  const hint = document.getElementById("quietHint");

  refreshBtn.addEventListener("click", refresh);

  toggle.addEventListener("change", async (e) => {
    const enabled = e.target.checked;

    // optimistic UI
    hint.textContent = enabled ? "On • applying…" : "Off • applying…";

    await setQuietMode(enabled);

    // NOTE: blocking rules apply to subsequent requests.
    // For immediate effect, user may refresh page; we also refresh UI now.
    await refresh();
  });

  await refresh();
});