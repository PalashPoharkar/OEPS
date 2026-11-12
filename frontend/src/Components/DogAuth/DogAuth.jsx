import { useEffect, useRef, useState, useCallback } from "react";
import "./DogAuth.css";

export default function DogAuth({
  mode = "login",
  onSubmit,
  loading = false,
  errorText = "",
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const eyesRef = useRef([]);
  const mouthsRef = useRef([]);
  const shapesRef = useRef(null);

  const title = mode === "login" ? "Welcome back!" : "Create Account";
  const subtitle = mode === "login"
    ? "Please enter your details to sign in"
    : "Register to start using OEPS";
  const buttonText = mode === "login" ? "Log In" : "Sign Up";

  /* ── Eye tracking ── */
  const handleMouseMove = useCallback((e) => {
    eyesRef.current.forEach((eye) => {
      if (!eye) return;
      const r = eye.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = 5;
      eye.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
    });
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  /* ── Mouth animation on email typing ── */
  useEffect(() => {
    mouthsRef.current.forEach((m) => {
      if (!m) return;
      if (email.length > 0) {
        m.style.transform = `translateX(-50%) scaleY(1.6) scaleX(1.2)`;
      } else {
        m.style.transform = `translateX(-50%) scaleY(1) scaleX(1)`;
      }
    });
  }, [email]);

  /* ── Password focus: eyes look away ── */
  const onPassFocus = () => {
    eyesRef.current.forEach((eye) => {
      if (eye) eye.style.transform = "translate(-8px, 4px)";
    });
  };
  const onPassBlur = () => {
    eyesRef.current.forEach((eye) => {
      if (eye) eye.style.transform = "translate(0, 0)";
    });
  };

  /* ── Toggle show password: eyes peek ── */
  const toggleShow = () => {
    setShowPass((p) => !p);
    if (!showPass) {
      // peeking
      eyesRef.current.forEach((eye) => {
        if (eye) eye.style.transform = "translate(-3px, 2px)";
      });
    } else {
      eyesRef.current.forEach((eye) => {
        if (eye) eye.style.transform = "translate(-8px, 4px)";
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    onSubmit?.({
      full_name: fullName.trim(),
      email: email.trim(),
      password: password.trim(),
    });
  };

  const addEyeRef = (el) => {
    if (el && !eyesRef.current.includes(el)) eyesRef.current.push(el);
  };

  const addMouthRef = (el) => {
    if (el && !mouthsRef.current.includes(el)) mouthsRef.current.push(el);
  };

  return (
    <div className="dogAuthWrap">
      <div className={`authCard ${errorText ? "errorPulse" : ""}`} key={errorText}>

        {/* ═══ LEFT: Shapes illustration ═══ */}
        <div className="authIllustration">
          <div className="shapesArea" ref={shapesRef}>

            {/* Purple tall shape */}
            <div className="shape shapePurple">
              <div className="shapeEyes">
                <span className="shapeEye no-pupil" ref={addEyeRef} />
                <span className="shapeEye no-pupil" ref={addEyeRef} />
              </div>
              <div className="shapeMouth" ref={addMouthRef} />
            </div>

            {/* Dark shape */}
            <div className="shape shapeDark">
              <div className="shapeEyes">
                <span className="shapeEye dark-eye" ref={addEyeRef} />
                <span className="shapeEye dark-eye" ref={addEyeRef} />
              </div>
            </div>

            {/* Yellow dome */}
            <div className="shape shapeYellow">
              <div className="shapeEyes">
                <span className="shapeEye solid-eye" ref={addEyeRef} />
                <span className="shapeEye solid-eye" ref={addEyeRef} />
              </div>
              <div className="shapeMouth big" ref={addMouthRef} />
            </div>

            {/* Orange wide shape */}
            <div className="shape shapeOrange">
              <div className="shapeEyes">
                <span className="shapeEye solid-eye" ref={addEyeRef} />
                <span className="shapeEye solid-eye" ref={addEyeRef} />
              </div>
              <div className="shapeMouth big" ref={addMouthRef} />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Form ═══ */}
        <div className="authFormSide">
          <div className="authFormInner">
            <div className="authLogo">O</div>
            <h1 className="authTitle">{title}</h1>
            <p className="authSubtitle">{subtitle}</p>

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="authField">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="authField">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="authField">
                <label>Password</label>
                <div className="authPasswordWrap">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={onPassFocus}
                    onBlur={onPassBlur}
                    required
                  />
                  <button type="button" className="authShowBtn" onClick={toggleShow}>
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {mode === "login" && (
                <div className="authRow">
                  <label className="authCheckbox">
                    <input type="checkbox" /> Remember for 30 days
                  </label>
                  <a href="/forgot-password">Forgot?</a>
                </div>
              )}

              {errorText && <div className="authError">{errorText}</div>}

              <button className="authSubmitBtn" disabled={loading}>
                {loading ? "Please wait..." : buttonText}
              </button>
            </form>

            <div className="authFooter">
              {mode === "login" ? (
                <p>Don't have an account? <a href="/register">Sign Up</a></p>
              ) : (
                <p>Already have an account? <a href="/login">Sign In</a></p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
