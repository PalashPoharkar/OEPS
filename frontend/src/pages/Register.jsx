import { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DogAuth from "../Components/DogAuth/DogAuth";
import { registerUser } from "../services/authService";
import { AuthContext } from "../context/authContext";
import { api, setAuthToken } from "../services/apiclient";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [authData, setAuthData] = useState(null);

  // Phase 1: Register credentials
  const handleCredentials = async (data) => {
    setErrorText("");
    setLoading(true);
    try {
      const res = await registerUser(data);
      setAuthData({ token: res.data.token, user: res.data.user });
      setAuthToken(res.data.token);
      setPhase(2);
    } catch (err) {
      setErrorText(err?.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Face capture done
  const handleFaceDone = async (base64) => {
    if (base64) {
      setLoading(true);
      try {
        await api.post("/api/auth/upload-face", { data: base64 });
      } catch (err) {
        console.error("Face upload failed:", err);
      }
      setLoading(false);
    }
    setErrorText("");
    setPhase(3);
  };

  // Phase 3: Audio done → finish
  const handleAudioDone = async (base64) => {
    if (base64) {
      setLoading(true);
      try {
        await api.post("/api/auth/upload-audio", { data: base64 });
      } catch (err) {
        console.error("Audio upload failed:", err);
      }
      setLoading(false);
    }
    login(authData);
    navigate("/student");
  };

  return (
    <div style={{ position: "relative" }}>
      <StepIndicator current={phase} />

      {phase === 1 && (
        <DogAuth
          mode="register"
          onSubmit={handleCredentials}
          loading={loading}
          errorText={errorText}
        />
      )}

      {phase === 2 && (
        <FaceCapture onDone={handleFaceDone} loading={loading} />
      )}

      {phase === 3 && (
        <AudioRecorder onDone={handleAudioDone} loading={loading} />
      )}
    </div>
  );
}

/* ─── Step Indicator ──────────────────────────── */
function StepIndicator({ current }) {
  const steps = [
    { num: 1, label: "Credentials" },
    { num: 2, label: "Face Capture" },
    { num: 3, label: "Voice Sample" },
  ];

  return (
    <div style={stepStyles.container}>
      {steps.map((s, i) => (
        <div key={s.num} style={stepStyles.stepRow}>
          <div
            style={{
              ...stepStyles.circle,
              background: current >= s.num ? "#111827" : "rgba(229, 231, 235, 0.80)",
              color: current >= s.num ? "#FFFFFF" : "#6B7280",
            }}
          >
            {current > s.num ? "\u2713" : s.num}
          </div>
          <div
            style={{
              ...stepStyles.label,
              color: current >= s.num ? "#111827" : "#9CA3AF",
              fontWeight: current === s.num ? 700 : 500,
            }}
          >
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                ...stepStyles.line,
                background: current > s.num ? "#111827" : "rgba(229, 231, 235, 0.80)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const stepStyles = {
  container: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    zIndex: 999,
    background: "rgba(255, 255, 255, 0.85)",
    padding: "10px 24px",
    borderRadius: 999,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
    backdropFilter: "blur(8px)",
  },
  stepRow: { display: "flex", alignItems: "center", gap: 6 },
  circle: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  label: { fontSize: 12, whiteSpace: "nowrap" },
  line: { width: 32, height: 2, borderRadius: 2, margin: "0 8px", flexShrink: 0 },
};

/* ─── Face Capture ──────────────────────────── */
function FaceCapture({ onDone, loading }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 360 },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("Camera access denied. Please allow camera access and try again.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.8));
    stopCamera();
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  return (
    <div style={faceStyles.page}>
      <div style={faceStyles.card}>
        <div style={faceStyles.icon}>
          <i className="fas fa-camera" style={{ fontSize: 32, color: "#111827" }}></i>
        </div>
        <h2 style={faceStyles.title}>Face Capture</h2>
        <p style={faceStyles.subtitle}>
          Position your face in the frame and capture a clear photo
        </p>

        {error && <div style={faceStyles.error}>{error}</div>}

        <div style={faceStyles.videoContainer}>
          {!captured ? (
            <video ref={videoRef} autoPlay playsInline muted style={faceStyles.video} />
          ) : (
            <img src={captured} alt="Captured face" style={faceStyles.video} />
          )}
          <div style={faceStyles.faceGuide} />
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div style={faceStyles.actions}>
          {!captured ? (
            <button style={faceStyles.captureBtn} onClick={capture} disabled={!!error}>
              <i className="fas fa-camera"></i> Capture Photo
            </button>
          ) : (
            <>
              <button style={faceStyles.retakeBtn} onClick={retake}>
                Retake
              </button>
              <button
                style={faceStyles.nextBtn}
                onClick={() => onDone(captured)}
                disabled={loading}
              >
                {loading ? "Uploading..." : "Next \u2192"}
              </button>
            </>
          )}
        </div>

        <button style={faceStyles.skipBtn} onClick={() => onDone(null)}>
          Skip this step
        </button>
      </div>
    </div>
  );
}

const faceStyles = {
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
    borderRadius: 24,
    padding: 32,
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.10)",
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(249, 250, 251, 0.60)",
    display: "grid",
    placeItems: "center",
    margin: "0 auto 12px",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 },
  subtitle: { color: "#6B7280", fontSize: 14, marginTop: 6, marginBottom: 20 },
  error: {
    background: "#FEF2F2",
    color: "#991B1B",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13,
  },
  videoContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: "4/3",
    borderRadius: 16,
    overflow: "hidden",
    background: "#111",
    marginBottom: 20,
  },
  video: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  faceGuide: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "55%",
    height: "75%",
    border: "3px dashed rgba(255,255,255,0.5)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  actions: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 },
  captureBtn: {
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
  retakeBtn: {
    background: "rgba(229, 231, 235, 0.80)",
    color: "#111827",
    border: "none",
    padding: "12px 24px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  nextBtn: {
    background: "#22C55E",
    color: "#022C22",
    border: "none",
    padding: "12px 28px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  skipBtn: {
    background: "none",
    border: "none",
    color: "#9CA3AF",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
    marginTop: 4,
  },
};

/* ─── Audio Recorder ──────────────────────────── */
function AudioRecorder({ onDone, loading }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const reRecord = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setTimer(0);
  };

  const handleSubmit = () => {
    if (!audioBlob) return onDone(null);
    const reader = new FileReader();
    reader.onloadend = () => onDone(reader.result);
    reader.readAsDataURL(audioBlob);
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={audioStyles.page}>
      {/* Inject keyframe animation */}
      <style>{`
        @keyframes audioWave {
          0% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.2); }
          100% { transform: scaleY(0.4); }
        }
      `}</style>

      <div style={audioStyles.card}>
        <div style={audioStyles.icon}>
          <i className="fas fa-microphone" style={{ fontSize: 32, color: "#111827" }}></i>
        </div>
        <h2 style={audioStyles.title}>Voice Sample</h2>
        <p style={audioStyles.subtitle}>Record a short voice sample for verification</p>

        {error && <div style={audioStyles.error}>{error}</div>}

        <div style={audioStyles.recorderArea}>
          {recording && (
            <div style={{ textAlign: "center" }}>
              <div style={audioStyles.timer}>{formatTime(timer)}</div>
              <div style={audioStyles.wave}>
                {[...Array(16)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      background: "#22C55E",
                      borderRadius: 3,
                      height: 30,
                      animation: "audioWave 0.8s ease-in-out infinite",
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>
              <div style={audioStyles.recordingLabel}>Recording...</div>
            </div>
          )}

          {audioUrl && !recording && (
            <div style={{ width: "100%" }}>
              <audio controls src={audioUrl} style={{ width: "100%" }} />
              <div style={{ color: "#6B7280", fontSize: 13, marginTop: 8, textAlign: "center" }}>
                Duration: {formatTime(timer)}
              </div>
            </div>
          )}

          {!recording && !audioUrl && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <i
                className="fas fa-microphone-alt"
                style={{ fontSize: 56, color: "rgba(229, 231, 235, 0.80)" }}
              ></i>
              <div style={{ color: "#9CA3AF", marginTop: 12 }}>
                Click below to start recording
              </div>
            </div>
          )}
        </div>

        <div style={audioStyles.actions}>
          {!recording && !audioUrl && (
            <button style={audioStyles.recordBtn} onClick={startRecording} disabled={!!error}>
              <i className="fas fa-microphone"></i> Start Recording
            </button>
          )}

          {recording && (
            <button style={audioStyles.stopBtn} onClick={stopRecording}>
              <i className="fas fa-stop"></i> Stop Recording
            </button>
          )}

          {audioUrl && !recording && (
            <>
              <button style={audioStyles.retakeBtn} onClick={reRecord}>
                Re-record
              </button>
              <button
                style={audioStyles.completeBtn}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Uploading..." : "Complete Registration"}
              </button>
            </>
          )}
        </div>

        <button style={audioStyles.skipBtn} onClick={() => onDone(null)}>
          Skip this step
        </button>
      </div>
    </div>
  );
}

const audioStyles = {
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
    borderRadius: 24,
    padding: 32,
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.10)",
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(249, 250, 251, 0.60)",
    display: "grid",
    placeItems: "center",
    margin: "0 auto 12px",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 },
  subtitle: { color: "#6B7280", fontSize: 14, marginTop: 6, marginBottom: 20 },
  error: {
    background: "#FEF2F2",
    color: "#991B1B",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13,
  },
  recorderArea: {
    background: "rgba(249, 250, 251, 0.60)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    minHeight: 160,
    display: "grid",
    placeItems: "center",
  },
  timer: { fontSize: 28, fontWeight: 800, color: "#DC2626", marginBottom: 12 },
  wave: {
    display: "flex",
    gap: 4,
    justifyContent: "center",
    alignItems: "center",
    height: 50,
  },
  recordingLabel: { color: "#DC2626", fontWeight: 600, marginTop: 10, fontSize: 13 },
  actions: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 },
  recordBtn: {
    background: "#DC2626",
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
    background: "#111827",
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
  retakeBtn: {
    background: "rgba(229, 231, 235, 0.80)",
    color: "#111827",
    border: "none",
    padding: "12px 24px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  completeBtn: {
    background: "#22C55E",
    color: "#022C22",
    border: "none",
    padding: "12px 28px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  skipBtn: {
    background: "none",
    border: "none",
    color: "#9CA3AF",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
    marginTop: 4,
  },
};
