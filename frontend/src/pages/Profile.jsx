import { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";
import { api } from "../services/apiclient";

export default function Profile() {
  const { user, logout, login, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [passErr, setPassErr] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const [photoErr, setPhotoErr] = useState("");

  useEffect(() => {
    api.get("/api/auth/profile").then((res) => {
      setProfile(res.data);
      setFullName(res.data.full_name);
    });
  }, []);

  const handleNameSave = async (e) => {
    e.preventDefault();
    setLoadingName(true);
    setNameMsg("");
    setNameErr("");
    try {
      const res = await api.patch("/api/auth/profile", { full_name: fullName });
      setNameMsg("Name updated successfully");
      login({ token, user: { ...user, full_name: res.data.user.full_name } });
    } catch (err) {
      setNameErr(err.response?.data?.message || "Failed to update");
    } finally {
      setLoadingName(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassErr("Passwords do not match");
      return;
    }
    setLoadingPass(true);
    setPassMsg("");
    setPassErr("");
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setPassMsg("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPassErr(err.response?.data?.message || "Failed to change password");
    } finally {
      setLoadingPass(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoErr("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoErr("Image must be under 5MB");
      return;
    }
    setPhotoErr("");
    setPhotoMsg("");
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!photoPreview) return;
    setLoadingPhoto(true);
    setPhotoMsg("");
    setPhotoErr("");
    try {
      const res = await api.post("/api/auth/upload-profile-photo", { data: photoPreview });
      setProfile((prev) => ({ ...prev, profile_photo_url: res.data.url }));
      setPhotoMsg("Profile photo updated!");
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      setPhotoErr(err.response?.data?.message || "Failed to upload photo");
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handlePhotoCancel = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoErr("");
    setPhotoMsg("");
    fileInputRef.current.value = "";
  };

  const goBack = () => {
    if (!user) return navigate("/login");
    if (user.role === "admin") return navigate("/admin");
    if (user.role === "teacher") return navigate("/teacher");
    navigate("/student");
  };

  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const displayPhoto = photoPreview || profile?.profile_photo_url;

  return (
    <div className="themed-page" style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={goBack} style={styles.backBtn}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <h1 style={styles.title}>My Profile</h1>
          <button onClick={logout} style={styles.logoutBtn}>Sign Out</button>
        </div>

        {/* Profile Photo Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Profile Photo</h3>
          <div style={styles.photoSection}>
            <div
              style={styles.avatarWrapper}
              onClick={() => fileInputRef.current.click()}
              title="Click to change photo"
              onMouseEnter={(e) => e.currentTarget.querySelector(".avatar-overlay").style.opacity = "1"}
              onMouseLeave={(e) => e.currentTarget.querySelector(".avatar-overlay").style.opacity = "0"}
            >
              {displayPhoto ? (
                <img src={displayPhoto} alt="Profile" style={styles.avatarImg} />
              ) : (
                <div style={styles.avatarInitials}>{initials}</div>
              )}
              <div className="avatar-overlay" style={styles.avatarOverlay}>
                <i className="fas fa-camera" style={{ fontSize: 20, color: "#fff" }} />
              </div>
            </div>
            <div style={styles.photoInfo}>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
                Click the avatar to select a photo. Max 5MB, JPG/PNG/WebP.
              </p>
              {photoFile && (
                <p style={{ color: "var(--text-primary)", fontSize: 13, marginTop: 4 }}>
                  Selected: {photoFile.name}
                </p>
              )}
            </div>
          </div>
          {photoMsg && <div style={{ ...styles.success, marginTop: 12 }}>{photoMsg}</div>}
          {photoErr && <div style={{ ...styles.error, marginTop: 12 }}>{photoErr}</div>}
          {photoPreview && (
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={handlePhotoUpload} disabled={loadingPhoto} style={styles.saveBtn}>
                {loadingPhoto ? "Uploading..." : "Save Photo"}
              </button>
              <button onClick={handlePhotoCancel} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Account Info */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Account Information</h3>
          <div style={styles.infoRow}>
            <span style={styles.label}>Email</span>
            <span style={styles.value}>{profile?.email}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Role</span>
            <span style={{
              ...styles.badge,
              background: profile?.role === "admin" ? "var(--role-admin-bg)" : profile?.role === "teacher" ? "var(--role-teacher-bg)" : "var(--role-student-bg)",
              color: profile?.role === "admin" ? "var(--role-admin-text)" : profile?.role === "teacher" ? "var(--role-teacher-text)" : "var(--role-student-text)",
            }}>
              {profile?.role}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Member since</span>
            <span style={styles.value}>
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
            </span>
          </div>
        </div>

        {/* Edit Name */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Edit Name</h3>
          {nameMsg && <div style={styles.success}>{nameMsg}</div>}
          {nameErr && <div style={styles.error}>{nameErr}</div>}
          <form onSubmit={handleNameSave} style={styles.form}>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              style={styles.input}
              required
            />
            <button type="submit" disabled={loadingName} style={styles.saveBtn}>
              {loadingName ? "Saving..." : "Save Name"}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Change Password</h3>
          {passMsg && <div style={styles.success}>{passMsg}</div>}
          {passErr && <div style={styles.error}>{passErr}</div>}
          <form onSubmit={handlePasswordChange} style={styles.form}>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current Password"
              style={styles.input}
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password (min 6 chars)"
              style={styles.input}
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              style={styles.input}
              required
            />
            <button type="submit" disabled={loadingPass} style={styles.saveBtn}>
              {loadingPass ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 16,
  },
  container: { maxWidth: 600, margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: 700, color: "var(--text-primary)" },
  backBtn: {
    padding: "8px 16px",
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    color: "var(--text-primary)",
  },
  logoutBtn: {
    padding: "8px 16px",
    background: "var(--danger)",
    color: "var(--text-on-danger)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  card: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-shadow)",
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 },
  photoSection: {
    display: "flex",
    alignItems: "center",
    gap: 20,
  },
  avatarWrapper: {
    position: "relative",
    width: 80,
    height: 80,
    borderRadius: "50%",
    cursor: "pointer",
    flexShrink: 0,
    overflow: "hidden",
    border: "2px solid var(--primary)",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  avatarInitials: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--primary-light)",
    color: "var(--primary-light-text)",
    fontSize: 28,
    fontWeight: 700,
  },
  avatarOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    transition: "opacity 0.2s",
    // hover handled via onMouseEnter/Leave in JSX
  },
  photoInfo: {
    flex: 1,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid var(--border-light)",
  },
  label: { fontSize: 14, color: "var(--text-secondary)" },
  value: { fontSize: 14, color: "var(--text-primary)", fontWeight: 500 },
  badge: {
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "capitalize",
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: {
    padding: "12px 16px",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
  },
  saveBtn: {
    padding: "12px 16px",
    background: "var(--primary)",
    color: "var(--text-on-primary)",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "12px 16px",
    background: "var(--glass-bg)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  success: {
    background: "var(--primary-bg)",
    color: "var(--primary-bg-text)",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  error: {
    background: "var(--danger-bg)",
    color: "var(--danger-light-text)",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  },
};
