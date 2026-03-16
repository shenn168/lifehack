function getApoBPoints(value) {
  if (value < 70) return 0;
  if (value <= 89) return 1;
  if (value <= 109) return 2;
  if (value <= 129) return 3;
  return 4;
}

function getLpaPoints(value, unit) {
  if (unit === "mg/dL") {
    if (value < 30) return 0;
    if (value <= 49) return 1;
    if (value <= 99) return 2;
    if (value <= 149) return 3;
    return 4;
  }

  if (unit === "nmol/L") {
    if (value < 75) return 0;
    if (value <= 124) return 1;
    if (value <= 249) return 2;
    if (value <= 374) return 3;
    return 4;
  }

  throw new Error("Unsupported Lp(a) unit.");
}

function getHsCrpPoints(value) {
  if (value < 1.0) return 0;
  if (value <= 2.9) return 1;
  if (value <= 4.9) return 2;
  if (value <= 9.9) return 3;
  return 4;
}

function calculateWeightedScore(apobPoints, lpaPoints, hscrpPoints) {
  const raw = 0.50 * apobPoints + 0.30 * lpaPoints + 0.20 * hscrpPoints;
  const score100 = Math.round((raw / 4.0) * 100);
  return { raw, score100 };
}

function getRiskBand(score100) {
  if (score100 < 20) return "Low biomarker risk";
  if (score100 < 40) return "Mildly elevated biomarker risk";
  if (score100 < 60) return "Moderate biomarker risk";
  if (score100 < 80) return "High biomarker risk";
  return "Very high biomarker risk";
}

function getTrendLabel(delta) {
  if (delta <= -10) return "Improving significantly";
  if (delta <= -3) return "Improving";
  if (delta < 3) return "Stable";
  if (delta < 10) return "Worsening";
  return "Worsening significantly";
}

function buildWarnings({ lpaValue, lpaUnit, hscrpValue, previousRecord }) {
  const warnings = [];

  if (hscrpValue >= 10) {
    warnings.push("hs-CRP is at or above 10 mg/L. Possible acute inflammation or infection; consider repeat testing before cardiovascular interpretation.");
  }

  if (previousRecord && previousRecord.lpa && previousRecord.lpa.unit === lpaUnit) {
    const prior = previousRecord.lpa.value;
    const change = Math.abs(lpaValue - prior);
    if (
      (lpaUnit === "mg/dL" && change >= 30) ||
      (lpaUnit === "nmol/L" && change >= 75)
    ) {
      warnings.push("Large Lp(a) change detected. Verify assay method and unit consistency.");
    }
  }

  return warnings;
}

function calculateAssessment(input, previousRecord = null) {
  const apobPoints = getApoBPoints(Number(input.apobValue));
  const lpaPoints = getLpaPoints(Number(input.lpaValue), input.lpaUnit);
  const hscrpPoints = getHsCrpPoints(Number(input.hscrpValue));

  const score = calculateWeightedScore(apobPoints, lpaPoints, hscrpPoints);
  const riskBand = getRiskBand(score.score100);

  const previousScore = previousRecord ? previousRecord.weightedScore100 : null;
  const deltaFromPrevious = previousScore === null ? null : score.score100 - previousScore;
  const trendLabel = deltaFromPrevious === null ? "Baseline" : getTrendLabel(deltaFromPrevious);

  const warnings = buildWarnings({
    lpaValue: Number(input.lpaValue),
    lpaUnit: input.lpaUnit,
    hscrpValue: Number(input.hscrpValue),
    previousRecord
  });

  return {
    id: crypto.randomUUID(),
    date: input.date,
    apob: {
      value: Number(input.apobValue),
      unit: input.apobUnit,
      points: apobPoints
    },
    lpa: {
      value: Number(input.lpaValue),
      unit: input.lpaUnit,
      points: lpaPoints
    },
    hscrp: {
      value: Number(input.hscrpValue),
      unit: input.hscrpUnit,
      points: hscrpPoints
    },
    weightedScoreRaw: Number(score.raw.toFixed(2)),
    weightedScore100: score.score100,
    riskBand,
    deltaFromPrevious,
    trendLabel,
    warnings,
    notes: input.notes || "",
    createdAt: new Date().toISOString()
  };
}