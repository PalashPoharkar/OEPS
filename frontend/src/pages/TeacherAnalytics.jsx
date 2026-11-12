import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import { api } from "../services/apiclient";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { downloadCSV, downloadPDF } from "../utils/exportUtils";

const CHART_COLORS = ["#22C55E", "#DC2626", "#3B82F6", "#F59E0B", "#8B5CF6"];

export default function TeacherAnalytics() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const COLORS = CHART_COLORS;

  const [stats, setStats] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examDetail, setExamDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get("/api/exams/teacher-stats").then((res) => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadExamDetail = async (examTitle) => {
    // Find exam from stats
    const exam = stats?.examScores?.find((e) => e.title === examTitle);
    if (!exam) return;

    // We need the exam ID. Let's fetch exams first
    setDetailLoading(true);
    try {
      const examsRes = await api.get("/api/exams/mine");
      const exams = examsRes.data?.data || examsRes.data || [];
      const found = exams.find((e) => e.title === examTitle);
      if (!found) { setDetailLoading(false); return; }

      const res = await api.get(`/api/exams/${found.id}/analytics`);
      setExamDetail({ ...res.data, examId: found.id });
      setSelectedExam(examTitle);
    } catch {
      // ignore
    }
    setDetailLoading(false);
  };

  const handleExport = async (format) => {
    if (!examDetail?.examId) return;
    setExporting(true);
    try {
      const res = await api.get(`/api/exams/${examDetail.examId}/export-results`);
      const results = res.data || [];
      const rows = results.map((r) => ({
        "Student Name": r.student_name,
        "Email": r.student_email,
        "Score": r.score,
        "Total Marks": r.total_marks,
        "Percentage": r.percentage + "%",
        "Status": r.passed ? "Passed" : "Failed",
        "Date": new Date(r.created_at).toLocaleDateString(),
      }));
      if (format === "csv") {
        downloadCSV(rows, `${selectedExam}_results.csv`);
      } else {
        downloadPDF(rows, selectedExam, `${selectedExam}_results.pdf`);
      }
    } catch {
      // ignore
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="themed-page" style={styles.page}>
        <div style={styles.container}>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40 }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  const passFailData = stats ? [
    { name: "Passed", value: stats.passRate },
    { name: "Failed", value: 100 - stats.passRate },
  ] : [];

  return (
    <div className="themed-page" style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <button onClick={() => navigate("/teacher")} style={styles.backBtn}>
              <i className="fas fa-arrow-left"></i> Dashboard
            </button>
          </div>
          <h1 style={styles.title}>Analytics</h1>
          <button onClick={logout} style={styles.logoutBtn}>Sign Out</button>
        </div>

        {/* Stats Cards */}
        <div style={styles.statsGrid}>
          {[
            { label: "Total Exams", value: stats?.totalExams || 0, icon: "fa-file-alt" },
            { label: "Total Attempts", value: stats?.totalStudents || 0, icon: "fa-users" },
            { label: "Avg Score", value: `${stats?.avgScore || 0}%`, icon: "fa-chart-line" },
            { label: "Pass Rate", value: `${stats?.passRate || 0}%`, icon: "fa-check-circle" },
          ].map((s) => (
            <div key={s.label} style={styles.statCard}>
              <i className={`fas ${s.icon}`} style={{ fontSize: 20, color: "var(--primary)", marginBottom: 8 }}></i>
              <div style={styles.statValue}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div style={styles.chartsRow}>
          {/* Exam-wise Avg Scores */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Exam-wise Average Scores</h3>
            {stats?.examScores?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.examScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="avgScore" fill="#22C55E" radius={[6, 6, 0, 0]} cursor="pointer"
                    onClick={(data) => loadExamDetail(data.title)} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>No exam data yet</p>
            )}
            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
              Click a bar to see detailed analytics
            </p>
          </div>

          {/* Pass/Fail Pie */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Overall Pass/Fail Rate</h3>
            {stats?.totalStudents > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={passFailData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                    {passFailData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>No attempts yet</p>
            )}
          </div>
        </div>

        {/* Exam Detail Drill-Down */}
        {detailLoading && (
          <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20 }}>Loading exam details...</p>
        )}

        {examDetail && !detailLoading && (
          <div style={styles.detailSection}>
            <div style={styles.detailHeader}>
              <h2 style={styles.detailTitle}>
                {examDetail.exam?.title}
                <span style={styles.detailBadge}>{examDetail.totalAttempts} attempts</span>
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleExport("csv")} disabled={exporting} style={styles.exportBtn}>
                  <i className="fas fa-file-csv"></i> Export CSV
                </button>
                <button onClick={() => handleExport("pdf")} disabled={exporting} style={{ ...styles.exportBtn, background: "var(--danger)" }}>
                  <i className="fas fa-file-pdf"></i> Export PDF
                </button>
              </div>
            </div>

            <div style={styles.detailStats}>
              <div style={styles.miniStat}>
                <span style={styles.miniLabel}>Avg Score</span>
                <span style={styles.miniValue}>{examDetail.avgScore}%</span>
              </div>
              <div style={styles.miniStat}>
                <span style={styles.miniLabel}>Pass Rate</span>
                <span style={styles.miniValue}>{examDetail.passRate}%</span>
              </div>
              <div style={styles.miniStat}>
                <span style={styles.miniLabel}>Attempts</span>
                <span style={styles.miniValue}>{examDetail.totalAttempts}</span>
              </div>
            </div>

            <div style={styles.chartsRow}>
              {/* Score Distribution */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Score Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={examDetail.distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Question-wise Accuracy */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Question-wise Accuracy</h3>
                {examDetail.questionAccuracy?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={examDetail.questionAccuracy}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="question" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="accuracy" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 40 }}>No question data</p>
                )}
              </div>
            </div>

            {/* Violation Stats */}
            {examDetail.violationStats?.length > 0 && (
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Violation Statistics</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={examDetail.violationStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="type" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#DC2626" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", padding: 16, color: "var(--text-primary)" },
  container: { maxWidth: 1100, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  title: { fontSize: 24, fontWeight: 700, color: "var(--text-primary)" },
  backBtn: { padding: "8px 16px", background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "var(--text-primary)" },
  logoutBtn: { padding: "8px 16px", background: "var(--danger)", color: "var(--text-on-danger)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 },
  statCard: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", borderRadius: 12, padding: 20, border: "1px solid var(--glass-border)", textAlign: "center", boxShadow: "var(--glass-shadow)" },
  statValue: { fontSize: 28, fontWeight: 700, color: "var(--text-primary)" },
  statLabel: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4 },
  chartsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 24 },
  chartCard: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", borderRadius: 12, padding: 20, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  chartTitle: { fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 },
  detailSection: { marginTop: 16 },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 },
  detailTitle: { fontSize: 20, fontWeight: 700, color: "var(--text-primary)" },
  detailBadge: { marginLeft: 12, fontSize: 12, background: "var(--info-light)", color: "var(--info-light-text)", padding: "4px 12px", borderRadius: 20, fontWeight: 500 },
  exportBtn: { padding: "8px 16px", background: "var(--primary)", color: "var(--text-on-primary)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  detailStats: { display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" },
  miniStat: { display: "flex", flexDirection: "column" },
  miniLabel: { fontSize: 12, color: "var(--text-secondary)" },
  miniValue: { fontSize: 20, fontWeight: 700, color: "var(--text-primary)" },
};
