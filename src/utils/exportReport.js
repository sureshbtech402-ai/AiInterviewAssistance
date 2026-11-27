export function downloadInterviewSheet(history = [], meta = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    alert("No interview Q&A found to download yet.");
    return;
  }

  const escapeCSV = (value) => {
    const str = String(value ?? "")
      .replace(/\*\*/g, "") // remove markdown bold markers for cleaner reading
      .replace(/\r?\n/g, "\r\n"); // keep line breaks intact inside Excel cells
    return `"${str.replace(/"/g, '""')}"`;
  };

  const today = new Date().toISOString().slice(0, 10);
  const candidate = meta.candidateName || "Candidate";
  const company = meta.company || "Interview";

  const rows = [
    ["Candidate", candidate],
    ["Company", company],
    ["Date", today],
    ["Total Questions", history.length],
    [], // blank separator row
    ["S.No", "Question", "Answer"],
  ];

  history.forEach((item, index) => {
    const q = item.question || item.q || item.prompt || "";
    const a = item.answer || item.a || item.response || "";
    rows.push([index + 1, q, a]);
  });

  const csvContent =
    "\uFEFF" + // UTF-8 BOM so Excel renders symbols & quotes cleanly
    rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const safeCompany = company.replace(/[^a-z0-9]/gi, "_");
  link.href = url;
  link.download = `Interview_QA_${safeCompany}_${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}