import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "1px solid var(--glass-border)",
        background: "var(--glass-bg)",
        backdropFilter: "blur(var(--glass-blur))",
        WebkitBackdropFilter: "blur(var(--glass-blur))",
        boxShadow: "var(--glass-shadow)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        fontSize: 20,
        color: isDark ? "#FBBF24" : "#6B7280",
        transition: "transform 0.3s ease, background 0.3s ease, color 0.3s ease",
        padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      <i className={`fas ${isDark ? "fa-sun" : "fa-moon"}`} />
    </button>
  );
}
