import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="themed-page" style={{ minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>

      <Header navigate={navigate} />
      <HeroSection navigate={navigate} />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════ */
function Header({ navigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#testimonials", label: "Testimonials" },
  ];

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "var(--bg-elevated)" : "transparent",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      borderBottom: scrolled ? "1px solid var(--border-light)" : "none",
      transition: "all 0.3s",
      animation: "fadeDown 0.6s ease",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <i className="fas fa-shield-alt" style={{ fontSize: 24, color: "var(--primary)" }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>OEPS</span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {links.map((l) => (
            <a key={l.href} onClick={() => scrollTo(l.href.slice(1))} style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => e.target.style.color = "var(--text-primary)"}
              onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}
            >{l.label}</a>
          ))}
          <button onClick={() => navigate("/login")} style={HS.ghostBtn}>Log In</button>
          <button onClick={() => navigate("/register")} style={HS.primaryBtn}>Sign Up</button>
        </nav>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════ */
function HeroSection({ navigate }) {
  return (
    <section style={{ position: "relative", paddingTop: 140, paddingBottom: 80, overflow: "hidden", textAlign: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top, var(--primary-light) 0%, transparent 70%)", opacity: 0.4 }} />
      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: "var(--bg-card-nested)", border: "1px solid var(--border-light)", marginBottom: 20, animation: "fadeDown 0.6s ease" }}>
          <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 700 }}>New</span>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>AI-Powered Proctoring Now Available</span>
        </div>

        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, margin: "0 0 20px", animation: "fadeUp 0.7s ease 0.1s both" }}>
          Secure Online Exams with{" "}
          <span style={{ color: "var(--primary)" }}>AI Proctoring</span>
        </h1>

        <p style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: 600, margin: "0 auto 32px", lineHeight: 1.6, animation: "fadeUp 0.7s ease 0.2s both" }}>
          Ensure academic integrity with real-time AI monitoring, identity verification, and comprehensive analytics.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", animation: "fadeUp 0.7s ease 0.3s both" }}>
          <button onClick={() => navigate("/register")} style={{ ...HS.primaryBtn, padding: "14px 32px", fontSize: 16 }}>
            Get Started Free <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} />
          </button>
          <button onClick={() => navigate("/login")} style={{ ...HS.ghostBtn, padding: "14px 32px", fontSize: 16 }}>
            <i className="fas fa-play" style={{ marginRight: 8 }} /> Watch Demo
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 48, animation: "fadeUp 0.7s ease 0.4s both" }}>
          {[
            { val: "500+", label: "Institutions" },
            { val: "2M+", label: "Exams Proctored" },
            { val: "99.9%", label: "Uptime" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>{s.val}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════════ */
function FeaturesSection() {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const features = [
    { icon: "fa-video", title: "Live Video Monitoring", desc: "Real-time webcam monitoring with AI-powered detection of suspicious activities and multiple face detection." },
    { icon: "fa-brain", title: "AI Behavior Analysis", desc: "Advanced machine learning algorithms analyze student behavior patterns to detect cheating attempts." },
    { icon: "fa-user-shield", title: "Identity Verification", desc: "Secure facial recognition to confirm student identity before and during exams." },
    { icon: "fa-eye", title: "Eye Tracking", desc: "Monitor eye gaze direction to detect when students look away from the screen for extended periods." },
    { icon: "fa-lock", title: "Fullscreen Lockdown", desc: "Enforced fullscreen mode prevents students from accessing other applications or websites." },
    { icon: "fa-chart-bar", title: "Analytics Dashboard", desc: "Detailed reports and analytics on exam integrity, flagged incidents, and student performance." },
    { icon: "fa-hand-paper", title: "Hand Detection", desc: "AI detects hand gestures and suspicious movements near the camera during the exam." },
    { icon: "fa-robot", title: "AI Question Generator", desc: "Generate exam questions from images, PDFs, or text prompts using AI-powered extraction." },
  ];

  return (
    <section id="features" style={{ padding: "80px 0", background: "var(--bg-card)" }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px", opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(20px)", transition: "all 0.7s" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 12px" }}>Complete Proctoring Solution</h2>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.6 }}>Everything you need to ensure exam integrity with advanced AI technology.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 24,
              opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.5s ${i * 0.08}s`, cursor: "default",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary-light)", display: "grid", placeItems: "center", marginBottom: 14 }}>
                <i className={`fas ${f.icon}`} style={{ fontSize: 18, color: "var(--primary)" }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════ */
function HowItWorksSection() {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const steps = [
    { step: "01", title: "Setup Your Exam", desc: "Create your exam with customizable settings including time limits, question types, and proctoring rules.", items: ["Multiple question formats", "Time management tools", "Custom proctoring levels"] },
    { step: "02", title: "Student Verification", desc: "Students verify their identity through facial recognition and profile photo matching.", items: ["Profile photo matching", "Face detection", "Live camera check"] },
    { step: "03", title: "AI Monitors in Real-Time", desc: "Our AI continuously monitors student behavior, eye tracking, and hand gestures during the exam.", items: ["Eye gaze tracking", "Hand detection", "Tab switch monitoring"] },
    { step: "04", title: "Review & Reports", desc: "Get detailed violation recordings and comprehensive analytics after exam completion.", items: ["Video recordings", "Violation timeline", "Detailed analytics"] },
  ];

  return (
    <section id="how-it-works" style={{ padding: "80px 0" }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px", opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(20px)", transition: "all 0.7s" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 12px" }}>How It Works</h2>
          <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>Simple setup, powerful proctoring. Get started in minutes.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              position: "relative", padding: 28, borderRadius: 16, background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))",
              border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)",
              opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.5s ${i * 0.12}s`,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <span style={{ position: "absolute", top: -14, left: 20, background: "var(--primary)", color: "var(--text-on-primary)", padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 800 }}>{s.step}</span>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "12px 0 8px" }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>{s.desc}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {s.items.map((item, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                    <i className="fas fa-check-circle" style={{ color: "var(--primary)", fontSize: 14 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════ */
function TestimonialsSection() {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const testimonials = [
    { name: "Sarah Johnson", role: "Medical Student", inst: "Harvard Medical School", text: "The study resources helped me prepare for board exams. The proctoring system made remote exams stress-free.", score: "Improved score by 23%", initials: "SJ" },
    { name: "Michael Chen", role: "CS Major", inst: "MIT", text: "Mock exams under real proctoring conditions helped me build confidence. I knew exactly what to expect.", score: "98th percentile", initials: "MC" },
    { name: "Emily Rodriguez", role: "Law Student", inst: "Yale Law School", text: "The video tutorials and study guides are top-notch. Everything organized by topic and difficulty level.", score: "Top 5% in class", initials: "ER" },
    { name: "David Park", role: "Engineering", inst: "Stanford University", text: "As someone with test anxiety, the familiar proctoring environment made real exams feel much more comfortable.", score: "Improved 2 grades", initials: "DP" },
    { name: "Amanda Foster", role: "Business Admin", inst: "Wharton School", text: "The analytics dashboard showing my progress over time was incredibly motivating.", score: "Dean's List", initials: "AF" },
    { name: "James Wilson", role: "PhD Candidate", inst: "Oxford University", text: "ProctorGuard provides unparalleled exam security while maintaining a student-friendly experience.", score: "Published researcher", initials: "JW" },
  ];

  const stats = [
    { val: "98%", label: "Student Satisfaction" },
    { val: "2M+", label: "Exams Completed" },
    { val: "85%", label: "Score Improvement" },
    { val: "500+", label: "Partner Institutions" },
  ];

  return (
    <section id="testimonials" style={{ padding: "80px 0", background: "var(--bg-card)" }}>
      <div ref={ref} style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 40px", opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(20px)", transition: "all 0.7s" }}>
          <span style={{ display: "inline-block", background: "var(--primary-light)", color: "var(--primary-light-text)", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Student Success Stories</span>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 12px" }}>Trusted by Students Worldwide</h2>
          <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>See how students from top universities achieved their academic goals.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 32, opacity: vis ? 1 : 0, transition: "all 0.7s 0.1s" }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: 20, borderRadius: 14, background: "var(--glass-bg)", border: "1px solid var(--glass-border)", transition: "transform 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--primary)" }}>{s.val}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{
              background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", border: "1px solid var(--glass-border)", borderRadius: 16, padding: 24,
              opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.5s ${0.15 + i * 0.08}s`,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <i className="fas fa-quote-left" style={{ fontSize: 20, color: "var(--primary)", opacity: 0.3, marginBottom: 10, display: "block" }} />
              <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                {[1,2,3,4,5].map((s) => <i key={s} className="fas fa-star" style={{ fontSize: 12, color: "var(--primary)" }} />)}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 12 }}>{t.text}</p>
              <span style={{ display: "inline-block", background: "var(--primary-light)", color: "var(--primary-light-text)", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, marginBottom: 14 }}>{t.score}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--primary-light)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "var(--primary-light-text)" }}>{t.initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.role}</div>
                  <div style={{ fontSize: 11, color: "var(--primary)" }}>{t.inst}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════ */
function Footer() {
  const cols = {
    Product: ["Features", "Pricing", "Security", "Integrations"],
    Company: ["About", "Blog", "Careers", "Contact"],
    Resources: ["Documentation", "Help Center", "API Reference", "Status"],
    Legal: ["Privacy", "Terms", "Cookie Policy", "GDPR"],
  };

  return (
    <footer style={{ borderTop: "1px solid var(--border-light)", padding: "48px 0 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 32, marginBottom: 32 }}>
          <div style={{ gridColumn: "span 1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <i className="fas fa-shield-alt" style={{ fontSize: 20, color: "var(--primary)" }} />
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>OEPS</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Secure online examination proctoring for educational institutions.
            </p>
          </div>
          {Object.entries(cols).map(([title, links]) => (
            <div key={title}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>{title}</h4>
              {links.map((l) => (
                <div key={l} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, cursor: "pointer", transition: "color 0.2s" }}
                  onMouseEnter={(e) => e.target.style.color = "var(--text-primary)"}
                  onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}
                >{l}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>2025 OEPS. All rights reserved.</span>
          <div style={{ display: "flex", gap: 16 }}>
            {["fa-twitter", "fa-linkedin", "fa-github"].map((icon) => (
              <i key={icon} className={`fab ${icon}`} style={{ fontSize: 18, color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.target.style.color = "var(--text-primary)"}
                onMouseLeave={(e) => e.target.style.color = "var(--text-muted)"}
              />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══ Shared button styles ═══ */
const HS = {
  primaryBtn: {
    background: "var(--primary)", color: "var(--text-on-primary)", border: "none",
    padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14,
    cursor: "pointer", transition: "all 0.2s", display: "inline-flex", alignItems: "center",
  },
  ghostBtn: {
    background: "transparent", color: "var(--text-primary)",
    border: "1px solid var(--border-default)", padding: "10px 24px",
    borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
    transition: "all 0.2s", display: "inline-flex", alignItems: "center",
  },
};
