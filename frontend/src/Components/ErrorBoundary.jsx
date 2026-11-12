import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>!</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.subtitle}>
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <div style={styles.buttons}>
              <button onClick={() => window.location.reload()} style={styles.reloadBtn}>
                Reload Page
              </button>
              <a href="/login" style={styles.homeLink}>Back to Home</a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-page)",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 16,
  },
  card: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 16,
    padding: 48,
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
    boxShadow: "var(--glass-shadow-lg)",
    border: "1px solid var(--glass-border)",
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "var(--danger-bg)",
    color: "var(--danger)",
    fontSize: 32,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 },
  buttons: { display: "flex", gap: 12, justifyContent: "center", alignItems: "center" },
  reloadBtn: {
    padding: "10px 24px",
    background: "var(--primary)",
    color: "var(--text-on-primary)",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  homeLink: { fontSize: 14, color: "var(--primary)", textDecoration: "none" },
};
