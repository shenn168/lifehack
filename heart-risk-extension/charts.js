function drawTrendChart(canvasId, records) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#fff7f8";
  ctx.fillRect(0, 0, width, height);

  if (!records || records.length === 0) {
    ctx.fillStyle = "#8b5e68";
    ctx.font = "14px sans-serif";
    ctx.fillText("No data yet", 20, 40);
    return;
  }

  const padding = 36;
  const scores = records.map(r => r.weightedScore100);
  const minY = 0;
  const maxY = 100;

  ctx.strokeStyle = "#e7c9cf";
  ctx.lineWidth = 1;

  for (let y = 0; y <= 100; y += 20) {
    const py = padding + ((maxY - y) / (maxY - minY)) * (height - padding * 2);
    ctx.beginPath();
    ctx.moveTo(padding, py);
    ctx.lineTo(width - padding, py);
    ctx.stroke();

    ctx.fillStyle = "#9c6b74";
    ctx.font = "11px sans-serif";
    ctx.fillText(String(y), 8, py + 4);
  }

  if (records.length === 1) {
    const x = width / 2;
    const y = padding + ((maxY - scores[0]) / (maxY - minY)) * (height - padding * 2);

    ctx.fillStyle = "#d6336c";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const stepX = (width - padding * 2) / (records.length - 1);

  ctx.strokeStyle = "#d6336c";
  ctx.lineWidth = 3;
  ctx.beginPath();

  records.forEach((record, index) => {
    const x = padding + index * stepX;
    const y = padding + ((maxY - record.weightedScore100) / (maxY - minY)) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  records.forEach((record, index) => {
    const x = padding + index * stepX;
    const y = padding + ((maxY - record.weightedScore100) / (maxY - minY)) * (height - padding * 2);

    ctx.fillStyle = "#d6336c";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7a4b55";
    ctx.font = "10px sans-serif";
    const label = record.date.slice(5);
    ctx.fillText(label, x - 14, height - 10);
  });
}