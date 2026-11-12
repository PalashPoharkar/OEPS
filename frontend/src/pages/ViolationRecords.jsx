import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import { api } from "../services/apiclient";

export default function ViolationRecords() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [logData, setLogData] = useState({}); // { key: violations[] }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/api/exams/proctoring/records");
        setRecords(res.data.records || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load records");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fetchLog = async (logUrl, key) => {
    if (logData[key]) return;
    try {
      const res = await fetch(logUrl);
      const data = await res.json();
      setLogData((prev) => ({ ...prev, [key]: data.violations || [] }));
    } catch {
      setLogData((prev) => ({ ...prev, [key]: [] }));
    }
  };

  const toggleExpand = (key, logUrl) => {
    if (expandedId === key) {
      setExpandedId(null);
      setPlayingVideo(null);
    } else {
      setExpandedId(key);
      setPlayingVideo(null);
      if (logUrl) fetchLog(logUrl, key);
    }
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.student?.full_name?.toLowerCase().includes(q) ||
      r.student?.email?.toLowerCase().includes(q) ||
      r.exam?.title?.toLowerCase().includes(q)
    );
  });

  const goBack = () => {
    if (user?.role === "admin") navigate("/admin");
    else navigate("/teacher");
  };

  const violationColors = {
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
  };

  const getViolationStyle = (type) =>
    violationColors[type] || { bg: "#F3F4F6", color: "#6B7280", label: type };

  return (
    <div className="themed-page" style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <button onClick={goBack} style={S.backBtn}>
              <i className="fas fa-arrow-left" /> Back
            </button>
            <div>
              <h1 style={S.title}>Violation Records</h1>
              <p style={S.subtitle}>{records.length} cheating record{records.length !== 1 ? "s" : ""} found</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="Search by student or exam..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={S.searchInput}
          />
        </div>

        {loading && (
          <div style={S.center}>
            <div style={S.spinner} />
            <p style={{ color: "var(--text-secondary)", marginTop: 12 }}>Loading records...</p>
          </div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}

        {!loading && filtered.length === 0 && (
          <div style={S.center}>
            <i className="fas fa-shield-alt" style={{ fontSize: 48, color: "var(--text-muted)", marginBottom: 12 }} />
            <p style={{ color: "var(--text-secondary)" }}>No violation records found</p>
          </div>
        )}

        {/* Records list */}
        <div style={S.recordsList}>
          {filtered.map((rec) => {
            const key = `${rec.student_id}_${rec.exam_id}`;
            const isOpen = expandedId === key;
            const totalClips = rec.clips?.length || 0;
            const violations = logData[key] || [];

            return (
              <div key={key} style={S.recordCard}>
                {/* Collapsed row */}
                <div
                  style={S.recordRow}
                  onClick={() => toggleExpand(key, rec.log?.log_url)}
                >
                  {/* Student avatar */}
                  <div style={S.avatar}>
                    {rec.student?.profile_photo_url ? (
                      <img src={rec.student.profile_photo_url} alt="" style={S.avatarImg} />
                    ) : (
                      <span style={S.avatarText}>
                        {(rec.student?.full_name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={S.recordInfo}>
                    <div style={S.studentName}>{rec.student?.full_name || "Unknown Student"}</div>
                    <div style={S.studentEmail}>{rec.student?.email || ""}</div>
                  </div>

                  <div style={S.examCol}>
                    <div style={S.examName}>{rec.exam?.title || "Unknown Exam"}</div>
                  </div>

                  <div style={S.statsCol}>
                    <div style={S.statBadge}>
                      <i className="fas fa-video" style={{ marginRight: 4 }} />
                      {totalClips} clip{totalClips !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div style={S.chevron}>
                    <i className={`fas fa-chevron-${isOpen ? "up" : "down"}`} />
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div style={S.expandedArea}>
                    {/* Violation log summary */}
                    {rec.log && violations.length > 0 && (
                      <div style={S.logSection}>
                        <div style={S.sectionLabel}>
                          <i className="fas fa-list" style={{ marginRight: 6 }} />
                          Violation Log ({violations.length} violations)
                        </div>
                        <div style={S.violationTags}>
                          {Object.entries(
                            violations.reduce((acc, v) => {
                              acc[v.type] = (acc[v.type] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([type, count]) => {
                            const vs = getViolationStyle(type);
                            return (
                              <span key={type} style={{ ...S.vTag, background: vs.bg, color: vs.color }}>
                                {vs.label} x{count}
                              </span>
                            );
                          })}
                        </div>

                        {/* Timeline */}
                        <div style={S.timeline}>
                          {violations.slice(0, 20).map((v, i) => {
                            const vs = getViolationStyle(v.type);
                            const time = v.time ? new Date(v.time).toLocaleTimeString() : "";
                            return (
                              <div key={i} style={S.timelineRow}>
                                <div style={{ ...S.timelineDot, background: vs.color }} />
                                <span style={S.timelineTime}>{time}</span>
                                <span style={{ ...S.timelineLabel, background: vs.bg, color: vs.color }}>
                                  {vs.label}
                                </span>
                              </div>
                            );
                          })}
                          {violations.length > 20 && (
                            <div style={S.timelineMore}>
                              +{violations.length - 20} more violations
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {rec.log && !logData[key] && (
                      <div style={{ textAlign: "center", padding: 12 }}>
                        <div style={S.miniSpinner} />
                      </div>
                    )}

                    {/* Video clips */}
                    {totalClips > 0 && (
                      <div style={S.clipsSection}>
                        <div style={S.sectionLabel}>
                          <i className="fas fa-film" style={{ marginRight: 6 }} />
                          Recorded Clips ({totalClips})
                        </div>
                        <div style={S.clipsGrid}>
                          {rec.clips.map((clip, i) => {
                            const vs = getViolationStyle(clip.violation_type);
                            const isPlaying = playingVideo === clip.file_name;
                            return (
                              <div key={i} style={S.clipCard}>
                                <div style={S.clipVideoBox}>
                                  {isPlaying ? (
                                    <video
                                      src={clip.video_url}
                                      controls
                                      autoPlay
                                      style={S.clipVideo}
                                    />
                                  ) : (
                                    <div
                                      style={S.clipPlaceholder}
                                      onClick={() => setPlayingVideo(clip.file_name)}
                                    >
                                      <i className="fas fa-play-circle" style={{ fontSize: 36, color: "#fff" }} />
                                    </div>
                                  )}
                                </div>
                                <div style={S.clipInfo}>
                                  <span style={{ ...S.clipType, background: vs.bg, color: vs.color }}>
                                    {vs.label}
                                  </span>
                                  <span style={S.clipTime}>
                                    {clip.created_at ? new Date(clip.created_at).toLocaleString() : ""}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {totalClips === 0 && !rec.log && (
                      <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
                        No clips or logs available
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    padding: 16,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  container: { maxWidth: 960, margin: "0 auto" },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  backBtn: {
    padding: "8px 14px",
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  title: { fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 },
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: 0, marginTop: 2 },
  searchInput: {
    padding: "10px 14px",
    border: "1px solid var(--border-default)",
    borderRadius: 10,
    fontSize: 13,
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    width: 260,
    outline: "none",
  },

  center: { textAlign: "center", padding: 48 },
  spinner: {
    width: 36,
    height: 36,
    border: "4px solid var(--border-default)",
    borderTop: "4px solid var(--primary)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto",
  },
  miniSpinner: {
    width: 20,
    height: 20,
    border: "3px solid var(--border-default)",
    borderTop: "3px solid var(--primary)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto",
  },
  errorBox: {
    background: "var(--danger-bg)",
    color: "var(--danger-light-text)",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
  },

  recordsList: { display: "flex", flexDirection: "column", gap: 10 },

  recordCard: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 14,
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-shadow)",
    overflow: "hidden",
  },
  recordRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 18px",
    cursor: "pointer",
    transition: "background 0.15s",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    overflow: "hidden",
    border: "2px solid var(--primary)",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    background: "var(--primary-light)",
  },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  avatarText: { fontSize: 18, fontWeight: 800, color: "var(--primary-light-text)" },

  recordInfo: { flex: 1, minWidth: 0 },
  studentName: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  studentEmail: { fontSize: 12, color: "var(--text-secondary)" },

  examCol: { minWidth: 120 },
  examName: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" },

  statsCol: { display: "flex", gap: 6, flexShrink: 0 },
  statBadge: {
    background: "var(--danger-bg)",
    color: "var(--danger-light-text)",
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
  },

  chevron: { color: "var(--text-muted)", fontSize: 13, flexShrink: 0, width: 20, textAlign: "center" },

  /* Expanded */
  expandedArea: {
    borderTop: "1px solid var(--border-light)",
    padding: 18,
  },

  logSection: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
  },

  violationTags: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  vTag: {
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
  },

  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 220,
    overflowY: "auto",
    paddingRight: 4,
  },
  timelineRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  timelineTime: { fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", minWidth: 70 },
  timelineLabel: {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  timelineMore: { fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", paddingLeft: 16, paddingTop: 4 },

  /* Clips */
  clipsSection: {},
  clipsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 10,
  },
  clipCard: {
    background: "var(--bg-card-nested)",
    borderRadius: 10,
    border: "1px solid var(--border-light)",
    overflow: "hidden",
  },
  clipVideoBox: {
    aspectRatio: "16/9",
    background: "#000",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  clipVideo: { width: "100%", height: "100%", display: "block" },
  clipPlaceholder: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    background: "rgba(0,0,0,0.7)",
  },
  clipInfo: {
    padding: "8px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  clipType: {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
  },
  clipTime: { fontSize: 10, color: "var(--text-muted)" },
};
