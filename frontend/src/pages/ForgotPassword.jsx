import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/apiclient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/api/auth/forgot-password", { email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="themed-page" style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Forgot Password</h2>
        <p style={styles.subtitle}>Enter your email to receive a password reset link.</p>

        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

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
