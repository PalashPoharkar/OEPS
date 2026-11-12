import { useEffect, useState, useRef, useContext } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { api } from "../services/apiclient";
import { AuthContext } from "../context/authContext";
import * as faceapi from "face-api.js";

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

export default function ExamCountdown() {
  const { examId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [examData, setExamData] = useState(location.state?.exam || null);
  const [profileData, setProfileData] = useState(null);

  // Steps: "pending" | "active" | "passed" | "failed" | "skipped"
  const [faceStatus, setFaceStatus] = useState("pending");
  const [audioStatus, setAudioStatus] = useState("pending");
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Face verification
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef = useRef(true);
  const refDescriptorsRef = useRef([]);
  const modelsReadyRef = useRef(false);
  const [faceHint, setFaceHint] = useState("");
  const [matchPercent, setMatchPercent] = useState(0);

  // Audio verification
  const [recording, setRecording] = useState(false);
  const [audioVerified, setAudioVerified] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [audioTimer, setAudioTimer] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioTimerRef = useRef(null);

  const refImages = [profileData?.face_image_url, profileData?.profile_photo_url].filter(Boolean);
  const hasFace = refImages.length > 0;
  const hasAudio = !!profileData?.audio_url;

  /* ---------- Fetch exam + profile ---------- */
  useEffect(() => {
    if (!examData) {
      supabase.from("exams").select("*").eq("id", examId).single()
        .then(({ data }) => { if (data) setExamData(data); });
    }
    api.get("/api/auth/profile").then((res) => setProfileData(res.data)).catch(() => setProfileData({}));
  }, [examId, examData]);

  /* ---------- Start verification flow once profile loads ---------- */
  useEffect(() => {
    if (!profileData) return;
    // Always start with face verification — even if no image, show the step
    setFaceStatus("active");
  }, [profileData]);

  /* ---------- Face verification: init ---------- */
  useEffect(() => {
    if (faceStatus !== "active") return;
    let cancelled = false;

    (async () => {
      try {
        setFaceHint("Starting camera...");

        // Step 1: Start camera + load ALL models in PARALLEL
        const [, stream] = await Promise.all([
          Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 320, height: 240 },
          }),
        ]);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        if (refImages.length === 0) {
          setFaceHint("No registered photo — upload a profile photo to enable verification");
          return;
        }

        // Step 2: Compute reference descriptors from registered images (in parallel)
        setFaceHint("Processing registered photo...");
        const detections = await Promise.all(
          refImages.map(async (url) => {
            try {
              const img = await faceapi.fetchImage(url);
              return await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
                .withFaceLandmarks().withFaceDescriptor();
            } catch { return null; }
          })
        );
        const descriptors = detections.filter(Boolean).map((d) => d.descriptor);
        if (cancelled) return;

        if (descriptors.length === 0) {
          setFaceStatus("failed");
          setFaceHint("Could not process registered photo");
          return;
        }
        refDescriptorsRef.current = descriptors;
        modelsReadyRef.current = true;
        setFaceHint("Look at the camera");
      } catch (err) {
        if (!cancelled) { setFaceStatus("failed"); setFaceHint("Camera error: " + err.message); }
      }
    })();

    return () => { cancelled = true; scanRef.current = false; };
  }, [faceStatus]);

  /* ---------- Face verification: scanning with REAL comparison ---------- */
  useEffect(() => {
    if (faceStatus !== "active") return;
    scanRef.current = true;

    // Scan every 600ms — uses tinyFaceDetector (fast) + real descriptor matching
    const interval = setInterval(async () => {
      if (!scanRef.current || !videoRef.current || !modelsReadyRef.current) return;
      try {
        const det = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks().withFaceDescriptor();

        if (!det) { setFaceHint("No face detected — look at the camera"); setMatchPercent(0); return; }

        // Real face comparison using euclidean distance
        const bestDistance = Math.min(
          ...refDescriptorsRef.current.map((ref) => faceapi.euclideanDistance(det.descriptor, ref))
        );
        const pct = Math.max(0, Math.min(100, Math.round((1 - bestDistance) * 100)));
        setMatchPercent(pct);

        // Threshold 0.55 — stricter than before, rejects different people
        if (bestDistance < 0.55) {
          scanRef.current = false;
          setMatchPercent(100);
          setFaceStatus("passed");
          setFaceHint("Face matched!");
          stopStream(streamRef.current);
          if (hasAudio) setTimeout(() => setAudioStatus("active"), 400);
          else setTimeout(() => setCountdownActive(true), 400);
          return;
        }
        setFaceHint("Face not matched — keep looking at the camera");
      } catch { /* skip frame */ }
    }, 600);

    // Auto-timeout after 20 seconds
    const timeout = setTimeout(() => {
      if (scanRef.current && faceStatus === "active") {
        setFaceStatus("failed");
        setFaceHint("Verification timed out");
        scanRef.current = false;
        stopStream(streamRef.current);
      }
    }, 20000);

    return () => { scanRef.current = false; clearInterval(interval); clearTimeout(timeout); };
  }, [faceStatus, hasAudio]);

  /* ---------- Audio verification ---------- */
  useEffect(() => { return () => clearInterval(audioTimerRef.current); }, []);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 1000) {
          setAudioVerified(true);
          setAudioStatus("passed");
          setTimeout(() => setCountdownActive(true), 400);
        } else {
          setAudioError("No audio detected. Try again.");
        }
      };

      mr.start();
      setRecording(true);
      setAudioError("");
      setAudioTimer(0);
      audioTimerRef.current = setInterval(() => setAudioTimer((t) => t + 1), 1000);

      setTimeout(() => {
        if (mr.state === "recording") { mr.stop(); setRecording(false); clearInterval(audioTimerRef.current); }
      }, 5000);
    } catch {
      setAudioError("Microphone access denied");
    }
  };

  const stopAudioEarly = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setRecording(false);
    clearInterval(audioTimerRef.current);
  };

  /* ---------- Skip handlers ---------- */
  const skipFace = () => {
    setFaceStatus("skipped");
    stopStream(streamRef.current);
    scanRef.current = false;
    if (hasAudio) setAudioStatus("active");
    else setCountdownActive(true);
  };

  const skipAudio = () => {
    setAudioStatus("skipped");
    setCountdownActive(true);
  };

  /* ---------- Countdown ---------- */
  useEffect(() => {
    if (!countdownActive) return;
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdownActive]);

  useEffect(() => {
    if (countdown === 0 && countdownActive) {
      stopStream(streamRef.current);
      navigate(`/student/exam/${examId}`, { state: { exam: examData }, replace: true });
    }
  }, [countdown, countdownActive, examId, examData, navigate]);

  // SVG ring
  const radius = 58;
  const circ = 2 * Math.PI * radius;
  const ringProgress = countdownActive ? ((10 - countdown) / 10) * circ : 0;

  const phrase = `My name is ${user?.full_name || "student"} and I am ready`;

  /* ---------- Build steps list ---------- */
  const steps = [];
  if (hasFace) steps.push({ id: "face", label: "Face Verification", status: faceStatus, icon: "fa-user-shield" });
  if (hasAudio) steps.push({ id: "audio", label: "Voice Verification", status: audioStatus, icon: "fa-microphone" });
  steps.push({ id: "countdown", label: "Exam Countdown", status: countdownActive ? "active" : "pending", icon: "fa-hourglass-start" });

  if (!profileData) {
    return (
      <div className="themed-page" style={S.page}>
        <div style={S.loadingCard}><div style={S.spinner} /><p style={{ color: "var(--text-secondary)", marginTop: 16 }}>Preparing verification...</p></div>
      </div>
    );
  }

  return (
    <div className="themed-page" style={S.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scanLine { 0%{top:0} 50%{top:calc(100% - 3px)} 100%{top:0} }
        @keyframes ringPulse { 0%,100%{filter:drop-shadow(0 0 4px rgba(34,197,94,0.3))} 50%{filter:drop-shadow(0 0 14px rgba(34,197,94,0.5))} }
        @keyframes audioWave { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1.2)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      <div style={S.card}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.examTitle}>{examData?.title || "Exam"}</div>
          <div style={S.examMeta}>
            {examData && (
              <>
                <span style={S.metaBadge}><i className="fas fa-clock" style={{ marginRight: 5 }} />{examData.duration_minutes || 30} min</span>
                <span style={S.metaBadge}><i className="fas fa-star" style={{ marginRight: 5 }} />{examData.total_marks || 100} marks</span>
              </>
            )}
          </div>
        </div>

        <div style={S.body}>
          {/* LEFT: Steps progress */}
          <div style={S.stepsCol}>
            <div style={S.stepsTitle}>Verification Steps</div>
            {steps.map((step, i) => (
              <div key={step.id} style={{ ...S.stepRow, animation: `fadeIn 0.3s ease ${i * 0.1}s both` }}>
                <div style={{
                  ...S.stepIcon,
                  background: step.status === "passed" ? "#DCFCE7" : step.status === "active" ? "#EFF6FF" : step.status === "failed" || step.status === "skipped" ? "#FEF3C7" : "var(--bg-card-nested)",
                  borderColor: step.status === "passed" ? "#22C55E" : step.status === "active" ? "#3B82F6" : step.status === "failed" ? "#F59E0B" : "var(--border-light)",
                  color: step.status === "passed" ? "#166534" : step.status === "active" ? "#1D4ED8" : step.status === "failed" ? "#92400E" : "var(--text-muted)",
                }}>
                  {step.status === "passed" ? (
                    <i className="fas fa-check" style={{ fontSize: 12 }} />
                  ) : step.status === "active" ? (
                    <div style={{ width: 10, height: 10, border: "2px solid #3B82F6", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  ) : step.status === "skipped" ? (
                    <i className="fas fa-forward" style={{ fontSize: 10 }} />
                  ) : step.status === "failed" ? (
                    <i className="fas fa-exclamation" style={{ fontSize: 11 }} />
                  ) : (
                    <i className={`fas ${step.icon}`} style={{ fontSize: 11 }} />
                  )}
                </div>
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div style={{ ...S.stepLine, background: step.status === "passed" ? "#22C55E" : "var(--border-light)" }} />
                )}
                <div style={S.stepInfo}>
                  <div style={{
                    ...S.stepLabel,
                    color: step.status === "active" ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: step.status === "active" ? 700 : 500,
                  }}>{step.label}</div>
                  <div style={S.stepStatus}>
                    {step.status === "passed" && <span style={{ color: "#166534" }}>Verified</span>}
                    {step.status === "active" && <span style={{ color: "#1D4ED8" }}>In progress...</span>}
                    {step.status === "skipped" && <span style={{ color: "#92400E" }}>Skipped</span>}
                    {step.status === "failed" && <span style={{ color: "#DC2626" }}>Failed</span>}
                    {step.status === "pending" && <span style={{ color: "var(--text-muted)" }}>Waiting</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: Active verification area */}
          <div style={S.activeCol}>
            {/* ── Face Verification ── */}
            {faceStatus === "active" && (
              <div style={S.verifySection}>
                <div style={S.sectionTitle}>
                  <i className="fas fa-user-shield" style={{ marginRight: 8, color: "#3B82F6" }} />
                  Identity Verification
                </div>

                {hasFace ? (
                  <>
                    {/* Side-by-side comparison */}
                    <div style={S.compareGrid}>
                      {/* Registered photos */}
                      <div style={S.compareSide}>
                        <div style={S.sideLabel}>Registered Image</div>
                        {refImages.map((url, i) => (
                          <div key={i} style={{
                            ...S.refImgBox,
                            borderColor: matchPercent >= 40 ? "#22C55E" : "var(--border-light)",
                          }}>
                            <img src={url} alt="ref" style={S.refImg} />
                            <div style={S.refTag}>{i === 0 && profileData?.face_image_url ? "Face ID" : "Profile Photo"}</div>
                          </div>
                        ))}
                        <div style={S.studentNameTag}>
                          <i className="fas fa-user" style={{ marginRight: 5 }} />
                          {profileData?.full_name || user?.full_name || "Student"}
                        </div>
                      </div>

                      {/* Match indicator */}
                      <div style={S.matchCol}>
                        <div style={{ ...S.matchLine, background: matchPercent > 0 ? "#22C55E" : "var(--border-light)" }} />
                        <div style={{
                          ...S.matchCircle,
                          borderColor: matchPercent >= 50 ? "#22C55E" : matchPercent > 0 ? "#F59E0B" : "var(--border-light)",
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: matchPercent >= 50 ? "#22C55E" : matchPercent > 0 ? "#F59E0B" : "#9CA3AF" }}>
                            {matchPercent}%
                          </span>
                        </div>
                        <div style={{ ...S.matchLine, background: matchPercent > 0 ? "#22C55E" : "var(--border-light)" }} />
                        <div style={S.matchLabel}>
                          {matchPercent >= 100 ? "Matched!" : matchPercent >= 45 ? "Matching..." : matchPercent > 0 ? "Comparing" : "Waiting"}
                        </div>
                      </div>

                      {/* Live camera */}
                      <div style={S.compareSide}>
                        <div style={S.sideLabel}>Live Camera</div>
                        <div style={{
                          ...S.liveBox,
                          borderColor: matchPercent >= 40 ? "#22C55E" : "var(--border-light)",
                        }}>
                          <video ref={videoRef} autoPlay playsInline muted style={S.liveVideo} />
                          <div style={S.faceGuide} />
                          <div style={S.scanLine} />
                          <div style={S.liveBadge}><span style={S.liveDot} /> LIVE</div>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={S.progressBar}>
                      <div style={{ ...S.progressFill, width: `${matchPercent}%`, background: matchPercent >= 50 ? "#22C55E" : "#F59E0B" }} />
                    </div>
                    <div style={S.faceHintText}>{faceHint}</div>
                  </>
                ) : (
                  <>
                    {/* No registered image — camera only */}
                    <div style={S.noImageWarn}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: 8, fontSize: 16 }} />
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>No registered photo found</div>
                        <div style={{ fontSize: 12, fontWeight: 400 }}>Upload a profile photo from your Profile page to enable face verification.</div>
                      </div>
                    </div>
                    <div style={{ ...S.liveBox, maxWidth: 300, margin: "12px auto" }}>
                      <video ref={videoRef} autoPlay playsInline muted style={S.liveVideo} />
                      <div style={S.liveBadge}><span style={S.liveDot} /> LIVE</div>
                    </div>
                    <div style={S.faceHintText}>{faceHint}</div>
                  </>
                )}
                <button style={S.skipBtn} onClick={skipFace}>
                  {hasFace ? "Skip face check" : "Continue without face check"}
                </button>
              </div>
            )}

            {/* Face failed */}
            {faceStatus === "failed" && !countdownActive && (
              <div style={S.verifySection}>
                <div style={{ ...S.sectionTitle, color: "#DC2626" }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
                  Face Verification Failed
                </div>
                <p style={S.failText}>{faceHint}</p>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button style={S.retryBtn} onClick={() => window.location.reload()}>
                    <i className="fas fa-redo" style={{ marginRight: 6 }} /> Retry
                  </button>
                  <button style={S.skipBtn} onClick={skipFace}>Continue Anyway</button>
                </div>
              </div>
            )}

            {/* ── Audio Verification ── */}
            {audioStatus === "active" && (
              <div style={S.verifySection}>
                <div style={S.sectionTitle}>
                  <i className="fas fa-microphone" style={{ marginRight: 8, color: "#8B5CF6" }} />
                  Voice Verification
                </div>

                <div style={S.phraseBox}>
                  <div style={S.phraseLabel}>Please say:</div>
                  <div style={S.phraseText}>"{phrase}"</div>
                </div>

                <div style={S.audioArea}>
                  {recording && (
                    <div style={{ textAlign: "center" }}>
                      <div style={S.audioTimerText}>{Math.floor(audioTimer / 60)}:{String(audioTimer % 60).padStart(2, "0")}</div>
                      <div style={S.waveRow}>
                        {[...Array(16)].map((_, i) => (
                          <div key={i} style={{
                            width: 4, background: "#DC2626", borderRadius: 2, height: 24,
                            animation: "audioWave 0.8s ease-in-out infinite",
                            animationDelay: `${i * 0.08}s`,
                          }} />
                        ))}
                      </div>
                      <div style={{ color: "#DC2626", fontWeight: 600, fontSize: 12, marginTop: 6 }}>Listening...</div>
                    </div>
                  )}
                  {audioVerified && (
                    <div style={{ textAlign: "center" }}>
                      <i className="fas fa-check-circle" style={{ fontSize: 40, color: "#22C55E" }} />
                      <div style={{ color: "#166534", fontWeight: 700, marginTop: 6 }}>Voice Verified!</div>
                    </div>
                  )}
                  {!recording && !audioVerified && (
                    <div style={{ textAlign: "center" }}>
                      <i className="fas fa-microphone-alt" style={{ fontSize: 36, color: "#9CA3AF" }} />
                      <div style={{ color: "#9CA3AF", marginTop: 8, fontSize: 12 }}>Tap the button below</div>
                    </div>
                  )}
                </div>

                {audioError && <div style={S.audioErr}>{audioError}</div>}

                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  {!recording && !audioVerified && (
                    <button style={S.recordBtn} onClick={startAudioRecording}>
                      <i className="fas fa-microphone" style={{ marginRight: 6 }} /> Start Recording
                    </button>
                  )}
                  {recording && (
                    <button style={S.stopRecBtn} onClick={stopAudioEarly}>
                      <i className="fas fa-stop" style={{ marginRight: 6 }} /> Done
                    </button>
                  )}
                </div>
                {!recording && !audioVerified && (
                  <button style={{ ...S.skipBtn, marginTop: 8 }} onClick={skipAudio}>Skip voice check</button>
                )}
              </div>
            )}

            {/* ── Countdown ── */}
            {countdownActive && (
              <div style={S.verifySection}>
                <div style={{ ...S.sectionTitle, color: "#22C55E" }}>
                  <i className="fas fa-shield-alt" style={{ marginRight: 8 }} />
                  {(faceStatus === "passed" || audioStatus === "passed") ? "Verification Complete" : "Starting Exam"}
                </div>

                {/* Show which checks passed */}
                <div style={S.resultBadges}>
                  {hasFace && (
                    <span style={{ ...S.resultBadge, background: faceStatus === "passed" ? "#DCFCE7" : "#FEF3C7", color: faceStatus === "passed" ? "#166534" : "#92400E" }}>
                      <i className={`fas ${faceStatus === "passed" ? "fa-check" : "fa-forward"}`} style={{ marginRight: 5 }} />
                      Face {faceStatus === "passed" ? "Verified" : "Skipped"}
                    </span>
                  )}
                  {hasAudio && (
                    <span style={{ ...S.resultBadge, background: audioStatus === "passed" ? "#DCFCE7" : "#FEF3C7", color: audioStatus === "passed" ? "#166534" : "#92400E" }}>
                      <i className={`fas ${audioStatus === "passed" ? "fa-check" : "fa-forward"}`} style={{ marginRight: 5 }} />
                      Voice {audioStatus === "passed" ? "Verified" : "Skipped"}
                    </span>
                  )}
                </div>

                {/* Ring countdown */}
                <div style={S.ringWrapper}>
                  <svg width="136" height="136" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="68" cy="68" r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="7" />
                    <circle cx="68" cy="68" r={radius} fill="none"
                      stroke={countdown <= 3 ? "#DC2626" : "#22C55E"}
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={circ} strokeDashoffset={circ - ringProgress}
                      style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
                    />
                  </svg>
                  <div style={S.ringCenter}>
                    <div style={{ ...S.ringNum, color: countdown <= 3 ? "#DC2626" : "#22C55E" }}>{countdown}</div>
                    <div style={S.ringLabel}>seconds</div>
                  </div>
                </div>
                <div style={S.countdownText}>Exam starts in {countdown}s</div>

                {/* Rules */}
                <div style={S.rulesBox}>
                  {[
                    { icon: "fa-video", text: "Camera must stay on" },
                    { icon: "fa-expand", text: "Stay in fullscreen" },
                    { icon: "fa-eye", text: "Eyes on screen" },
                    { icon: "fa-ban", text: "No tab switching" },
                  ].map((r, i) => (
                    <div key={i} style={S.ruleItem}>
                      <i className={`fas ${r.icon}`} style={{ color: "var(--text-muted)", fontSize: 11, width: 16, textAlign: "center" }} />
                      <span style={S.ruleText}>{r.text}</span>
                    </div>
                  ))}
                </div>

                <div style={S.warningBox}>
                  <i className="fas fa-info-circle" style={{ marginRight: 6, flexShrink: 0 }} />
                  5 extreme violations will auto-submit your exam
                </div>
              </div>
            )}

            {/* Waiting state when nothing is active yet */}
            {faceStatus === "pending" && audioStatus === "pending" && !countdownActive && (
              <div style={{ ...S.verifySection, textAlign: "center" }}>
                <div style={S.spinner} />
                <p style={{ color: "var(--text-secondary)", marginTop: 12 }}>Preparing...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function stopStream(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}

/* ─────── STYLES ─────── */
const S = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  loadingCard: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 20,
    border: "1px solid var(--glass-border)",
    padding: 48,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "4px solid var(--border-default)",
    borderTop: "4px solid var(--primary)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  card: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    borderRadius: 20,
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-shadow-lg)",
    maxWidth: 780,
    width: "100%",
    overflow: "hidden",
  },
  header: {
    padding: "20px 24px 16px",
    borderBottom: "1px solid var(--border-light)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  examTitle: { fontSize: 20, fontWeight: 800, color: "var(--text-primary)" },
  examMeta: { display: "flex", gap: 8 },
  metaBadge: {
    background: "var(--primary-bg)",
    color: "var(--primary-bg-text)",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
  },

  body: {
    display: "flex",
    gap: 0,
    minHeight: 420,
  },

  /* Steps column */
  stepsCol: {
    width: 200,
    padding: "20px 16px",
    borderRight: "1px solid var(--border-light)",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    flexShrink: 0,
  },
  stepsTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  stepRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    position: "relative",
    paddingBottom: 20,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "2px solid var(--border-light)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    position: "relative",
    zIndex: 1,
    transition: "all 0.3s",
  },
  stepLine: {
    position: "absolute",
    left: 13,
    top: 30,
    width: 2,
    height: "calc(100% - 30px)",
    background: "var(--border-light)",
    transition: "background 0.3s",
  },
  stepInfo: { paddingTop: 3 },
  stepLabel: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.2 },
  stepStatus: { fontSize: 11, marginTop: 2 },

  /* Active area */
  activeCol: {
    flex: 1,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  verifySection: {
    animation: "fadeIn 0.4s ease both",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "var(--text-primary)",
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
  },

  /* Face comparison grid */
  compareGrid: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    marginBottom: 10,
  },
  compareSide: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  sideLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  refImgBox: {
    position: "relative",
    width: "100%",
    aspectRatio: "4/3",
    borderRadius: 12,
    overflow: "hidden",
    border: "2px solid var(--border-light)",
    background: "#F4F6F8",
  },
  refImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  refTag: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 0",
    textTransform: "uppercase",
  },
  matchCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
    padding: "0 8px",
    minWidth: 52,
  },
  matchLine: {
    width: 2,
    height: 24,
    borderRadius: 1,
    background: "var(--border-light)",
    transition: "background 0.3s",
  },
  matchCircle: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "3px solid var(--border-light)",
    background: "rgba(255,255,255,0.8)",
    display: "grid",
    placeItems: "center",
    transition: "border-color 0.3s",
  },
  liveBox: {
    position: "relative",
    width: "100%",
    aspectRatio: "4/3",
    borderRadius: 12,
    overflow: "hidden",
    border: "2px solid var(--border-light)",
    background: "#000",
  },
  liveVideo: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  faceGuide: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: "55%",
    height: "72%",
    border: "2px dashed rgba(255,255,255,0.4)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    width: "100%",
    height: 2,
    background: "linear-gradient(90deg, transparent, #22C55E, transparent)",
    animation: "scanLine 2s ease-in-out infinite",
    pointerEvents: "none",
  },
  progressBar: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    background: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.5s ease, background 0.3s",
  },
  faceHintText: { fontSize: 12, color: "#6B7280", fontWeight: 500, marginBottom: 6 },
  studentNameTag: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    background: "var(--bg-card-nested)",
    border: "1px solid var(--border-light)",
    borderRadius: 8,
    padding: "4px 10px",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  matchLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#6B7280",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  liveBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    background: "rgba(220,38,38,0.85)",
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#fff",
    display: "inline-block",
  },
  noImageWarn: {
    display: "flex",
    alignItems: "flex-start",
    background: "#FEF3C7",
    color: "#92400E",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid #FDE68A",
    marginBottom: 8,
  },
  failText: { fontSize: 13, color: "#6B7280", marginBottom: 4 },

  /* Audio */
  phraseBox: {
    background: "#FEF3C7",
    border: "1px solid #FDE68A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    textAlign: "center",
  },
  phraseLabel: { fontSize: 10, fontWeight: 700, color: "#92400E", marginBottom: 4, textTransform: "uppercase" },
  phraseText: { fontSize: 14, fontWeight: 600, color: "#92400E" },
  audioArea: {
    background: "var(--bg-card-nested)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    minHeight: 100,
    display: "grid",
    placeItems: "center",
  },
  audioTimerText: { fontSize: 24, fontWeight: 800, color: "#DC2626", marginBottom: 6 },
  waveRow: { display: "flex", gap: 3, justifyContent: "center", alignItems: "center", height: 30 },
  audioErr: { background: "#FEF2F2", color: "#991B1B", padding: 8, borderRadius: 8, fontSize: 12, marginBottom: 8, textAlign: "center" },

  /* Buttons */
  skipBtn: {
    background: "none",
    border: "none",
    color: "#9CA3AF",
    cursor: "pointer",
    fontSize: 12,
    textDecoration: "underline",
    display: "block",
    margin: "0 auto",
  },
  retryBtn: {
    background: "#243946",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
  },
  recordBtn: {
    background: "#243946",
    color: "#fff",
    border: "none",
    padding: "10px 22px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
  },
  stopRecBtn: {
    background: "#DC2626",
    color: "#fff",
    border: "none",
    padding: "10px 22px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
  },

  /* Countdown */
  resultBadges: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 },
  resultBadge: {
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
  },
  ringWrapper: {
    position: "relative",
    width: 136,
    height: 136,
    margin: "0 auto 8px",
    animation: "ringPulse 2s ease-in-out infinite",
  },
  ringCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  ringNum: { fontSize: 40, fontWeight: 900, fontFamily: "monospace", lineHeight: 1 },
  ringLabel: { fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 },
  countdownText: { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center", marginBottom: 14 },

  rulesBox: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
    marginBottom: 10,
  },
  ruleItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 8px",
    background: "var(--bg-card-nested)",
    borderRadius: 8,
    border: "1px solid var(--border-light)",
  },
  ruleText: { fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 },

  warningBox: {
    display: "flex",
    alignItems: "center",
    background: "#FEF3C7",
    color: "#92400E",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 11,
    fontWeight: 600,
    border: "1px solid #FDE68A",
  },
};
