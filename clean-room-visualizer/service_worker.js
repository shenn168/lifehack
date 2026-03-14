import { TRACKER_DOMAINS } from "./trackerlist.js";

const TAB_STATE = new Map();
// tabId -> {
//   pageHost: string,
//   pageSiteKey: string, // registrable-domain-ish
//   firstPartyHosts: Set<string>,
//   thirdPartyCounts: Map<string, number>,
//   trackerHits: Set<string>,
//   blockedCount: number
// }

const QUIET_MODE_KEY = "quietModeBySiteKey"; // { [siteKey]: true/false }

function safeUrl(url) {
  try { return new URL(url); } catch { return null; }
}

function getSiteKey(hostname) {
  // Lightweight heuristic (not true eTLD+1).
  const parts = (hostname || "").split(".").filter(Boolean);
  if (parts.length <= 2) return hostname || "";
  return parts.slice(-2).join(".");
}

function isThirdParty(pageHost, requestHost) {
  const a = getSiteKey(pageHost);
  const b = getSiteKey(requestHost);
  return a && b && a !== b;
}

function ensureTabState(tabId) {
  if (!TAB_STATE.has(tabId)) {
    TAB_STATE.set(tabId, {
      pageHost: "",
      pageSiteKey: "",
      firstPartyHosts: new Set(),
      thirdPartyCounts: new Map(),
      trackerHits: new Set(),
      blockedCount: 0
    });
  }
  return TAB_STATE.get(tabId);
}

function isTrackerDomain(host) {
  return TRACKER_DOMAINS.some(d => host === d || host.endsWith("." + d));
}

async function getQuietModeMap() {
  const obj = await chrome.storage.local.get(QUIET_MODE_KEY);
  return obj[QUIET_MODE_KEY] || {};
}

async function setQuietModeForSiteKey(siteKey, enabled) {
  const map = await getQuietModeMap();
  map[siteKey] = enabled;
  await chrome.storage.local.set({ [QUIET_MODE_KEY]: map });
}

function hashToInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function baseRuleId(siteKey) {
  // Keep per-siteKey in a stable ID range.
  return (hashToInt(siteKey) % 1000000) * 1000;
}

async function applyQuietModeRulesForSiteKey(siteKey, enabled) {
  const base = baseRuleId(siteKey);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();

  const removeRuleIds = [];
  for (const r of existing) {
    if (r.id >= base && r.id < base + 900) removeRuleIds.push(r.id);
  }

  const addRules = [];
  if (enabled) {
    TRACKER_DOMAINS.forEach((domain, idx) => {
      addRules.push({
        id: base + idx + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          requestDomains: [domain],
          // IMPORTANT: use siteKey (registrable-ish), not full hostname
          initiatorDomains: [siteKey],
          resourceTypes: [
            "main_frame",
            "sub_frame",
            "script",
            "xmlhttprequest",
            "image",
            "font",
            "stylesheet",
            "media",
            "websocket",
            "ping",
            "other"
          ]
        }
      });
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const map = await getQuietModeMap();
  await chrome.storage.local.set({ [QUIET_MODE_KEY]: map });
});

chrome.tabs.onRemoved.addListener((tabId) => TAB_STATE.delete(tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !tab?.url) return;
  const u = safeUrl(tab.url);
  if (!u) return;

  const st = ensureTabState(tabId);
  st.pageHost = u.hostname;
  st.pageSiteKey = getSiteKey(u.hostname);
  st.firstPartyHosts = new Set([u.hostname]);
  st.thirdPartyCounts = new Map();
  st.trackerHits = new Set();
  st.blockedCount = 0;
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;

    const st = ensureTabState(details.tabId);
    const requestUrl = safeUrl(details.url);
    if (!requestUrl) return;

    if (!st.pageHost) {
      const init = details.initiator ? safeUrl(details.initiator) : null;
      const doc = details.documentUrl ? safeUrl(details.documentUrl) : null;
      const host = init?.hostname || doc?.hostname || "";
      st.pageHost = host;
      st.pageSiteKey = getSiteKey(host);
    }

    const reqHost = requestUrl.hostname;
    if (!reqHost || !st.pageHost) return;

    if (isThirdParty(st.pageHost, reqHost)) {
      const prev = st.thirdPartyCounts.get(reqHost) || 0;
      st.thirdPartyCounts.set(reqHost, prev + 1);
      if (isTrackerDomain(reqHost)) st.trackerHits.add(reqHost);
    } else {
      st.firstPartyHosts.add(reqHost);
    }
  },
  { urls: ["<all_urls>"] }
);

// Count actual blocks (so UI isn't lying)
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  const tabId = info?.request?.tabId;
  if (typeof tabId !== "number" || tabId < 0) return;
  const st = ensureTabState(tabId);
  st.blockedCount += 1;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_TAB_SUMMARY") {
      const tabId = msg.tabId;
      const st = ensureTabState(tabId);

      const thirdParty = Array.from(st.thirdPartyCounts.entries())
        .map(([domain, count]) => ({ domain, count, tracker: isTrackerDomain(domain) }))
        .sort((a, b) => b.count - a.count);

      const D = thirdParty.length;
      const T = st.trackerHits.size;
      const C = 0; // cookies not tracked in this MVP

      const score = Math.max(
        0,
        100 - Math.min(60, 8 * D) - Math.min(30, 2 * T) - Math.min(20, C)
      );

      const siteHost = st.pageHost || "";
      const siteKey = st.pageSiteKey || getSiteKey(siteHost);

      const qmMap = await getQuietModeMap();
      const quietEnabled = !!qmMap[siteKey];

      sendResponse({
        ok: true,
        siteHost,
        siteKey,
        score,
        firstPartyCount: st.firstPartyHosts.size,
        thirdPartyCount: D,
        trackerCount: T,
        blockedCount: st.blockedCount,
        quietEnabled,
        thirdParty
      });
      return;
    }

    if (msg?.type === "TOGGLE_QUIET_MODE") {
      const siteKey = msg.siteKey;
      const enabled = !!msg.enabled;

      if (!siteKey) {
        sendResponse({ ok: false, error: "Missing siteKey" });
        return;
      }

      await setQuietModeForSiteKey(siteKey, enabled);
      await applyQuietModeRulesForSiteKey(siteKey, enabled);

      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message" });
  })();

  return true;
});