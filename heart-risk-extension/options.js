function getBandClass(label) {
  if (label.startsWith("Low")) return "low";
  if (label.startsWith("Mild")) return "mild";
  if (label.startsWith("Moderate")) return "moderate";
  if (label.startsWith("High")) return "high";
  if (label.startsWith("Very")) return "veryhigh";
  return "neutral";
}

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url,
    filename,
    saveAs: true
  });
}

function recordsToCsv(records) {
  const headers = [
    "date",
    "apob_value",
    "apob_unit",
    "apob_points",
    "lpa_value",
    "lpa_unit",
    "lpa_points",
    "hscrp_value",
    "hscrp_unit",
    "hscrp_points",
    "weighted_score_raw",
    "weighted_score_100",
    "risk_band",
    "delta_from_previous",
    "trend_label",
    "warnings",
    "notes",
    "created_at"
  ];

  const rows = records.map(r => [
    r.date,
    r.apob.value,
    r.apob.unit,
    r.apob.points,
    r.lpa.value,
    r.lpa.unit,
    r.lpa.points,
    r.hscrp.value,
    r.hscrp.unit,
    r.hscrp.points,
    r.weightedScoreRaw,
    r.weightedScore100,
    `"${(r.riskBand || "").replace(/"/g, '""')}"`,
    r.deltaFromPrevious ?? "",
    `"${(r.trendLabel || "").replace(/"/g, '""')}"`,
    `"${(r.warnings || []).join(" | ").replace(/"/g, '""')}"`,
    `"${(r.notes || "").replace(/"/g, '""')}"`,
    r.createdAt
  ]);

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

function renderSummary(records) {
  const latest = records.length ? records[records.length - 1] : null;
  const scores = records.map(r => r.weightedScore100);

  document.getElementById("countAssessments").textContent = records.length;
  document.getElementById("averageScore").textContent = scores.length ? average(scores) : "--";
  document.getElementById("bestScore").textContent = scores.length ? Math.min(...scores) : "--";
  document.getElementById("worstScore").textContent = scores.length ? Math.max(...scores) : "--";

  const latestScoreEl = document.getElementById("dashboardLatestScore");
  const latestBandEl = document.getElementById("dashboardLatestBand");

  if (!latest) {
    latestScoreEl.textContent = "--";
    latestBandEl.textContent = "No data yet";
    latestBandEl.className = "score-band neutral";
    return;
  }

  latestScoreEl.textContent = latest.weightedScore100;
  latestBandEl.textContent = latest.riskBand;
  latestBandEl.className = `score-band ${getBandClass(latest.riskBand)}`;
}

function renderHistory(records) {
  const wrap = document.getElementById("historyTableWrap");

  if (!records.length) {
    wrap.innerHTML = `<div class="empty-state">No assessments saved yet.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Score</th>
          <th>Band</th>
          <th>Trend</th>
          <th>ApoB</th>
          <th>Lp(a)</th>
          <th>hs-CRP</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${records.map(r => `
          <tr>
            <td>${r.date}</td>
            <td>${r.weightedScore100}</td>
            <td>${r.riskBand}</td>
            <td>${r.deltaFromPrevious === null ? "Baseline" : `${r.trendLabel} (${r.deltaFromPrevious > 0 ? "+" : ""}${r.deltaFromPrevious})`}</td>
            <td>${r.apob.value} ${r.apob.unit}</td>
            <td>${r.lpa.value} ${r.lpa.unit}</td>
            <td>${r.hscrp.value} ${r.hscrp.unit}</td>
            <td><button class="row-btn" data-id="${r.id}">Delete</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll(".row-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this assessment?")) return;
      await deleteAssessment(id);
      await refreshDashboard();
    });
  });
}

async function refreshDashboard() {
  const records = await getAssessments();
  renderSummary(records);
  renderHistory(records);
  drawTrendChart("trendCanvas", records);
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("exportCsvBtn").addEventListener("click", async () => {
    const records = await getAssessments();
    const csv = recordsToCsv(records);
    downloadCsv("heart_marker_risk_tracker.csv", csv);
  });

  document.getElementById("clearAllBtn").addEventListener("click", async () => {
    const ok = confirm("This will permanently clear all locally stored assessments. Continue?");
    if (!ok) return;
    await clearAssessments();
    await refreshDashboard();
  });

  await refreshDashboard();
});