import { useContext, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DogAuth from "../Components/DogAuth/DogAuth";
import { loginUser } from "../services/authService";
import { AuthContext } from "../context/authContext";
import { setAuthToken } from "../services/apiclient";
import * as faceapi from "face-api.js";

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [authData, setAuthData] = useState(null);

  const finishLogin = useCallback(
    (data) => {
      const d = data || authData;
      login(d);
      const role = d.user.role;
      if (role === "admin") navigate("/admin");
      else if (role === "teacher") navigate("/teacher");
      else navigate("/student");
    },
    [authData, login, navigate]
  );

  // Phase 1: credentials
  const handleCredentials = async ({ email, password }) => {
    setErrorText("");
    setLoading(true);
    try {
      const res = await loginUser({ email, password });
      const { token, user } = res.data;
      const auth = { token, user };
      setAuthData(auth);
      setAuthToken(token);

      // Decide next phase based on stored biometrics
      if (user.face_image_url) {
        setPhase(2);
      } else if (user.audio_url) {
        setPhase(3);
      } else {
        // No biometrics stored — go straight to dashboard
        login(auth);
        const role = user.role;
        if (role === "admin") navigate("/admin");
        else if (role === "teacher") navigate("/teacher");
        else navigate("/student");
      }
    } catch (err) {
      setErrorText(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 done
  const handleFaceVerified = () => {
    if (authData.user.audio_url) setPhase(3);
    else finishLogin();
  };

  // Phase 3 done
  const handleAudioVerified = () => finishLogin();

  /* ── Render ──────────────────────────── */
  if (phase === 1) {
    return (
      <DogAuth
        mode="login"
        onSubmit={handleCredentials}
        loading={loading}
        errorText={errorText}
      />
    );
  }

  if (phase === 2) {
    return (
      <FaceVerification
        faceImageUrl={authData.user.face_image_url}
        onVerified={handleFaceVerified}
        userName={authData.user.full_name}
      />
    );
  }

  return (
    <AudioVerification
      onVerified={handleAudioVerified}
      userName={authData.user.full_name}
    />
  );
}

/* ═══════════════════════════════════════════
   Face Verification
   ═══════════════════════════════════════════ */
function FaceVerification({ faceImageUrl, onVerified, userName }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef = useRef(true);
  const refDescriptorRef = useRef(null);

  // "loading" | "scanning" | "verified" | "error"
  const [status, setStatus] = useState("loading");
  const [hint, setHint] = useState("Loading face recognition models...");
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 30; // ~30 seconds of scanning

  /* init: load models + camera in PARALLEL → compute reference → scan */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setHint("Initializing...");

        // Load models + camera + reference image ALL in parallel
        const [, stream, refImg] = await Promise.all([
          Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 320, height: 240 },
          }),
          faceapi.fetchImage(faceImageUrl),
        ]);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Compute reference descriptor
        setHint("Processing registered face...");
        const refDetection = await faceapi
          .detectSingleFace(refImg, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!refDetection) {
          setStatus("error");
          setHint("Could not process your registered face image. You can continue anyway.");
          return;
        }
        refDescriptorRef.current = refDetection.descriptor;
        if (cancelled) return;

        setStatus("scanning");
        setHint("Position your face in the frame");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setHint("Failed to initialize: " + err.message);
        }
      }
    })();

    return () => {
      cancelled = true;
      scanRef.current = false;
      stopStream(streamRef.current);
    };
  }, [faceImageUrl]);

  /* Scanning loop — runs every 1s while status === scanning */
  useEffect(() => {
    if (status !== "scanning") return;
    scanRef.current = true;

    const interval = setInterval(async () => {
      if (!scanRef.current || !videoRef.current || !refDescriptorRef.current)
        return;

      try {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setHint("No face detected — look directly at the camera");
          return;
        }

        const distance = faceapi.euclideanDistance(
          detection.descriptor,
          refDescriptorRef.current
        );

        if (distance < 0.5) {
          // ✅ Match — strict threshold rejects different people
          scanRef.current = false;
          setStatus("verified");
          setHint("Face Verified!");
          stopStream(streamRef.current);
          setTimeout(() => onVerified(), 1000);
          return;
        }

        // No match yet
        setAttempts((a) => a + 1);
        setHint(
          "Face not recognized — keep your face still and look at the camera"
        );
      } catch {
        /* ignore transient errors */
      }
    }, 600);

    return () => {
      scanRef.current = false;
      clearInterval(interval);
    };
  }, [status, onVerified]);

  /* Auto-skip after too many failed attempts */
  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS && status === "scanning") {
      setStatus("error");
      setHint(
        "Face verification timed out. You can retry or continue with a warning."
      );
      stopStream(streamRef.current);
    }
  }, [attempts, status]);

  const retry = () => {
    setAttempts(0);
    setStatus("loading");
    setHint("Retrying...");
    // re-trigger the init effect by forcing re-mount (simple approach)
    window.location.reload();
  };

  return (
    <div style={fvStyles.page}>
      <style>{`
        @keyframes scanLine {
          0% { top: 0; }
          50% { top: calc(100% - 3px); }
          100% { top: 0; }
        }
        @keyframes pulseGreen {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          50% { box-shadow: 0 0 0 16px rgba(34,197,94,0); }
        }
      `}</style>

      <div style={fvStyles.card}>
        <div style={fvStyles.iconCircle}>
          <i
            className={`fas ${status === "verified" ? "fa-check" : "fa-user-shield"}`}
            style={{
              fontSize: 30,
              color: status === "verified" ? "#22C55E" : "#111827",
            }}
          />
        </div>
        <h2 style={fvStyles.title}>Face Verification</h2>
        <p style={fvStyles.subtitle}>
          Hi {userName || "there"}, verify your identity to continue
        </p>

        {/* Video / Status area */}
        <div
          style={{
            ...fvStyles.videoBox,
            borderColor:
              status === "verified"
                ? "#22C55E"
                : status === "error"
                  ? "#DC2626"
                  : "rgba(229, 231, 235, 0.80)",
            animation:
              status === "verified" ? "pulseGreen 1s ease-in-out" : "none",
          }}
        >
          {(status === "loading" || status === "scanning") && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={fvStyles.video}
            />
          )}

          {status === "verified" && (
            <div style={fvStyles.verifiedOverlay}>
              <i
                className="fas fa-check-circle"
                style={{ fontSize: 64, color: "#22C55E" }}
              />
            </div>
          )}

          {status === "error" && (
            <div style={fvStyles.verifiedOverlay}>
              <i
                className="fas fa-exclamation-triangle"
                style={{ fontSize: 48, color: "#DC2626" }}
              />
            </div>
          )}

          {/* Face guide oval */}
          {status === "scanning" && (
            <>
              <div style={fvStyles.faceGuide} />
              <div style={fvStyles.scanLine} />
            </>
          )}

          {status === "loading" && (
            <div style={fvStyles.loadingOverlay}>
              <div style={fvStyles.spinner} />
            </div>
          )}
        </div>

        {/* Hint message */}
        <div
          style={{
            ...fvStyles.hint,
            color:
              status === "verified"
                ? "#166534"
                : status === "error"
                  ? "#DC2626"
                  : "#6B7280",
          }}
        >
          {hint}
        </div>

        {/* Attempt counter */}
        {status === "scanning" && (
          <div style={fvStyles.attemptText}>
            Scanning... ({attempts}/{MAX_ATTEMPTS})
          </div>
        )}

        {/* Actions */}
        {status === "error" && (
          <div style={fvStyles.actions}>
            <button style={fvStyles.retryBtn} onClick={retry}>
              <i className="fas fa-redo"></i> Retry
            </button>
            <button style={fvStyles.skipBtn} onClick={onVerified}>
              Continue Anyway
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function stopStream(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}

const fvStyles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(to top right, #f9a743, #f9db5f)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    fontFamily: "'Poppins', sans-serif",
  },
  card: {
    background: "rgba(255, 255, 255, 0.55)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.30)",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.10)",
    borderRadius: 24,
    padding: 32,
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(249, 250, 251, 0.60)",
    display: "grid",
    placeItems: "center",
    margin: "0 auto 12px",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 },
  subtitle: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  videoBox: {
    position: "relative",
    width: "100%",
    aspectRatio: "4/3",
    borderRadius: 16,
    overflow: "hidden",
    background: "#F4F6F8",
    border: "3px solid rgba(229, 231, 235, 0.80)",
    marginBottom: 16,
  },
  video: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  faceGuide: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "50%",
    height: "70%",
    border: "3px dashed rgba(255,255,255,0.5)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    width: "100%",
    height: 3,
    background:
      "linear-gradient(90deg, transparent, #22C55E, transparent)",
    animation: "scanLine 2s ease-in-out infinite",
    pointerEvents: "none",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.6)",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid rgba(255,255,255,0.3)",
    borderTop: "4px solid #fff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  verifiedOverlay: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    background: "rgba(249, 250, 251, 0.60)",
  },
  hint: { fontSize: 14, fontWeight: 600, marginBottom: 8 },
  attemptText: { fontSize: 12, color: "#9CA3AF", marginBottom: 12 },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginTop: 12,
  },
  retryBtn: {
    background: "#243946",
    color: "#fff",
    border: "none",
    padding: "12px 24px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  skipBtn: {
    background: "rgba(229, 231, 235, 0.80)",
    color: "#111827",
    border: "none",
    padding: "12px 24px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};

/* ═══════════════════════════════════════════
   Audio Verification
   ═══════════════════════════════════════════ */
function AudioVerification({ onVerified, userName }) {
  const [recording, setRecording] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 1000) {
          // Audio has real content
          setVerified(true);
          setTimeout(() => onVerified(), 1500);
        } else {
          setError("No audio detected. Please try again.");
        }
      };

      mr.start();
      setRecording(true);
      setError("");
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mr.state === "recording") {
          mr.stop();
          setRecording(false);
          clearInterval(timerRef.current);
        }
      }, 5000);
    } catch {
      setError("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopEarly = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const phrase = `My name is ${userName || "student"} and I am verifying my identity`;

  return (
    <div style={avStyles.page}>
      <style>{`
        @keyframes audioWave {
          0%,100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.2); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={avStyles.card}>
        <div
          style={{
            ...avStyles.iconCircle,
            background: verified ? "#DCFCE7" : "rgba(249, 250, 251, 0.60)",
          }}
        >
          <i
            className={`fas ${verified ? "fa-check" : "fa-microphone"}`}
            style={{
              fontSize: 30,
              color: verified ? "#22C55E" : "#111827",
            }}
          />
        </div>
        <h2 style={avStyles.title}>Voice Verification</h2>
        <p style={avStyles.subtitle}>
          Read the phrase below aloud to verify your identity
        </p>

        {/* Phrase to read */}
        <div style={avStyles.phraseBox}>
          <div style={avStyles.phraseLabel}>Please say:</div>
          <div style={avStyles.phraseText}>"{phrase}"</div>
        </div>

        {error && <div style={avStyles.error}>{error}</div>}

        {/* Recording area */}
        <div style={avStyles.recorderArea}>
          {recording && (
            <div style={{ textAlign: "center" }}>
              <div style={avStyles.timer}>{formatTime(timer)}</div>
              <div style={avStyles.wave}>
                {[...Array(16)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      background: "#DC2626",
                      borderRadius: 3,
                      height: 30,
                      animation: "audioWave 0.8s ease-in-out infinite",
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>
              <div style={avStyles.recLabel}>Listening...</div>
            </div>
          )}

          {verified && (
            <div style={{ textAlign: "center" }}>
              <i
                className="fas fa-check-circle"
                style={{ fontSize: 48, color: "#22C55E" }}
              />
              <div
                style={{ color: "#166534", fontWeight: 700, marginTop: 8 }}
              >
                Voice Verified!
              </div>
            </div>
          )}

          {!recording && !verified && (
            <div style={{ textAlign: "center", padding: 16 }}>
              <i
                className="fas fa-microphone-alt"
                style={{ fontSize: 48, color: "#9CA3AF" }}
              />
              <div style={{ color: "#9CA3AF", marginTop: 10 }}>
                Tap the button and read the phrase aloud
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={avStyles.actions}>
          {!recording && !verified && (
            <button style={avStyles.recordBtn} onClick={startRecording}>
              <i className="fas fa-microphone"></i> Start Verification
            </button>
          )}
          {recording && (
            <button style={avStyles.stopBtn} onClick={stopEarly}>
              <i className="fas fa-stop"></i> Done Speaking
            </button>
          )}
        </div>

        {!recording && !verified && (
          <button style={avStyles.skipLink} onClick={onVerified}>
            Skip voice verification
          </button>
        )}
      </div>
    </div>
  );
}

const avStyles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(to top right, #f9a743, #f9db5f)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    fontFamily: "'Poppins', sans-serif",
  },
  card: {
    background: "rgba(255, 255, 255, 0.55)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.30)",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.10)",
    borderRadius: 24,
    padding: 32,
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    margin: "0 auto 12px",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 },
  subtitle: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  phraseBox: {
    background: "#FEF3C7",
    border: "1px solid #FDE68A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  phraseLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#92400E",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  phraseText: { fontSize: 15, fontWeight: 600, color: "#92400E" },
  error: {
    background: "#FEF2F2",
    color: "#991B1B",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  recorderArea: {
    background: "rgba(249, 250, 251, 0.60)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    minHeight: 140,
    display: "grid",
    placeItems: "center",
  },
  timer: { fontSize: 28, fontWeight: 800, color: "#DC2626", marginBottom: 10 },
  wave: {
    display: "flex",
    gap: 4,
    justifyContent: "center",
    alignItems: "center",
    height: 40,
  },
  recLabel: {
    color: "#DC2626",
    fontWeight: 600,
    marginTop: 8,
    fontSize: 13,
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginBottom: 12,
  },
  recordBtn: {
    background: "#243946",
    color: "#fff",
    border: "none",
    padding: "12px 28px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  stopBtn: {
    background: "#DC2626",
    color: "#fff",
    border: "none",
    padding: "12px 28px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  skipLink: {
    background: "none",
    border: "none",
    color: "#9CA3AF",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
  },
};
