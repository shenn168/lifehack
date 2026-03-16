const STORAGE_KEY = "heartRiskAssessments";

async function getAssessments() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const list = result[STORAGE_KEY] || [];
  return list.sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function saveAssessment(record) {
  const records = await getAssessments();
  records.push(record);
  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
  return records;
}

async function deleteAssessment(id) {
  const records = await getAssessments();
  const filtered = records.filter(r => r.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  return filtered;
}

async function clearAssessments() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

async function replaceAssessments(records) {
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
}