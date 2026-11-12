import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../services/apiclient";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/api/auth/reset-password", { token, newPassword });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="themed-page" style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>Invalid Link</h2>
          <p style={styles.subtitle}>This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" style={styles.link}>Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="themed-page" style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Reset Password</h2>
        <p style={styles.subtitle}>Enter your new password below.</p>

        {message && (
          <div style={styles.success}>
            {message} <Link to="/login" style={{ color: "var(--primary-light-text)", fontWeight: 600 }}>Go to Login</Link>
          </div>
        )}
        {error && <div style={styles.error}>{error}</div>}

        {!message && (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.btn}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <Link to="/login" style={styles.link}>Back to Login</Link>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 16,
  },
  card: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 16,
    padding: 40,
    maxWidth: 420,
    width: "100%",
    boxShadow: "var(--glass-shadow-lg)",
    textAlign: "center",
    border: "1px solid var(--glass-border)",
  },
  title: { fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
    outline: "none",
    boxSizing: "border-box",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
  },
  btn: {
    width: "100%",
    padding: "12px 16px",
    background: "var(--primary)",
    color: "var(--text-on-primary)",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 16,
  },
  link: { fontSize: 14, color: "var(--primary)", textDecoration: "none" },
  success: {
    background: "var(--primary-bg)",
    color: "var(--primary-bg-text)",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
  },
  error: {
    background: "var(--danger-bg)",
    color: "var(--danger-light-text)",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
  },
};
