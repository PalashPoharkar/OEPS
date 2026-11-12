export function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? "").replace(/"/g, '""');
        return `"${val}"`;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function downloadPDF(rows, title, filename) {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

    doc.autoTable({
      startY: 36,
      head: [headers],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 197, 94] },
    });
  }

  doc.save(filename);
}

export async function downloadStudentResultPDF(result) {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(result.exam_title || "Exam Result", 14, 22);
  doc.setFontSize(12);
  doc.text(`Score: ${result.score}/${result.total_marks} (${result.percentage}%)`, 14, 32);
  doc.text(`Status: ${result.passed ? "PASSED" : "FAILED"}`, 14, 40);
  doc.setFontSize(10);
  doc.text(`Date: ${new Date(result.created_at).toLocaleDateString()}`, 14, 48);

  if (Array.isArray(result.results) && result.results.length > 0) {
    const body = result.results.map((q, i) => [
      `Q${i + 1}`,
      (q.question || "").substring(0, 60),
      q.studentAnswer || "—",
      q.correctAnswer || "—",
      q.correct ? "Correct" : "Wrong",
    ]);

    doc.autoTable({
      startY: 56,
      head: [["#", "Question", "Your Answer", "Correct Answer", "Result"]],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] },
      columnStyles: { 1: { cellWidth: 70 } },
    });
  }

  doc.save(`${result.exam_title || "result"}.pdf`);
}
