import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import { fetchAllUsers, updateUserRole, deleteUserAccount } from "../services/adminService";
import { useIsMobile } from "../hooks/useMediaQuery";
import Pagination from "../Components/Pagination";

const ROLE_COLORS = {
  admin: { bg: "var(--role-admin-bg)", text: "var(--role-admin-text)", border: "var(--role-admin-bg)" },
  teacher: { bg: "var(--role-teacher-bg)", text: "var(--role-teacher-text)", border: "var(--role-teacher-bg)" },
  student: { bg: "var(--role-student-bg)", text: "var(--role-student-text)", border: "var(--role-student-bg)" },
};

const formatDate = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 2500);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await fetchAllUsers(page, 20, search);
      if (result?.data) {
        setUsers(result.data);
        setTotalUsers(result.total || 0);
        setTotalPages(result.totalPages || 1);
      } else {
        setUsers(Array.isArray(result) ? result : []);
      }
    } catch {
      showMessage("error", "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [page, search]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => (roleFilter === "all" ? true : u.role === roleFilter));
  }, [users, roleFilter]);

  const handleRoleChange = async (id, newRole) => {
    try {
      setSavingId(id);
      await updateUserRole(id, newRole);
      showMessage("success", "Role updated successfully");
      loadUsers();
    } catch {
      showMessage("error", "Role update failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === user?.id) {
      showMessage("error", "You cannot delete your own account");
      return;
    }
    if (!window.confirm(`Delete "${u.full_name || u.email}"? This action cannot be undone.`)) return;
    try {
      setSavingId(u.id);
      await deleteUserAccount(u.id);
      showMessage("success", "User deleted successfully");
      loadUsers();
    } catch (err) {
      showMessage("error", err?.response?.data?.message || "Delete failed");
    } finally {
      setSavingId(null);
    }
  };

  const viewDashboardAsUser = (u) => {
    sessionStorage.setItem("impersonateUserId", u.id);
    sessionStorage.setItem("impersonateRole", u.role);
    if (u.role === "teacher") navigate("/teacher");
    if (u.role === "student") navigate("/student");
  };

  return (
    <div className="themed-page" style={styles.page}>
      <div style={{ ...styles.header, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <div style={styles.title}>Admin Dashboard</div>
          <div style={styles.subtitle}>Manage registered accounts & roles</div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.profileBtn} onClick={() => navigate("/profile")}>
            <i className="fas fa-user"></i> Profile
          </button>
          <div style={styles.adminPill}>Logged in as: <b>{user?.full_name || "Admin"}</b></div>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      {message.text && (
        <div style={{ ...styles.toast, ...(message.type === "error" ? styles.toastError : {}) }}>{message.text}</div>
      )}

      <div style={{ ...styles.controls, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <div style={styles.searchBox}>
          <i className="fas fa-search" style={{ color: "var(--text-muted)" }}></i>
          <input style={styles.searchInput} placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select style={styles.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All</option><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option>
        </select>
        <button style={styles.refreshBtn} onClick={loadUsers}>Refresh</button>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>Registered Accounts</div>
          <div style={styles.countPill}>Total: {totalUsers}</div>
        </div>

        {loading ? <div style={styles.loading}>Loading...</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Name</th><th style={styles.th}>Email</th><th style={styles.th}>Role</th><th style={styles.th}>Created</th><th style={styles.th}>Actions</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.nameCell}>
                        <div style={styles.avatar}>{(u.full_name || u.email)[0]}</div>
                        <div><div style={styles.name}>{u.full_name || "No Name"}</div><div style={styles.idText}>{u.id}</div></div>
                      </div>
                    </td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}><RoleBadge role={u.role} /></td>
                    <td style={styles.td}>{formatDate(u.created_at)}</td>
                    <td style={styles.td}>
                      <div style={styles.actionRow}>
                        {u.role !== "admin" && <button style={styles.viewBtn} onClick={() => viewDashboardAsUser(u)}>View Dashboard</button>}
                        <select style={styles.roleSelect} value={u.role} disabled={savingId === u.id} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                          <option value="admin">admin</option><option value="teacher">teacher</option><option value="student">student</option>
                        </select>
                        {u.id !== user?.id && (
                          <button style={styles.deleteBtn} onClick={() => handleDeleteUser(u)} disabled={savingId === u.id}>
                            <i className="fas fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <div style={styles.footer}>Tip: Admin can explore teacher & student dashboards.</div>
    </div>
  );
}

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.student;
  return (
    <span style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: `1px solid ${c.border}`, color: c.text, background: c.bg, textTransform: "capitalize" }}>
      {role}
    </span>
  );
}

const styles = {
  page: { minHeight: "100vh", color: "var(--text-primary)", padding: 22, fontFamily: "Inter, system-ui" },
  header: { display: "flex", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 26, fontWeight: 900 },
  subtitle: { color: "var(--text-secondary)" },
  headerRight: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  profileBtn: { padding: "8px 12px", background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)" },
  adminPill: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", padding: "10px 12px", borderRadius: 999, color: "var(--text-primary)" },
  logoutBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer" },
  toast: { background: "var(--primary-bg)", color: "var(--primary-bg-text)", border: "1px solid var(--primary)", padding: 10, borderRadius: 10, marginBottom: 12, width: "fit-content" },
  toastError: { background: "var(--danger-bg)", color: "var(--danger-light-text)", border: "1px solid var(--danger)" },
  controls: { display: "flex", gap: 10, marginBottom: 12 },
  searchBox: { display: "flex", alignItems: "center", gap: 8, background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--glass-border)", flex: 1 },
  searchInput: { background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", flex: 1 },
  select: { background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "10px 12px" },
  refreshBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", borderRadius: 12, padding: "10px 12px", fontWeight: 800, cursor: "pointer" },
  card: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", WebkitBackdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 14, boxShadow: "var(--glass-shadow)" },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontWeight: 900, color: "var(--text-primary)" },
  countPill: { background: "var(--bg-card-nested)", borderRadius: 999, padding: "6px 12px", border: "1px solid var(--border-default)", color: "var(--text-primary)" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" },
  th: { textAlign: "left", color: "var(--text-secondary)", padding: 10, fontSize: 12 },
  tr: { background: "var(--bg-card-nested)" },
  td: { padding: 12, borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", color: "var(--text-primary)" },
  nameCell: { display: "flex", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, background: "var(--primary)", color: "var(--text-on-primary)", display: "grid", placeItems: "center", fontWeight: 900 },
  name: { fontWeight: 900, color: "var(--text-primary)" },
  idText: { fontSize: 11, color: "var(--text-secondary)" },
  actionRow: { display: "flex", gap: 10 },
  viewBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "10px 12px", borderRadius: 12, fontWeight: 800, cursor: "pointer" },
  roleSelect: { background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "10px 12px" },
  deleteBtn: { background: "var(--danger)", color: "var(--text-on-danger)", border: "none", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" },
  loading: { padding: 12, color: "var(--text-secondary)" },
  footer: { marginTop: 14, color: "var(--text-secondary)", fontSize: 12 },
};
