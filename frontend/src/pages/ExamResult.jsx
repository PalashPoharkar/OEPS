import { useLocation, useNavigate } from "react-router-dom";
import { downloadStudentResultPDF } from "../utils/exportUtils";

export default function ExamResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { exam, score, totalMarks, percentage, passed, results } =
    location.state || {};

  if (!results) {
    return (
      <div className="themed-page" style={styles.page}>
        <div style={styles.card}>
          <div style={styles.title}>No result data found</div>
          <button style={styles.backBtn} onClick={() => navigate("/student")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="themed-page" style={styles.page}>
      {/* SCORE CARD */}
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{exam?.title || "Exam"}</div>
            <div style={styles.subtitle}>Exam Completed</div>
          </div>
          <div
            style={{
              ...styles.badge,
              background: passed ? "var(--primary-light)" : "var(--danger-light)",
              color: passed ? "var(--primary-light-text)" : "var(--danger-light-text)",
            }}
          >
            {passed ? "PASSED" : "FAILED"}
          </div>
        </div>

        {/* Score display */}
        <div style={styles.scoreSection}>
          <div style={styles.scoreCircle}>
            <div
              style={{
                ...styles.scorePercent,
                color: passed ? "var(--primary)" : "var(--danger)",
              }}
            >
              {percentage}%
            </div>
            <div style={styles.scoreLabel}>Score</div>
          </div>

          <div style={styles.statsRow}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{score}</div>
              <div style={styles.statLabel}>Marks Obtained</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{totalMarks}</div>
              <div style={styles.statLabel}>Total Marks</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>
                {results.filter((r) => r.correct).length}
              </div>
              <div style={styles.statLabel}>Correct</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>
                {results.filter((r) => !r.correct).length}
              </div>
              <div style={styles.statLabel}>Wrong / Skipped</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={styles.backBtn} onClick={() => navigate("/student")}>
            Back to Dashboard
          </button>
          <button
            style={{ ...styles.backBtn, background: "var(--danger)", color: "var(--text-on-danger)" }}
            onClick={() => downloadStudentResultPDF({
              exam_title: exam?.title || "Exam",
              score, total_marks: totalMarks, percentage, passed,
              results, created_at: new Date().toISOString(),
            })}
          >
            <i className="fas fa-file-pdf"></i> Download PDF
          </button>
        </div>
      </div>

      {/* QUESTION BREAKDOWN */}
      <div style={styles.breakdownCard}>
        <div style={styles.breakdownTitle}>Question Breakdown</div>

        {results.map((r, i) => (
          <div
            key={i}
            style={{
              ...styles.questionRow,
              borderLeft: `4px solid ${r.correct ? "var(--primary)" : "var(--danger)"}`,
            }}
          >
            <div style={styles.questionTop}>
              <span style={styles.questionNum}>Q{i + 1}</span>
              <span
                style={{
                  ...styles.questionBadge,
                  background: r.correct ? "var(--primary-light)" : "var(--danger-light)",
                  color: r.correct ? "var(--primary-light-text)" : "var(--danger-light-text)",
                }}
              >
                {r.correct ? `+${r.marks}` : r.studentAnswer ? "0" : "Skipped"}
              </span>
            </div>

            <div style={styles.questionText}>{r.question}</div>

            <div style={styles.answerRow}>
              {r.studentAnswer ? (
                <span
                  style={{
                    ...styles.answerTag,
                    background: r.correct ? "var(--primary-light)" : "var(--danger-light)",
                    color: r.correct ? "var(--primary-light-text)" : "var(--danger-light-text)",
                  }}
                >
                  Your answer: {r.studentAnswer}
                </span>
              ) : (
                <span
                  style={{
                    ...styles.answerTag,
                    background: "var(--bg-card-nested)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Not answered
                </span>
              )}
              {!r.correct && (
                <span
                  style={{
                    ...styles.answerTag,
                    background: "var(--primary-light)",
                    color: "var(--primary-light-text)",
                  }}
                >
                  Correct: {r.correctAnswer}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */
const styles = {
  page: {
    minHeight: "100vh",
    padding: 16,
    maxWidth: 720,
    margin: "0 auto",
    color: "var(--text-primary)",
  },
  card: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 16,
    border: "1px solid var(--glass-border)",
    padding: 28,
    marginBottom: 16,
    boxShadow: "var(--glass-shadow)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: 800, color: "var(--text-primary)" },
  subtitle: { fontSize: 14, color: "var(--text-secondary)", marginTop: 2 },
  badge: {
    padding: "6px 16px",
    borderRadius: 20,
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 1,
  },
  savingBanner: {
    background: "var(--warning-light)",
    color: "var(--warning-light-text)",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  errorBanner: {
    background: "var(--danger-light)",
    color: "var(--danger-light-text)",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  successBanner: {
    background: "var(--primary-light)",
    color: "var(--primary-light-text)",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  scoreSection: { textAlign: "center", marginBottom: 24 },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: "50%",
    border: "6px solid var(--border-default)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  scorePercent: { fontSize: 36, fontWeight: 900, lineHeight: 1 },
  scoreLabel: { fontSize: 13, color: "var(--text-secondary)", fontWeight: 600, marginTop: 2 },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
  },
  statBox: {
    background: "var(--bg-card-nested)",
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border-light)",
  },
  statValue: { fontSize: 20, fontWeight: 800, color: "var(--text-primary)" },
  statLabel: { fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginTop: 2 },
  backBtn: {
    background: "var(--primary)",
    border: "none",
    padding: "12px 28px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    color: "var(--text-on-primary)",
    fontSize: 14,
    width: "100%",
  },
  breakdownCard: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 16,
    border: "1px solid var(--glass-border)",
    padding: 24,
    boxShadow: "var(--glass-shadow)",
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text-primary)",
    marginBottom: 16,
  },
  questionRow: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 10,
    background: "var(--bg-card-nested)",
  },
  questionTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  questionNum: { fontWeight: 800, fontSize: 13, color: "var(--text-secondary)" },
  questionBadge: {
    padding: "3px 10px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 12,
  },
  questionText: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
    marginBottom: 8,
    lineHeight: 1.4,
  },
  answerRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  answerTag: {
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
};