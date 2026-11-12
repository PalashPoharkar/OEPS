import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="themed-page" style={styles.container}>
      <div style={styles.card}>
        <div style={styles.code}>404</div>
        <h1 style={styles.title}>Page Not Found</h1>
        <p style={styles.subtitle}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/login" style={styles.btn}>Go Home</Link>
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
  card: { textAlign: "center", maxWidth: 480 },
  code: {
    fontSize: 120,
    fontWeight: 900,
    color: "var(--border-default)",
    lineHeight: 1,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 },
  subtitle: { fontSize: 16, color: "var(--text-secondary)", marginBottom: 32 },
  btn: {
    display: "inline-block",
    padding: "12px 32px",
    background: "var(--primary)",
    color: "var(--text-on-primary)",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 600,
  },
};
