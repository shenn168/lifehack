function $(id) {
  return document.getElementById(id);
}

function getBandClass(label) {
  if (label.startsWith("Low")) return "low";
  if (label.startsWith("Mild")) return "mild";
  if (label.startsWith("Moderate")) return "moderate";
  if (label.startsWith("High")) return "high";
  if (label.startsWith("Very")) return "veryhigh";
  return "neutral";
}

function todayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function refreshLatestSummary() {
  const records = await getAssessments();
  const latest = records.length ? records[records.length - 1] : null;

  if (!latest) {
    $("latestScore").textContent = "--";
    $("latestBand").textContent = "No data yet";
    $("latestBand").className = "band-pill neutral";
    $("latestTrend").textContent = "Enter your first assessment";
    return;
  }

  $("latestScore").textContent = latest.weightedScore100;
  $("latestBand").textContent = latest.riskBand;
  $("latestBand").className = `band-pill ${getBandClass(latest.riskBand)}`;

  const trendText = latest.deltaFromPrevious === null
    ? `Baseline assessment on ${latest.date}`
    : `${latest.trendLabel} (${latest.deltaFromPrevious > 0 ? "+" : ""}${latest.deltaFromPrevious}) since previous`;

  $("latestTrend").textContent = trendText;
}

function readForm() {
  return {
    date: $("date").value,
    apobValue: $("apobValue").value,
    apobUnit: $("apobUnit").value,
    lpaValue: $("lpaValue").value,
    lpaUnit: $("lpaUnit").value,
    hscrpValue: $("hscrpValue").value,
    hscrpUnit: $("hscrpUnit").value,
    notes: $("notes").value.trim()
  };
}

function validateInput(input) {
  if (!input.date) return "Please enter a test date.";
  if (input.apobValue === "") return "Please enter ApoB.";
  if (input.lpaValue === "") return "Please enter Lp(a).";
  if (input.hscrpValue === "") return "Please enter hs-CRP.";

  const apob = Number(input.apobValue);
  const lpa = Number(input.lpaValue);
  const hscrp = Number(input.hscrpValue);

  if (Number.isNaN(apob) || apob < 0) return "ApoB must be a non-negative number.";
  if (Number.isNaN(lpa) || lpa < 0) return "Lp(a) must be a non-negative number.";
  if (Number.isNaN(hscrp) || hscrp < 0) return "hs-CRP must be a non-negative number.";

  return null;
}

function renderResult(assessment) {
  const panel = $("resultPanel");
  const warningsHtml = assessment.warnings.length
    ? `<ul class="warning-list">${assessment.warnings.map(w => `<li>${w}</li>`).join("")}</ul>`
    : "";

  panel.innerHTML = `
    <div>
      <strong>Calculated Score: ${assessment.weightedScore100}</strong>
      <div class="small-muted">${assessment.riskBand}</div>
    </div>

    <div class="result-grid">
      <div class="metric-box">
        <div class="metric-title">ApoB Points</div>
        <div class="metric-value">${assessment.apob.points}</div>
      </div>
      <div class="metric-box">
        <div class="metric-title">Lp(a) Points</div>
        <div class="metric-value">${assessment.lpa.points}</div>
      </div>
      <div class="metric-box">
        <div class="metric-title">hs-CRP Points</div>
        <div class="metric-value">${assessment.hscrp.points}</div>
      </div>
      <div class="metric-box">
        <div class="metric-title">Trend</div>
        <div class="metric-value" style="font-size:14px;">${assessment.trendLabel}</div>
      </div>
    </div>

    ${warningsHtml}
  `;
  panel.classList.remove("hidden");
}

async function calculatePreview() {
  const input = readForm();
  const error = validateInput(input);
  if (error) {
    alert(error);
    return null;
  }

  const records = await getAssessments();
  const previousRecord = records.length ? records[records.length - 1] : null;
  const assessment = calculateAssessment(input, previousRecord);
  renderResult(assessment);
  return assessment;
}

async function saveCurrentAssessment() {
  const assessment = await calculatePreview();
  if (!assessment) return;

  await saveAssessment(assessment);
  await refreshLatestSummary();
  alert("Assessment saved.");
}

document.addEventListener("DOMContentLoaded", async () => {
  $("date").value = todayString();

  $("calculateBtn").addEventListener("click", calculatePreview);
  $("saveBtn").addEventListener("click", saveCurrentAssessment);
  $("openDashboardBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());

  await refreshLatestSummary();
});