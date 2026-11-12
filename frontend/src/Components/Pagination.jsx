export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const pages = getPages();

  return (
    <div style={styles.container}>
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        style={{ ...styles.btn, ...(currentPage === 1 ? styles.disabled : {}) }}
      >
        &laquo;
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{ ...styles.btn, ...(currentPage === 1 ? styles.disabled : {}) }}
      >
        &lsaquo;
      </button>

      {pages[0] > 1 && <span style={styles.dots}>...</span>}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          style={{
            ...styles.btn,
            ...(p === currentPage ? styles.active : {}),
          }}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && <span style={styles.dots}>...</span>}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{ ...styles.btn, ...(currentPage === totalPages ? styles.disabled : {}) }}
      >
        &rsaquo;
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        style={{ ...styles.btn, ...(currentPage === totalPages ? styles.disabled : {}) }}
      >
        &raquo;
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: 16,
    flexWrap: "wrap",
  },
  btn: {
    padding: "6px 12px",
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    background: "var(--bg-card-nested)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-primary)",
    minWidth: 36,
    textAlign: "center",
  },
  active: {
    background: "var(--primary)",
    color: "var(--text-on-primary)",
    borderColor: "var(--primary)",
  },
  disabled: {
    opacity: 0.4,
    cursor: "default",
  },
  dots: {
    padding: "6px 4px",
    color: "var(--text-muted)",
    fontSize: 13,
  },
};
