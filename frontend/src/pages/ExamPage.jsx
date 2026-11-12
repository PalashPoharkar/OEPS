import { useEffect, useState, useRef, useContext } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { FaceLandmarker, HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { AuthContext } from "../context/authContext";
import { supabase } from "../supabaseClient";
import { api } from "../services/apiclient";
import { fetchQuestionsByExam } from "../services/questionService";
import { useIsMobile } from "../hooks/useMediaQuery";

export default function ExamPage() {
  const { examId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isMobile = useIsMobile();

  const [examData, setExamData] = useState(location.state?.exam || null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);

  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [gazeStatus, setGazeStatus] = useState("Initializing...");
  const [warningLevel, setWarningLevel] = useState("none"); // "none" | "mild" | "extreme"
  const [warningMessage, setWarningMessage] = useState("");
  const [proctorReady, setProctorReady] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const hasSubmitted = useRef(false);
  const faceLandmarkerRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const animFrameRef = useRef(null);
  const extremeCountRef = useRef(0);
  const prevExtremeRef = useRef(false); // debounce extreme transitions
  const [violations, setViolations] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // --- Continuous rolling buffer recording ---
  const streamRef = useRef(null);
  const rollingRecorderRef = useRef(null);
  const rollingChunksRef = useRef([]); // keeps last ~12 seconds of video data
  const clipCountRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const uploadQueueRef = useRef([]); // queue of pending uploads
  const isUploadingRef = useRef(false);

  useEffect(() => { streamRef.current = stream; }, [stream]);

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  /* Start continuous recording as soon as camera stream is available */
  useEffect(() => {
    if (!stream) return;
    const liveTracks = stream.getVideoTracks().filter((t) => t.readyState === "live");
    if (liveTracks.length === 0) return;

    try {
      // Clone tracks so video display isn't affected
      const clonedStream = new MediaStream(liveTracks.map((t) => t.clone()));

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
      const mr = mimeType
        ? new MediaRecorder(clonedStream, { mimeType })
        : new MediaRecorder(clonedStream);

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          rollingChunksRef.current.push(e.data);
          // Keep only last 6 chunks (~12 seconds at 2s per chunk)
          if (rollingChunksRef.current.length > 6) {
            rollingChunksRef.current.shift();
          }
        }
      };
      mr.onerror = () => console.warn("Rolling recorder error");

      // Record in 2-second chunks continuously
      mr.start(2000);
      rollingRecorderRef.current = mr;
      console.log("✅ Continuous rolling recorder started");

      return () => {
        if (mr.state === "recording") mr.stop();
        clonedStream.getTracks().forEach((t) => t.stop());
        rollingRecorderRef.current = null;
      };
    } catch (err) {
      console.error("Rolling recorder failed to start:", err);
    }
  }, [stream]);

  /* Grab a 10-second clip from the rolling buffer and upload it */
  const captureViolationClip = (violationType) => {
    if (clipCountRef.current >= 15 || hasSubmitted.current) return;
    const chunks = [...rollingChunksRef.current]; // snapshot of current buffer

    if (chunks.length === 0) return;

    // Build a blob from the buffered chunks (up to ~12 seconds of footage)
    const mimeType = rollingRecorderRef.current?.mimeType || "video/webm";
    const blob = new Blob(chunks, { type: mimeType });

    if (blob.size < 500) return;

    clipCountRef.current += 1;
    setIsRecording(true);
    console.log(`📹 Captured violation clip: ${violationType}, ${Math.round(blob.size / 1024)}KB, chunks: ${chunks.length}`);

    // Queue the upload (don't block the UI)
    uploadQueueRef.current.push({ blob, violationType });
    processUploadQueue();

    // Brief visual indicator
    setTimeout(() => setIsRecording(false), 1500);
  };

  /* Process upload queue one at a time */
  const processUploadQueue = async () => {
    if (isUploadingRef.current || uploadQueueRef.current.length === 0) return;
    isUploadingRef.current = true;

    while (uploadQueueRef.current.length > 0) {
      const { blob, violationType } = uploadQueueRef.current.shift();
      try {
        const base64 = await blobToBase64(blob);
        console.log("Uploading clip:", violationType, Math.round(base64.length / 1024), "KB");
        await api.post("/api/exams/proctoring/upload-clip", {
          exam_id: examId,
          violation_type: violationType,
          video_data: base64,
        });
        console.log("✅ Violation clip uploaded:", violationType);
      } catch (err) {
        console.error("Upload failed:", err.response?.data || err.message);
      }
    }
    isUploadingRef.current = false;
  };

  /* Upload full violation log on exam submit */
  const uploadViolationLog = async (allViolations) => {
    try {
      await api.post("/api/exams/proctoring/save-log", {
        exam_id: examId,
        violations: allViolations,
      });
      console.log("✅ Violation log saved");
    } catch (err) {
      console.error("Log save failed:", err.response?.data || err.message);
    }
  };

  const addViolation = (type) => {
    setViolations((prev) => [...prev, { type, time: new Date().toISOString() }]);
    // Capture a 10-second clip from the rolling buffer
    captureViolationClip(type);
  };

  /* ---------- Capture snapshot from video as base64 JPEG ---------- */
  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  };

  /* ---------- Upload snapshot as evidence (fallback if video recording fails) ---------- */
  const uploadSnapshotAsClip = async (snapshot, violationType) => {
    try {
      console.log("Uploading snapshot for:", violationType);
      await api.post("/api/exams/proctoring/upload-clip", {
        exam_id: examId,
        violation_type: violationType,
        video_data: snapshot, // backend handles both image/* and video/* data
      });
      console.log("Snapshot evidence uploaded:", violationType);
    } catch (err) {
      console.error("Snapshot upload failed:", err.response?.data || err.message);
    }
  };

  /* ---------- AI Object Detection — runs every 20 seconds ---------- */
  useEffect(() => {
    if (!stream || hasSubmitted.current) return;
    let active = true;

    const analyzeFrame = async () => {
      if (!active || hasSubmitted.current || !videoRef.current) return;
      const snapshot = captureSnapshot();
      if (!snapshot) return;

      try {
        const { data } = await api.post("/api/ai/analyze-snapshot", { image_data: snapshot });

        if (data.cheating && data.confidence > 0.5) {
          console.log("AI detected cheating:", data.violations, data.description);

          // Add each detected violation
          const types = data.violations || [];
          const mainType = types.includes("mobile phone") ? "phone_detected"
            : types.includes("book") || types.includes("notes") || types.includes("papers") ? "notes_detected"
            : types.includes("earphones") || types.includes("earbuds") ? "earphone_detected"
            : types.includes("another person") ? "another_person"
            : types.includes("smart watch") ? "smartwatch_detected"
            : "suspicious_object";

          extremeCountRef.current += 1;
          addViolation(mainType, true);
          setWarningLevel("extreme");
          setWarningMessage(
            `WARNING ${extremeCountRef.current}/5: ${data.description || "Suspicious object detected!"}`
          );

          // Also upload the snapshot as evidence
          uploadSnapshotAsClip(snapshot, mainType);

          if (extremeCountRef.current >= 5 && !hasSubmitted.current) {
            hasSubmitted.current = true;
            setTimeout(() => handleSubmitExam(), 0);
          }
        }
      } catch {
        // AI analysis failed silently — don't disrupt exam
      }
    };

    // First analysis after 10 seconds, then every 20 seconds
    const initialTimeout = setTimeout(analyzeFrame, 10000);
    const interval = setInterval(analyzeFrame, 20000);

    return () => {
      active = false;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [stream]);

  /* ---------- Fullscreen enforcement ---------- */
  useEffect(() => {
    const enterFullscreen = () => {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) req.call(el).catch(() => {});
    };

    // Enter fullscreen on mount
    enterFullscreen();

    const handleFsChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && !hasSubmitted.current) {
        // Student exited fullscreen — count as violation
        extremeCountRef.current += 1;
        addViolation("fullscreen_exit", true);
        setWarningLevel("extreme");
        setWarningMessage(
          `WARNING ${extremeCountRef.current}/5: Fullscreen exited! Re-entering...`
        );
        if (extremeCountRef.current >= 5) {
          hasSubmitted.current = true;
          setTimeout(() => handleSubmitExam(), 0);
          return;
        }
        // Re-enter fullscreen after a short delay
        setTimeout(enterFullscreen, 500);
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  /* ---------- Tab-switch detection + screenshot ---------- */
  useEffect(() => {
    let leftAt = null;

    const handleVisibility = () => {
      if (hasSubmitted.current) return;

      if (document.hidden) {
        // Student left the tab — record the time
        leftAt = Date.now();
        extremeCountRef.current += 1;
        addViolation("tab_switch");
        setWarningLevel("extreme");
        setWarningMessage(
          `WARNING ${extremeCountRef.current}/5: Tab switch detected!`
        );

        // Also capture a webcam snapshot immediately (what they looked like leaving)
        const snap = captureSnapshot();
        if (snap) uploadSnapshotAsClip(snap, "tab_switch_left");

        if (extremeCountRef.current >= 5) {
          hasSubmitted.current = true;
          setTimeout(() => handleSubmitExam(), 0);
        }
      } else if (leftAt) {
        // Student returned — capture a snapshot of them returning
        const awayTime = Math.round((Date.now() - leftAt) / 1000);
        leftAt = null;
        console.log(`Student returned after ${awayTime}s`);

        // Capture webcam snapshot on return
        setTimeout(() => {
          const snap = captureSnapshot();
          if (snap) uploadSnapshotAsClip(snap, "tab_switch_return");
        }, 500);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  /* ---------- Block copy/paste/right-click ---------- */
  useEffect(() => {
    const block = (e) => {
      e.preventDefault();
      addViolation(e.type);
    };

    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("contextmenu", block);

    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("contextmenu", block);
    };
  }, []);

  /* ---------- Block keyboard shortcuts (DevTools, View Source, Print) ---------- */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (hasSubmitted.current) return;
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        addViolation("blocked_shortcut");
        return;
      }
      // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element picker)
      if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
        e.preventDefault();
        addViolation("blocked_shortcut");
        return;
      }
      // Ctrl+U (View Source), Ctrl+P (Print)
      if (e.ctrlKey && !e.shiftKey && ["u", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        addViolation("blocked_shortcut");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ---------- DevTools detection (window size heuristic) ---------- */
  useEffect(() => {
    let devtoolsFlagged = false;

    const checkDevTools = () => {
      if (hasSubmitted.current) return;
      const widthDiff = window.outerWidth - window.innerWidth > 160;
      const heightDiff = window.outerHeight - window.innerHeight > 160;
      if ((widthDiff || heightDiff) && !devtoolsFlagged) {
        devtoolsFlagged = true;
        extremeCountRef.current += 1;
        addViolation("devtools_open", true);
        setWarningLevel("extreme");
        setWarningMessage(
          `WARNING ${extremeCountRef.current}/5: Developer tools detected!`
        );
        if (extremeCountRef.current >= 5) {
          hasSubmitted.current = true;
          setTimeout(() => handleSubmitExam(), 0);
        }
      } else if (!widthDiff && !heightDiff) {
        devtoolsFlagged = false;
      }
    };

    const interval = setInterval(checkDevTools, 2000);
    return () => clearInterval(interval);
  }, []);

  /* ---------- Window blur detection (Alt+Tab, clicking other apps) ---------- */
  useEffect(() => {
    const handleBlur = () => {
      if (hasSubmitted.current || document.hidden) return;
      extremeCountRef.current += 1;
      addViolation("window_blur");
      setWarningLevel("extreme");
      setWarningMessage(
        `WARNING ${extremeCountRef.current}/5: Window lost focus!`
      );

      // Capture webcam snapshot when window loses focus
      const snap = captureSnapshot();
      if (snap) uploadSnapshotAsClip(snap, "window_blur");

      if (extremeCountRef.current >= 5) {
        hasSubmitted.current = true;
        setTimeout(() => handleSubmitExam(), 0);
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  /* ---------- Screen resize detection ---------- */
  useEffect(() => {
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;

    const handleResize = () => {
      if (hasSubmitted.current) return;
      const widthShrink = window.innerWidth < initialWidth * 0.8;
      const heightShrink = window.innerHeight < initialHeight * 0.8;
      if (widthShrink || heightShrink) {
        addViolation("screen_resize");
        setWarningLevel("mild");
        setWarningMessage("Window resized — please keep the exam in full screen");
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ---------- Fallback: fetch exam if no route state ---------- */
  useEffect(() => {
    if (examData) return;
    const fetchExam = async () => {
      const { data } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();
      if (data) setExamData(data);
    };
    fetchExam();
  }, [examId, examData]);

  /* ---------- Camera: start immediately ---------- */
  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: false,
        });
        if (!mounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(mediaStream);
      } catch {
        if (mounted) setCameraError("Camera unavailable");
      }
    };

    startCamera();
    return () => { mounted = false; };
  }, []);

  /* ---------- Bind stream to video element ---------- */
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  /* ---------- Clean up stream on unmount ---------- */
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  /* ---------- Proctoring: init FaceLandmarker + HandLandmarker ---------- */
  useEffect(() => {
    let cancelled = false;

    const createFace = async (vision, delegate) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate,
        },
        runningMode: "VIDEO",
        numFaces: 2,
      });

    const createHand = async (vision, delegate) =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate,
        },
        runningMode: "VIDEO",
        numHands: 2,
      });

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        if (cancelled) return;

        // Try GPU first, fall back to CPU
        let face, hand;
        try {
          face = await createFace(vision, "GPU");
          hand = await createHand(vision, "GPU");
        } catch {
          face = await createFace(vision, "CPU");
          hand = await createHand(vision, "CPU");
        }

        if (cancelled) {
          face.close();
          hand.close();
          return;
        }
        faceLandmarkerRef.current = face;
        handLandmarkerRef.current = hand;
        setProctorReady(true);
      } catch {
        setGazeStatus("Proctoring unavailable");
      }
    };

    init();
    return () => {
      cancelled = true;
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
    };
  }, []);

  /* ---------- Proctoring: detection loop ---------- */
  useEffect(() => {
    if (!stream || !proctorReady || !faceLandmarkerRef.current || !videoRef.current) return;

    let lastTime = -1;
    let frameCount = 0;

    const getRatio = (landmarks, eyeCorners, irisIdx) => {
      const left = landmarks[eyeCorners[0]];
      const right = landmarks[eyeCorners[1]];
      const iris = landmarks[irisIdx];
      const eyeW = Math.hypot(right.x - left.x, right.y - left.y);
      if (eyeW === 0) return 0.5;
      const irisD = Math.hypot(iris.x - left.x, iris.y - left.y);
      return irisD / eyeW;
    };

    const detect = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !faceLandmarkerRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      // Run detection every 6th frame (~10fps) to save CPU
      frameCount++;
      if (frameCount % 6 !== 0) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const now = performance.now();
      if (video.currentTime === lastTime) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      lastTime = video.currentTime;

      let isExtreme = false;
      let isMild = false;
      let extremeMsg = "";
      let mildMsg = "";
      let gaze = "Focused";

      try {
        // --- Face detection ---
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
        const faceCount = faceResult.faceLandmarks?.length || 0;

        if (faceCount >= 2) {
          isExtreme = true;
          extremeMsg = "Multiple faces detected! Only the student should be visible";
          gaze = "Multiple Faces";
        } else if (faceCount === 0) {
          isExtreme = true;
          extremeMsg = "No face detected! Please face the camera";
          gaze = "No Face Detected";
        } else {
          // Single face — eye tracking
          const lm = faceResult.faceLandmarks[0];
          if (lm.length >= 478) {
            const leftRatio = getRatio(lm, [33, 133], 468);
            const rightRatio = getRatio(lm, [362, 263], 473);
            const avg = (leftRatio + rightRatio) / 2;

            if (avg < 0.25 || avg > 0.75) {
              // Extreme eye movement
              isExtreme = true;
              extremeMsg = "Extreme eye movement detected!";
              gaze = avg < 0.25 ? "Looking Right" : "Looking Left";
            } else if (avg < 0.35) {
              isMild = true;
              mildMsg = "Please keep your eyes on the screen";
              gaze = "Looking Right";
            } else if (avg > 0.65) {
              isMild = true;
              mildMsg = "Please keep your eyes on the screen";
              gaze = "Looking Left";
            } else if (avg >= 0.42 && avg <= 0.58) {
              gaze = "Focused";
            } else {
              isMild = true;
              mildMsg = "Please focus on your exam";
              gaze = "Looking Away";
            }
          }
        }

        // --- Hand detection ---
        if (handLandmarkerRef.current) {
          const handResult = handLandmarkerRef.current.detectForVideo(video, now);
          if (handResult.landmarks && handResult.landmarks.length > 0) {
            isExtreme = true;
            extremeMsg = "Hand gestures detected! Keep hands away from camera";
            gaze = gaze === "Focused" ? "Hands Detected" : gaze;
          }
        }
      } catch {
        // Detection error, skip frame
      }

      // --- Update gaze status ---
      setGazeStatus(gaze);

      // --- Warning level logic (debounced extreme counter) ---
      if (isExtreme) {
        if (!prevExtremeRef.current) {
          // Transition to extreme — increment counter
          extremeCountRef.current += 1;
          prevExtremeRef.current = true;
          // Log violation + record clip
          const vType = gaze === "Multiple Faces" ? "multiple_faces"
            : gaze === "No Face Detected" ? "no_face"
            : gaze === "Hands Detected" ? "hand_gesture"
            : "extreme_gaze";
          addViolation(vType, true);
        }
        setWarningLevel("extreme");
        setWarningMessage(
          `WARNING ${extremeCountRef.current}/5: ${extremeMsg}`
        );

        if (extremeCountRef.current >= 5 && !hasSubmitted.current) {
          hasSubmitted.current = true;
          setTimeout(() => handleSubmitExam(), 0);
          return;
        }
      } else if (isMild) {
        prevExtremeRef.current = false;
        setWarningLevel("mild");
        setWarningMessage(mildMsg);
      } else {
        prevExtremeRef.current = false;
        setWarningLevel("none");
        setWarningMessage("");
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [stream, proctorReady]);

  /* ---------- Fetch questions ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchQuestionsByExam(examId);
        setQuestions(data || []);
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [examId]);

  /* ---------- Initialize timer once exam data is available ---------- */
  useEffect(() => {
    if (!examData || timeLeft !== null) return;
    setTimeLeft((examData.duration_minutes || 30) * 60);
  }, [examData, timeLeft]);

  /* ---------- Countdown timer ---------- */
  useEffect(() => {
    if (timeLeft === null) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!hasSubmitted.current) {
            hasSubmitted.current = true;
            setTimeout(() => handleSubmitExam(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft !== null]);

  /* ---------- Helpers ---------- */
  const formatTime = (seconds) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const selectAnswer = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const goToQuestion = (index) => setCurrentIndex(index);
  const goNext = () => setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
  const goPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));

  const handleSubmitExam = async () => {
    // Stop rolling recorder
    if (rollingRecorderRef.current?.state === "recording") {
      rollingRecorderRef.current.stop();
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    // Stop proctoring
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (faceLandmarkerRef.current) {
      faceLandmarkerRef.current.close();
      faceLandmarkerRef.current = null;
    }
    if (handLandmarkerRef.current) {
      handLandmarkerRef.current.close();
      handLandmarkerRef.current = null;
    }
    // Stop camera
    if (stream) stream.getTracks().forEach((t) => t.stop());

    // Calculate score
    let score = 0;
    let totalMarks = 0;
    const results = questions.map((q) => {
      const marks = q.marks || 1;
      totalMarks += marks;
      const studentAnswer = answers[q.id] || null;
      const correct = studentAnswer === q.correct_option;
      if (correct) score += marks;
      return {
        question: q.question,
        studentAnswer,
        correctAnswer: q.correct_option,
        correct,
        marks,
      };
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passed = percentage >= 40;

    // Save exam result + update dashboard stats via backend API
    if (user?.id) {
      try {
        // Save full exam result as JSON
        await api.post("/api/students/results", {
          exam_id: examId,
          exam_title: examData?.title,
          score,
          total_marks: totalMarks,
          percentage,
          passed,
          results,
          violations,
        });

        // Update dashboard aggregate stats
        const { data: profile } = await api.get("/api/students/me");
        const newTotal = (profile?.total_exams || 0) + 1;
        const newPassed = (profile?.passed_exams || 0) + (passed ? 1 : 0);
        const passRate = Math.round((newPassed / newTotal) * 100);
        const grade =
          passRate >= 90 ? "A+" :
          passRate >= 80 ? "A" :
          passRate >= 70 ? "B" :
          passRate >= 60 ? "C" :
          passRate >= 50 ? "D" : "F";

        await api.patch("/api/students/dashboard", {
          total_exams: newTotal,
          passed_exams: newPassed,
          grade,
        });

      } catch (err) {
        console.log("Dashboard update failed:", err.response?.data || err.message);
      }
    }

    // Always upload violation log (even if dashboard update fails)
    if (violations.length > 0) {
      try {
        await uploadViolationLog(violations);
      } catch (err) {
        console.log("Violation log upload failed:", err.response?.data || err.message);
      }
    }

    // Navigate to results page
    navigate(`/student/exam/${examId}/result`, {
      replace: true,
      state: { exam: examData, score, totalMarks, percentage, passed, results, violations },
    });
  };

  const answeredCount = Object.keys(answers).length;

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="themed-page" style={styles.page}>
        <div style={styles.loadingText}>Loading exam...</div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="themed-page" style={styles.page}>
      {/* Keyframes for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={styles.topBar}>
        <div style={styles.examTitle}>{examData?.title || "Exam"}</div>
        <div
          style={{
            ...styles.timer,
            ...(timeLeft !== null && timeLeft < 300 ? styles.timerWarning : {}),
          }}
        >
          {formatTime(timeLeft)}
        </div>
        <button style={styles.submitBtn} onClick={handleSubmitExam}>
          Submit Exam
        </button>
      </div>

      {/* WARNING BANNER */}
      {warningLevel === "extreme" && (
        <div style={styles.extremeBanner}>
          <span style={styles.extremeIcon}>!</span>
          {warningMessage}
        </div>
      )}
      {warningLevel === "mild" && (
        <div style={styles.mildBanner}>
          {warningMessage}
        </div>
      )}
      {warningLevel === "none" && gazeStatus === "Focused" && (
        <div style={styles.safeBanner}>
          Proctoring Active — Focused
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={{ ...styles.mainGrid, gridTemplateColumns: isMobile ? "1fr" : "260px 1fr" }}>
        {/* LEFT SIDEBAR */}
        <div style={styles.sidebar}>
          {/* Camera */}
          <div style={{ ...styles.cameraBox, position: "relative" }}>
            {isRecording && (
              <div style={styles.recIndicator}>
                <span style={styles.recDot} />
                REC
              </div>
            )}
            {cameraError ? (
              <div style={styles.cameraErrorText}>{cameraError}</div>
            ) : (
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && stream) el.srcObject = stream;
                }}
                autoPlay
                muted
                playsInline
                style={styles.video}
              />
            )}
          </div>

          {/* Gaze status */}
          <div
            style={{
              ...styles.gazeBar,
              background:
                warningLevel === "extreme" ? "#FEE2E2" :
                warningLevel === "mild" ? "#FEF9C3" :
                gazeStatus === "Focused" ? "#DCFCE7" : "#FEE2E2",
              color:
                warningLevel === "extreme" ? "#991B1B" :
                warningLevel === "mild" ? "#854D0E" :
                gazeStatus === "Focused" ? "#166534" : "#991B1B",
              borderColor:
                warningLevel === "extreme" ? "#FECACA" :
                warningLevel === "mild" ? "#FDE68A" :
                gazeStatus === "Focused" ? "#BBF7D0" : "#FECACA",
            }}
          >
            <span style={styles.gazeDot(gazeStatus === "Focused" && warningLevel === "none")} />
            {gazeStatus === "Initializing..."
              ? "Starting proctoring..."
              : gazeStatus}
          </div>

          {/* Extreme warning counter */}
          {extremeCountRef.current > 0 && (
            <div style={styles.extremeCounter}>
              <span style={styles.extremeCountLabel}>Extreme Warnings</span>
              <div style={styles.extremeCountRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    style={{
                      ...styles.extremeDot,
                      background: n <= extremeCountRef.current ? "var(--danger)" : "var(--border-default)",
                    }}
                  />
                ))}
                <span style={styles.extremeCountText}>
                  {extremeCountRef.current}/5
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={styles.statsCard}>
            <div style={styles.statsRow}>
              <span style={styles.statsLabel}>Total</span>
              <span style={styles.statsValue}>{questions.length}</span>
            </div>
            <div style={styles.statsRow}>
              <span style={styles.statsLabel}>Answered</span>
              <span style={{ ...styles.statsValue, color: "var(--primary)" }}>
                {answeredCount}
              </span>
            </div>
            <div style={styles.statsRow}>
              <span style={styles.statsLabel}>Remaining</span>
              <span style={{ ...styles.statsValue, color: "var(--danger)" }}>
                {questions.length - answeredCount}
              </span>
            </div>
            <div style={styles.statsRow}>
              <span style={styles.statsLabel}>Violations</span>
              <span style={{ ...styles.statsValue, color: violations.length > 0 ? "var(--danger)" : "var(--primary)" }}>
                {violations.length}
              </span>
            </div>
          </div>

          {/* Question Navigator */}
          <div style={styles.navCard}>
            <div style={styles.navTitle}>Questions</div>
            <div style={styles.navGrid}>
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  style={{
                    ...styles.navBtn,
                    ...(answers[q.id] ? styles.navBtnAnswered : {}),
                    ...(i === currentIndex ? styles.navBtnCurrent : {}),
                  }}
                  onClick={() => goToQuestion(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: QUESTION AREA */}
        <div style={styles.questionArea}>
          {questions.length === 0 ? (
            <div style={styles.loadingText}>No questions found for this exam.</div>
          ) : (
            <>
              {/* Question header */}
              <div style={styles.questionHeader}>
                <span>
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span style={styles.marksBadge}>
                  {currentQ.marks || 1} mark{(currentQ.marks || 1) > 1 ? "s" : ""}
                </span>
              </div>

              {/* Question text */}
              <div style={styles.questionText}>{currentQ.question}</div>

              {/* Diagram */}
              {currentQ.diagram_url && (
                <div style={styles.diagramBox}>
                  <img src={currentQ.diagram_url} alt="Diagram" style={styles.diagramImage} />
                </div>
              )}

              {/* Options */}
              <div style={styles.optionsGrid}>
                {["A", "B", "C", "D"].map((letter) => {
                  const optionKey = `option_${letter.toLowerCase()}`;
                  const isSelected = answers[currentQ.id] === letter;

                  return (
                    <div
                      key={letter}
                      style={{
                        ...styles.optionCard,
                        ...(isSelected ? styles.optionSelected : {}),
                      }}
                      onClick={() => selectAnswer(currentQ.id, letter)}
                    >
                      <div
                        style={{
                          ...styles.optionLetter,
                          ...(isSelected ? styles.optionLetterSelected : {}),
                        }}
                      >
                        {letter}
                      </div>
                      <div style={styles.optionText}>{currentQ[optionKey]}</div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div style={styles.navButtons}>
                <button
                  style={{
                    ...styles.prevNextBtn,
                    ...(currentIndex === 0 ? styles.btnDisabled : {}),
                  }}
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                >
                  ← Previous
                </button>
                <button
                  style={{
                    ...styles.prevNextBtn,
                    ...(currentIndex === questions.length - 1
                      ? styles.btnDisabled
                      : {}),
                  }}
                  onClick={goNext}
                  disabled={currentIndex === questions.length - 1}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */
const styles = {
  page: {
    minHeight: "100vh",
    color: "var(--text-primary)",
    padding: 16,
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  loadingText: {
    color: "var(--text-secondary)",
    padding: 40,
    textAlign: "center",
    fontSize: 16,
  },

  /* Top bar */
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    padding: "12px 20px",
    borderRadius: 14,
    border: "1px solid var(--glass-border)",
    marginBottom: 16,
    boxShadow: "var(--glass-shadow)",
  },
  examTitle: { fontSize: 18, fontWeight: 800 },
  timer: {
    fontSize: 28,
    fontWeight: 800,
    fontFamily: "monospace",
    color: "var(--text-primary)",
  },
  timerWarning: { color: "var(--danger)" },
  submitBtn: {
    background: "var(--primary)",
    border: "none",
    padding: "10px 20px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    color: "var(--text-on-primary)",
    fontSize: 14,
  },

  /* Main grid */
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: 16,
    alignItems: "start",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  /* Camera */
  cameraBox: {
    background: "#000",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid var(--border-default)",
    aspectRatio: "4/3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  recIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
    background: "rgba(220,38,38,0.85)",
    color: "#fff",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 5,
    animation: "pulse 1s infinite",
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#fff",
    display: "inline-block",
  },
  cameraErrorText: {
    color: "var(--danger)",
    fontSize: 13,
    fontWeight: 600,
    padding: 12,
    textAlign: "center",
  },

  /* Warning banners — HIGH CONTRAST, keep hardcoded */
  extremeBanner: {
    background: "#DC2626",
    color: "#FFFFFF",
    padding: "12px 20px",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    animation: "pulse 1s infinite",
  },
  extremeIcon: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#FFFFFF",
    color: "#DC2626",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 16,
    flexShrink: 0,
  },
  mildBanner: {
    background: "#FEF3C7",
    color: "#92400E",
    padding: "10px 20px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    border: "1px solid #FDE68A",
  },
  safeBanner: {
    background: "var(--primary-light)",
    color: "var(--primary-light-text)",
    padding: "8px 20px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    border: "1px solid var(--primary)",
  },

  /* Gaze bar */
  gazeBar: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  gazeDot: (focused) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: focused ? "var(--primary)" : "var(--danger)",
    display: "inline-block",
    flexShrink: 0,
  }),

  /* Extreme warning counter */
  extremeCounter: {
    background: "var(--danger-bg)",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--danger)",
  },
  extremeCountLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--danger-light-text)",
    marginBottom: 6,
    display: "block",
  },
  extremeCountRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  extremeDot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    transition: "background 0.3s",
  },
  extremeCountText: {
    fontSize: 13,
    fontWeight: 800,
    color: "var(--danger)",
    marginLeft: 4,
  },

  /* Stats card */
  statsCard: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--glass-border)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  statsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsLabel: { fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 },
  statsValue: { fontSize: 16, fontWeight: 800, color: "var(--text-primary)" },

  /* Question navigator */
  navCard: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--glass-border)",
  },
  navTitle: {
    fontWeight: 700,
    marginBottom: 10,
    color: "var(--text-secondary)",
    fontSize: 13,
  },
  navGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 6,
  },
  navBtn: {
    width: "100%",
    aspectRatio: "1",
    borderRadius: 8,
    border: "1px solid var(--border-default)",
    background: "var(--bg-card-nested)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-primary)",
  },
  navBtnCurrent: {
    border: "2px solid var(--primary)",
    background: "var(--primary-bg)",
  },
  navBtnAnswered: {
    background: "var(--primary)",
    color: "var(--text-on-primary)",
    border: "1px solid var(--primary)",
  },

  /* Question area */
  questionArea: {
    background: "var(--glass-bg)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    padding: 28,
    borderRadius: 14,
    border: "1px solid var(--glass-border)",
    minHeight: 500,
    boxShadow: "var(--glass-shadow)",
  },
  questionHeader: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text-secondary)",
    marginBottom: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  marksBadge: {
    background: "var(--primary-bg)",
    color: "var(--primary-bg-text)",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 28,
    lineHeight: 1.6,
    color: "var(--text-primary)",
  },
  diagramBox: {
    marginBottom: 24,
    textAlign: "center",
  },
  diagramImage: {
    maxWidth: "100%",
    maxHeight: 300,
    borderRadius: 10,
    border: "1px solid var(--border-default)",
  },

  /* Options */
  optionsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  optionCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    border: "1px solid var(--border-default)",
    background: "var(--bg-card-nested)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  optionSelected: {
    border: "2px solid var(--primary)",
    background: "var(--primary-bg)",
  },
  optionLetter: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 14,
    background: "var(--bg-card-nested)",
    border: "1px solid var(--border-default)",
    flexShrink: 0,
    color: "var(--text-primary)",
  },
  optionLetterSelected: {
    background: "var(--primary)",
    color: "var(--text-on-primary)",
    border: "1px solid var(--primary)",
  },
  optionText: { fontSize: 15, lineHeight: 1.4, color: "var(--text-primary)" },

  /* Nav buttons */
  navButtons: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 32,
  },
  prevNextBtn: {
    background: "var(--primary)",
    border: "none",
    padding: "10px 28px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    color: "var(--text-on-primary)",
    fontSize: 14,
  },
  btnDisabled: {
    background: "var(--border-default)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  },
};
