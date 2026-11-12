import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import { api } from "../services/apiclient";
import { fetchPublishedExams } from "../services/examService";
import { useIsMobile } from "../hooks/useMediaQuery";
import Pagination from "../Components/Pagination";
import { downloadStudentResultPDF } from "../utils/exportUtils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const CHART_COLORS = ["#22C55E", "#DC2626"];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const isMobile = useIsMobile();
  const COLORS = CHART_COLORS;

  const [profile, setProfile] = useState(null);
  const [exams, setExams] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const loadDashboard = async () => {
    if (!user) return;
    try {
      const { data: student } = await api.get("/api/students/me");
      setProfile(student);

      try {
        const published = await fetchPublishedExams();
        setExams(Array.isArray(published) ? published : []);
      } catch {
        setExams([]);
      }

      const { data: history } = await api.get("/api/students/results", { params: { page: historyPage, limit: 10 } });
      if (history?.data) {
        setExamHistory(history.data);
        setHistoryTotalPages(history.totalPages || 1);
      } else {
        setExamHistory(Array.isArray(history) ? history : []);
      }
    } catch (err) {
      console.log("Dashboard load error:", err.message);
    }
  };

  useEffect(() => {
    let alive = true;
    const run = async () => { if (alive) await loadDashboard(); };
    run();
    const interval = setInterval(run, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, [historyPage]);

  const isExamAvailable = (exam) => {
    if (!exam.start_time) return true;
    return new Date(exam.start_time) <= new Date();
  };

  const getTimeUntil = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  // Chart data from history
  const trendData = examHistory.map((r) => ({
    exam: (r.exam_title || "").substring(0, 15),
    percentage: r.percentage,
  }));

  const passCount = examHistory.filter((r) => r.passed).length;
  const failCount = examHistory.length - passCount;
  const pieData = examHistory.length > 0 ? [
    { name: "Passed", value: passCount },
    { name: "Failed", value: failCount },
  ] : [];

  return (
    <div className="themed-page" style={styles.page}>
      {/* HEADER */}
      <div style={{ ...styles.header, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <div style={styles.title}>Student Dashboard</div>
          <div style={styles.sub}>Welcome {profile?.name || "Student"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/profile")} style={styles.refreshBtn}>
            <i className="fas fa-user"></i> Profile
          </button>
          <button onClick={loadDashboard} style={styles.refreshBtn}>Refresh</button>
          <button onClick={() => { logout(); navigate("/login"); }} style={styles.signOutBtn}>Sign Out</button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ ...styles.stats, gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)" }}>
        <StatCard label="Total Exams" value={profile?.total_exams || 0} />
        <StatCard label="Passed Exams" value={profile?.passed_exams || 0} />
        <StatCard label="Grade" value={profile?.grade || "D"} />
      </div>

      {/* CHARTS */}
      {examHistory.length > 1 && (
        <div style={{ ...styles.chartsRow, gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr" }}>
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Score Trend</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="percentage" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Pass/Fail</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* EXAMS */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Published Exams</div>
        {exams.length === 0 ? (
          <div style={styles.empty}>No published exams.</div>
        ) : (
          <div style={{ ...styles.examGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {exams.map((e) => {
              const available = isExamAvailable(e);
              const countdown = e.start_time && !available ? getTimeUntil(e.start_time) : null;
              return (
                <div key={e.id} style={styles.examCard}>
                  <div>
                    <div style={styles.examTitle}>{e.title}</div>
                    <div style={styles.examDesc}>{e.description}</div>
                    {e.start_time && <div style={{ fontSize: 11, color: "var(--info)", marginTop: 4 }}>
                      Starts: {new Date(e.start_time).toLocaleString()}
                    </div>}
                  </div>
                  {available ? (
                    <button style={styles.startBtn} onClick={() => navigate(`/student/exam/${e.id}/countdown`, { state: { exam: e } })}>
                      Start Exam
                    </button>
                  ) : (
                    <div style={styles.countdownBadge}>
                      Starts in {countdown}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EXAM HISTORY */}
      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={styles.cardTitle}>Exam History</div>
        {examHistory.length === 0 ? (
          <div style={styles.empty}>No exam results yet.</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <div style={styles.historyTable}>
                <div style={styles.historyHeader}>
                  <span style={{ flex: 2 }}>Exam</span>
                  <span style={{ flex: 1, textAlign: "center" }}>Score</span>
                  <span style={{ flex: 1, textAlign: "center" }}>Percentage</span>
                  <span style={{ flex: 1, textAlign: "center" }}>Status</span>
                  <span style={{ flex: 1, textAlign: "right" }}>Date</span>
                  <span style={{ flex: 0.5, textAlign: "center" }}></span>
                </div>
                {examHistory.map((r) => (
                  <div key={r.id} style={styles.historyRow}>
                    <span style={{ flex: 2, fontWeight: 600 }}>{r.exam_title || "Untitled"}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{r.score}/{r.total_marks}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{r.percentage}%</span>
                    <span style={{ flex: 1, textAlign: "center" }}>
                      <span style={{ ...styles.badge, background: r.passed ? "var(--primary-light)" : "var(--danger-light)", color: r.passed ? "var(--primary-light-text)" : "var(--danger-light-text)" }}>
                        {r.passed ? "Passed" : "Failed"}
                      </span>
                    </span>
                    <span style={{ flex: 1, textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                    <span style={{ flex: 0.5, textAlign: "center" }}>
                      <button onClick={() => downloadStudentResultPDF(r)} style={styles.pdfBtn} title="Download PDF">
                        <i className="fas fa-file-pdf"></i>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Pagination currentPage={historyPage} totalPages={historyTotalPages} onPageChange={setHistoryPage} />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (<div style={styles.statCard}><div style={styles.statLabel}>{label}</div><div style={styles.statValue}>{value}</div></div>);
}

const styles = {
  page: { minHeight: "100vh", padding: 16, fontFamily: "Inter, system-ui, sans-serif", color: "var(--text-primary)" },
  header: { display: "flex", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 800 },
  sub: { color: "var(--text-secondary)" },
  refreshBtn: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)" },
  signOutBtn: { background: "var(--danger)", color: "var(--text-on-danger)", border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600 },
  stats: { display: "grid", gap: 12, marginBottom: 16 },
  statCard: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", padding: 14, borderRadius: 14, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  statLabel: { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" },
  statValue: { fontSize: 22, fontWeight: 800, color: "var(--text-primary)" },
  chartsRow: { display: "grid", gap: 16, marginBottom: 16 },
  chartCard: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", padding: 16, borderRadius: 14, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  chartTitle: { fontWeight: 700, marginBottom: 12, fontSize: 14, color: "var(--text-primary)" },
  card: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", padding: 16, borderRadius: 16, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  cardTitle: { fontWeight: 800, marginBottom: 12, color: "var(--text-primary)" },
  empty: { color: "var(--text-secondary)", padding: 10 },
  examGrid: { display: "grid", gap: 16 },
  examCard: { background: "var(--bg-card-nested)", padding: 16, borderRadius: 14, border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 180, boxShadow: "var(--glass-shadow)" },
  examTitle: { fontWeight: 700, color: "var(--text-primary)" },
  examDesc: { color: "var(--text-secondary)", fontSize: 13 },
  startBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "10px", borderRadius: 10, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 12 },
  countdownBadge: { background: "var(--info-light)", color: "var(--info-light-text)", padding: "10px", borderRadius: 10, fontWeight: 600, textAlign: "center", marginTop: 12, fontSize: 13 },
  historyTable: { display: "flex", flexDirection: "column", gap: 0, minWidth: 600 },
  historyHeader: { display: "flex", padding: "8px 12px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", borderBottom: "2px solid var(--border-default)", textTransform: "uppercase" },
  historyRow: { display: "flex", alignItems: "center", padding: "12px", borderBottom: "1px solid var(--border-light)", fontSize: 14, color: "var(--text-primary)" },
  badge: { padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 12 },
  pdfBtn: { background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 16 },
};
