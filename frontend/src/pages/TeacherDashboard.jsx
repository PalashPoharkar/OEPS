import { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import {
  fetchMyExams,
  createExam,
  publishExam,
  deleteExam,
} from "../services/examService";
import { api } from "../services/apiclient";
import { useIsMobile } from "../hooks/useMediaQuery";

export default function TeacherDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const impersonateId = sessionStorage.getItem("impersonateUserId");
  const activeUserId = impersonateId || user.id;

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState(30);
  const [marks, setMarks] = useState(100);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Tab: "exams" | "violations"
  const [activeTab, setActiveTab] = useState("exams");

  // Violations state
  const [violations, setViolations] = useState([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [violationsSearch, setViolationsSearch] = useState("");
  const [expandedViolation, setExpandedViolation] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [logData, setLogData] = useState({});
  const violationsLoaded = useRef(false);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 3000);
  };

  const loadExams = async () => {
    setLoading(true);
    try {
      const data = await fetchMyExams(activeUserId);
      setExams(data);
    } catch (err) {
      showMessage("error", err?.response?.data?.message || "Failed to fetch exams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExams(); }, [activeUserId]);

  // Load violations when tab switches to violations
  useEffect(() => {
    if (activeTab !== "violations" || violationsLoaded.current) return;
    const loadViolations = async () => {
      setViolationsLoading(true);
      try {
        const res = await api.get("/api/exams/proctoring/records");
        setViolations(res.data.records || []);
        violationsLoaded.current = true;
      } catch { /* silent */ }
      finally { setViolationsLoading(false); }
    };
    loadViolations();
  }, [activeTab]);

  const toggleViolationExpand = (key, logUrl) => {
    if (expandedViolation === key) { setExpandedViolation(null); setPlayingVideo(null); }
    else {
      setExpandedViolation(key);
      setPlayingVideo(null);
      if (logUrl && !logData[key]) {
        fetch(logUrl).then(r => r.json()).then(d => setLogData(p => ({ ...p, [key]: d.violations || [] }))).catch(() => setLogData(p => ({ ...p, [key]: [] })));
      }
    }
  };

  const filteredViolations = useMemo(() => {
    const q = violationsSearch.toLowerCase();
    if (!q) return violations;
    return violations.filter(r =>
      r.student?.full_name?.toLowerCase().includes(q) ||
      r.student?.email?.toLowerCase().includes(q) ||
      r.exam?.title?.toLowerCase().includes(q)
    );
  }, [violations, violationsSearch]);

  const vColors = {
    tab_switch: { bg: "#FEE2E2", color: "#991B1B", label: "Tab Switch" },
    fullscreen_exit: { bg: "#FEE2E2", color: "#991B1B", label: "Fullscreen Exit" },
    window_blur: { bg: "#FEF3C7", color: "#92400E", label: "Window Blur" },
    multiple_faces: { bg: "#FEE2E2", color: "#991B1B", label: "Multiple Faces" },
    no_face: { bg: "#FEF3C7", color: "#92400E", label: "No Face" },
    hand_gesture: { bg: "#FEF3C7", color: "#92400E", label: "Hand Gesture" },
    extreme_gaze: { bg: "#DBEAFE", color: "#1E40AF", label: "Extreme Gaze" },
    devtools_open: { bg: "#FEE2E2", color: "#991B1B", label: "DevTools" },
    blocked_shortcut: { bg: "#E5E7EB", color: "#374151", label: "Blocked Key" },
    copy: { bg: "#E5E7EB", color: "#374151", label: "Copy" },
    paste: { bg: "#E5E7EB", color: "#374151", label: "Paste" },
    contextmenu: { bg: "#E5E7EB", color: "#374151", label: "Right Click" },
    phone_detected: { bg: "#FEE2E2", color: "#991B1B", label: "Phone Detected" },
    notes_detected: { bg: "#FEE2E2", color: "#991B1B", label: "Notes/Books" },
    earphone_detected: { bg: "#FEF3C7", color: "#92400E", label: "Earphone" },
    another_person: { bg: "#FEE2E2", color: "#991B1B", label: "Another Person" },
    smartwatch_detected: { bg: "#FEF3C7", color: "#92400E", label: "Smart Watch" },
    suspicious_object: { bg: "#FEE2E2", color: "#991B1B", label: "Suspicious Object" },
    screen_resize: { bg: "#E5E7EB", color: "#374151", label: "Screen Resize" },
    tab_switch_left: { bg: "#FEE2E2", color: "#991B1B", label: "Left Tab" },
    tab_switch_return: { bg: "#DBEAFE", color: "#1E40AF", label: "Returned to Tab" },
  };
  const getVS = (type) => vColors[type] || { bg: "#F3F4F6", color: "#6B7280", label: type };

  const filteredExams = useMemo(() => {
    let list = [...exams];
    const q = search.trim().toLowerCase();
    if (statusFilter === "published") list = list.filter((e) => e.is_published);
    if (statusFilter === "draft") list = list.filter((e) => !e.is_published);
    if (q) list = list.filter((e) => (e.title || "").toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q));
    if (sortBy === "newest") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sortBy === "oldest") list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (sortBy === "title") list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return list;
  }, [exams, search, statusFilter, sortBy]);

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!title.trim()) return showMessage("error", "Exam title is required");
    setSaving(true);
    try {
      await createExam({
        title: title.trim(), description: desc.trim(),
        duration_minutes: Number(duration), total_marks: Number(marks),
        start_time: startTime || null, end_time: endTime || null,
      });
      setTitle(""); setDesc(""); setDuration(30); setMarks(100); setStartTime(""); setEndTime("");
      showMessage("success", "Exam created successfully");
      loadExams();
    } catch (err) {
      showMessage("error", err?.response?.data?.message || "Create exam failed");
    } finally { setSaving(false); }
  };

  const handlePublish = async (id, value) => {
    try { await publishExam(id, value); showMessage("success", value ? "Published" : "Unpublished"); loadExams(); }
    catch (err) { showMessage("error", err?.response?.data?.message || "Update failed"); }
  };

  const handleDelete = async (id, t) => {
    if (!window.confirm(`Delete "${t}"? This will also remove all its questions.`)) return;
    try { await deleteExam(id); showMessage("success", "Exam deleted"); loadExams(); }
    catch (err) { showMessage("error", err?.response?.data?.message || "Delete failed"); }
  };

  const formatDate = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

  const getScheduleStatus = (exam) => {
    if (!exam.start_time && !exam.end_time) return null;
    const now = new Date();
    if (exam.start_time && new Date(exam.start_time) > now) return "scheduled";
    if (exam.end_time && new Date(exam.end_time) < now) return "ended";
    return "active";
  };

  const total = exams.length;
  const published = exams.filter((e) => e.is_published).length;

  return (
    <div className="themed-page" style={styles.page}>
      <div style={{ ...styles.header, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <div style={styles.title}>Teacher Dashboard</div>
          <div style={styles.sub}>Welcome <b>{user?.full_name || "Teacher"}</b></div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.navBtn} onClick={() => navigate("/teacher/analytics")}>
            <i className="fas fa-chart-bar"></i> Analytics
          </button>
          <button style={styles.navBtn} onClick={() => navigate("/profile")}>
            <i className="fas fa-user"></i> Profile
          </button>
          <div style={styles.pill}>Role: {user?.role}</div>
          <button style={styles.logout} onClick={logout}>Logout</button>
        </div>
      </div>

      {message.text && (
        <div style={{ ...styles.toast, ...(message.type === "success" ? styles.toastOk : styles.toastErr) }}>
          {message.text}
        </div>
      )}

      {/* TAB BAR */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tab, ...(activeTab === "exams" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("exams")}
        >
          <i className="fas fa-file-alt" style={{ marginRight: 6 }} /> Exams
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === "violations" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("violations")}
        >
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
          Violations
          {violations.length > 0 && (
            <span style={styles.tabBadge}>{violations.length}</span>
          )}
        </button>
      </div>

      {/* ═══ EXAMS TAB ═══ */}
      {activeTab === "exams" && (
        <>
          <div style={{ ...styles.stats, gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)" }}>
            <StatCard label="Total Exams" value={total} />
            <StatCard label="Published" value={published} />
            <StatCard label="Draft" value={total - published} />
          </div>

          <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            {/* CREATE EXAM */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Create Exam</div>
              <form onSubmit={handleCreateExam} style={styles.form}>
                <input style={styles.input} placeholder="Exam Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea style={styles.textarea} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <input style={styles.input} type="number" min="5" placeholder="Duration (min)" value={duration} onChange={(e) => setDuration(e.target.value)} />
                <input style={styles.input} type="number" min="1" placeholder="Total Marks" value={marks} onChange={(e) => setMarks(e.target.value)} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={styles.fieldLabel}>Start Time (optional)</label>
                    <input style={styles.input} type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={styles.fieldLabel}>End Time (optional)</label>
                    <input style={styles.input} type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
                <button style={styles.primaryBtn} disabled={saving}>{saving ? "Creating..." : "Create Exam"}</button>
              </form>
            </div>

            {/* EXAMS LIST */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>My Exams</div>
              <div style={{ ...styles.controls, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <input style={styles.searchInput} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select style={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All</option><option value="published">Published</option><option value="draft">Draft</option>
                </select>
                <select style={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title A-Z</option>
                </select>
              </div>

              {loading ? <div style={styles.loading}>Loading...</div> : filteredExams.length === 0 ? <div style={styles.loading}>No exams found</div> : (
                filteredExams.map((e) => {
                  const sched = getScheduleStatus(e);
                  return (
                    <div key={e.id} style={styles.examCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={styles.examTitle}>{e.title}</div>
                        {sched && <span style={{ ...styles.scheduleBadge, background: sched === "active" ? "var(--primary-light)" : sched === "scheduled" ? "var(--info-light)" : "var(--bg-card-nested)", color: sched === "active" ? "var(--primary-light-text)" : sched === "scheduled" ? "var(--info-light-text)" : "var(--text-secondary)" }}>
                          {sched === "scheduled" ? "Scheduled" : sched === "active" ? "Active" : "Ended"}
                        </span>}
                      </div>
                      <div style={styles.examMeta}>{e.duration_minutes} min  {e.total_marks} marks  {formatDate(e.created_at)}</div>
                      {(e.start_time || e.end_time) && <div style={{ fontSize: 11, color: "var(--info)", marginTop: 2 }}>
                        {e.start_time && <>From: {formatDate(e.start_time)}</>}{e.start_time && e.end_time && " | "}{e.end_time && <>To: {formatDate(e.end_time)}</>}
                      </div>}
                      <div style={styles.examDesc}>{e.description || "No description"}</div>
                      <div style={{ ...styles.actions, flexWrap: "wrap" }}>
                        <button style={styles.smallBtn} onClick={() => navigator.clipboard.writeText(e.id)}>Copy ID</button>
                        <button style={styles.smallBtn} onClick={() => (window.location.href = `/teacher/add-questions/${e.id}`)}>Add Questions</button>
                        <button style={e.is_published ? styles.dangerBtn : styles.successBtn} onClick={() => handlePublish(e.id, !e.is_published)}>{e.is_published ? "Unpublish" : "Publish"}</button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(e.id, e.title)}>Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ VIOLATIONS TAB ═══ */}
      {activeTab === "violations" && (
        <div>
          {/* Search + stats row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {violations.length} cheating record{violations.length !== 1 ? "s" : ""} found
            </div>
            <input
              type="text"
              placeholder="Search by student or exam..."
              value={violationsSearch}
              onChange={(e) => setViolationsSearch(e.target.value)}
              style={{ ...styles.searchInput, maxWidth: 280 }}
            />
          </div>

          {violationsLoading && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={styles.vSpinner} />
              <p style={{ color: "var(--text-secondary)", marginTop: 12 }}>Loading violation records...</p>
            </div>
          )}

          {!violationsLoading && filteredViolations.length === 0 && (
            <div style={{ textAlign: "center", padding: 48 }}>
              <i className="fas fa-shield-alt" style={{ fontSize: 48, color: "var(--text-muted)", marginBottom: 12 }} />
              <p style={{ color: "var(--text-secondary)" }}>No violation records found</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredViolations.map((rec) => {
              const key = `${rec.student_id}_${rec.exam_id}`;
              const isOpen = expandedViolation === key;
              const totalClips = rec.clips?.length || 0;
              const vLog = logData[key] || [];

              return (
                <div key={key} style={styles.vCard}>
                  {/* Row */}
                  <div style={styles.vRow} onClick={() => toggleViolationExpand(key, rec.log?.log_url)}>
                    <div style={styles.vAvatar}>
                      {rec.student?.profile_photo_url ? (
                        <img src={rec.student.profile_photo_url} alt="" style={styles.vAvatarImg} />
                      ) : (
                        <span style={styles.vAvatarText}>
                          {(rec.student?.full_name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.vName}>{rec.student?.full_name || "Unknown"}</div>
                      <div style={styles.vEmail}>{rec.student?.email || ""}</div>
                    </div>
                    <div style={{ minWidth: 100 }}>
                      <div style={styles.vExam}>{rec.exam?.title || "Unknown Exam"}</div>
                    </div>
                    <div style={styles.vClipBadge}>
                      <i className="fas fa-video" style={{ marginRight: 4 }} />
                      {totalClips} clip{totalClips !== 1 ? "s" : ""}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13, width: 20, textAlign: "center" }}>
                      <i className={`fas fa-chevron-${isOpen ? "up" : "down"}`} />
                    </div>
                  </div>

                  {/* Expanded */}
                  {isOpen && (
                    <div style={styles.vExpanded}>
                      {/* Violation log */}
                      {rec.log && vLog.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={styles.vSectionTitle}>
                            <i className="fas fa-list" style={{ marginRight: 6 }} />
                            Violation Log ({vLog.length})
                          </div>
                          <div style={styles.vTags}>
                            {Object.entries(
                              vLog.reduce((acc, v) => { acc[v.type] = (acc[v.type] || 0) + 1; return acc; }, {})
                            ).map(([type, count]) => {
                              const vs = getVS(type);
                              return <span key={type} style={{ ...styles.vTag, background: vs.bg, color: vs.color }}>{vs.label} x{count}</span>;
                            })}
                          </div>
                          <div style={styles.vTimeline}>
                            {vLog.slice(0, 20).map((v, i) => {
                              const vs = getVS(v.type);
                              return (
                                <div key={i} style={styles.vTimeRow}>
                                  <div style={{ ...styles.vTimeDot, background: vs.color }} />
                                  <span style={styles.vTimeStamp}>{v.time ? new Date(v.time).toLocaleTimeString() : ""}</span>
                                  <span style={{ ...styles.vTimeLabel, background: vs.bg, color: vs.color }}>{vs.label}</span>
                                </div>
                              );
                            })}
                            {vLog.length > 20 && <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 16, marginTop: 4 }}>+{vLog.length - 20} more</div>}
                          </div>
                        </div>
                      )}

                      {/* Video clips */}
                      {totalClips > 0 && (
                        <div>
                          <div style={styles.vSectionTitle}>
                            <i className="fas fa-film" style={{ marginRight: 6 }} />
                            Recorded Clips ({totalClips})
                          </div>
                          <div style={styles.vClipsGrid}>
                            {rec.clips.map((clip, i) => {
                              const vs = getVS(clip.violation_type);
                              const isPlaying = playingVideo === clip.file_name;
                              const isImage = clip.file_name?.endsWith(".jpg");
                              return (
                                <div key={i} style={styles.vClipCard}>
                                  <div style={styles.vClipVideoBox}>
                                    {isImage ? (
                                      <img src={clip.video_url} alt="Evidence" style={styles.vClipVideo} />
                                    ) : isPlaying ? (
                                      <video src={clip.video_url} controls autoPlay style={styles.vClipVideo} />
                                    ) : (
                                      <div style={styles.vClipPlay} onClick={() => setPlayingVideo(clip.file_name)}>
                                        <i className={`fas ${isImage ? "fa-image" : "fa-play-circle"}`} style={{ fontSize: 32, color: "#fff" }} />
                                      </div>
                                    )}
                                  </div>
                                  <div style={styles.vClipInfo}>
                                    <span style={{ ...styles.vClipType, background: vs.bg, color: vs.color }}>{vs.label}</span>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                      {isImage ? "Snapshot" : "Video"} · {clip.created_at ? new Date(clip.created_at).toLocaleString() : ""}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {totalClips === 0 && !rec.log && (
                        <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No clips or logs available</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (<div style={styles.statCard}><div style={styles.statLabel}>{label}</div><div style={styles.statValue}>{value}</div></div>);
}

const styles = {
  page: { minHeight: "100vh", padding: 16, color: "var(--text-primary)", fontFamily: "Inter" },
  header: { display: "flex", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 800 },
  sub: { color: "var(--text-secondary)" },
  headerRight: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  navBtn: { padding: "8px 12px", background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)" },
  pill: { padding: "8px 12px", background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", borderRadius: 20, border: "1px solid var(--glass-border)", color: "var(--text-primary)" },
  logout: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "8px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700 },
  toast: { padding: 10, borderRadius: 10, marginBottom: 10, background: "var(--primary-bg)", color: "var(--primary-bg-text)", border: "1px solid var(--primary)" },
  toastOk: {},
  toastErr: { background: "var(--danger-bg)", color: "var(--danger-light-text)", border: "1px solid var(--danger)" },
  stats: { display: "grid", gap: 12, marginBottom: 16 },
  statCard: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", padding: 14, borderRadius: 14, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  statLabel: { color: "var(--text-secondary)", fontSize: 12 },
  statValue: { fontSize: 22, fontWeight: 800, color: "var(--text-primary)" },
  grid: { display: "grid", gap: 16 },
  card: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", padding: 16, borderRadius: 16, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  cardTitle: { fontWeight: 700, marginBottom: 10, color: "var(--text-primary)" },
  fieldLabel: { fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: 10, borderRadius: 10, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)", width: "100%", boxSizing: "border-box" },
  textarea: { padding: 10, borderRadius: 10, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
  primaryBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: 10, borderRadius: 10, cursor: "pointer", fontWeight: 700 },
  controls: { display: "flex", gap: 10, marginBottom: 10 },
  searchInput: { flex: 1, padding: 10, borderRadius: 10, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)", minWidth: 0 },
  select: { padding: 10, borderRadius: 10, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
  loading: { color: "var(--text-secondary)" },
  examCard: { background: "var(--bg-card-nested)", padding: 12, borderRadius: 12, marginBottom: 10, border: "1px solid var(--border-light)" },
  examTitle: { fontWeight: 700, color: "var(--text-primary)" },
  examMeta: { fontSize: 12, color: "var(--text-secondary)" },
  examDesc: { marginTop: 4, color: "var(--text-primary)" },
  scheduleBadge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" },
  actions: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 },
  smallBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 },
  successBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "6px 10px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" },
  deleteBtn: { background: "var(--danger)", color: "var(--text-on-danger)", border: "none", padding: "6px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 },
  dangerBtn: { background: "var(--warning)", color: "var(--text-primary)", border: "none", padding: "6px 10px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" },

  /* Tabs */
  tabBar: { display: "flex", gap: 4, marginBottom: 16, background: "var(--bg-card-nested)", borderRadius: 12, padding: 4, border: "1px solid var(--border-light)" },
  tab: { flex: 1, padding: "10px 16px", border: "none", borderRadius: 10, background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.2s" },
  tabActive: { background: "var(--glass-bg)", color: "var(--text-primary)", boxShadow: "var(--glass-shadow)", backdropFilter: "blur(var(--glass-blur))" },
  tabBadge: { background: "var(--danger)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800, marginLeft: 4 },

  /* Violations */
  vSpinner: { width: 32, height: 32, border: "4px solid var(--border-default)", borderTop: "4px solid var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" },
  vCard: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", borderRadius: 14, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)", overflow: "hidden" },
  vRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" },
  vAvatar: { width: 38, height: 38, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--primary)", flexShrink: 0, display: "grid", placeItems: "center", background: "var(--primary-light)" },
  vAvatarImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  vAvatarText: { fontSize: 16, fontWeight: 800, color: "var(--primary-light-text)" },
  vName: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  vEmail: { fontSize: 11, color: "var(--text-secondary)" },
  vExam: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" },
  vClipBadge: { background: "var(--danger-bg)", color: "var(--danger-light-text)", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", flexShrink: 0 },
  vExpanded: { borderTop: "1px solid var(--border-light)", padding: 16 },
  vSectionTitle: { fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center" },
  vTags: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 },
  vTag: { padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  vTimeline: { display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflowY: "auto" },
  vTimeRow: { display: "flex", alignItems: "center", gap: 8 },
  vTimeDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  vTimeStamp: { fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", minWidth: 65 },
  vTimeLabel: { padding: "1px 7px", borderRadius: 5, fontSize: 11, fontWeight: 600 },
  vClipsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 },
  vClipCard: { background: "var(--bg-card-nested)", borderRadius: 10, border: "1px solid var(--border-light)", overflow: "hidden" },
  vClipVideoBox: { aspectRatio: "16/9", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" },
  vClipVideo: { width: "100%", height: "100%", display: "block" },
  vClipPlay: { width: "100%", height: "100%", display: "grid", placeItems: "center", cursor: "pointer", background: "rgba(0,0,0,0.7)" },
  vClipInfo: { padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 },
  vClipType: { padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 },
};
