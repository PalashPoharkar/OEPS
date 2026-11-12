import { supabase } from "../config/supabase.js";

// Ensure storage buckets exist (runs once on first import)
const ensureBuckets = async () => {
  const buckets = ["violation-recordings", "violation-logs", "profile-photos"];
  for (const name of buckets) {
    const { data } = await supabase.storage.getBucket(name);
    if (!data) {
      await supabase.storage.createBucket(name, { public: true });
      console.log(`✅ Created storage bucket: ${name}`);
    }
  }
};
ensureBuckets().catch((err) => console.log("Bucket init note:", err.message));

// List all violation records (for teachers/admins)
export const getViolationRecords = async (req, res) => {
  try {
    // 1. List all files in violation-recordings bucket
    const { data: clips, error: clipsErr } = await supabase.storage
      .from("violation-recordings")
      .list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });

    if (clipsErr) throw clipsErr;

    // 2. List all files in violation-logs bucket
    const { data: logs, error: logsErr } = await supabase.storage
      .from("violation-logs")
      .list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });

    if (logsErr) throw logsErr;

    // 3. Parse filenames to extract student IDs and exam IDs
    // Clip format: {userId}_{examId}_{violationType}_{timestamp}.webm
    // Log format:  log_{userId}_{examId}.json
    const studentIds = new Set();
    const examIds = new Set();

    const parsedClips = (clips || []).filter(f => f.name.endsWith(".webm") || f.name.endsWith(".jpg")).map((f) => {
      // Filename: {userId}_{examId}_{violationType}_{timestamp}.ext
      // UUIDs contain dashes, so split by underscore is safe
      const nameNoExt = f.name.replace(/\.(webm|jpg)$/, "");
      const parts = nameNoExt.split("_");
      const studentId = parts[0] || "";
      const examId = parts[1] || "";
      const violationType = parts[2] || "unknown";
      console.log("Parsed clip:", f.name, "→ student:", studentId, "exam:", examId);
      studentIds.add(studentId);
      examIds.add(examId);

      const { data: urlData } = supabase.storage
        .from("violation-recordings")
        .getPublicUrl(f.name);

      return {
        file_name: f.name,
        student_id: studentId,
        exam_id: examId,
        violation_type: violationType,
        video_url: urlData.publicUrl,
        created_at: f.created_at,
        size: f.metadata?.size || 0,
      };
    });

    const parsedLogs = (logs || []).filter(f => f.name.endsWith(".json")).map((f) => {
      const parts = f.name.replace("log_", "").replace(".json", "").split("_");
      const studentId = parts[0];
      const examId = parts[1];
      studentIds.add(studentId);
      examIds.add(examId);

      const { data: urlData } = supabase.storage
        .from("violation-logs")
        .getPublicUrl(f.name);

      return {
        file_name: f.name,
        student_id: studentId,
        exam_id: examId,
        log_url: urlData.publicUrl,
        created_at: f.created_at,
      };
    });

    // 4. Fetch student names and exam titles
    const studentArr = [...studentIds].filter(Boolean);
    const examArr = [...examIds].filter(Boolean);

    let studentsMap = {};
    let examsMap = {};

    if (studentArr.length > 0) {
      // Try with profile_photo_url, fallback without it
      let students = null;
      const { data: d1, error: e1 } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", studentArr);
      students = d1;
      if (e1) console.log("User fetch error:", e1.message);
      if (students) {
        students.forEach((s) => { studentsMap[s.id] = s; });
      }
      console.log("Found students:", studentArr.length, "→ matched:", Object.keys(studentsMap).length);
    }

    if (examArr.length > 0) {
      const { data: exams } = await supabase
        .from("exams")
        .select("id, title")
        .in("id", examArr);
      if (exams) {
        exams.forEach((e) => { examsMap[e.id] = e; });
      }
    }

    // 5. Group clips by student+exam
    const recordsMap = {};
    for (const clip of parsedClips) {
      const key = `${clip.student_id}_${clip.exam_id}`;
      if (!recordsMap[key]) {
        recordsMap[key] = {
          student_id: clip.student_id,
          exam_id: clip.exam_id,
          student: studentsMap[clip.student_id] || { full_name: "Unknown", email: "" },
          exam: examsMap[clip.exam_id] || { title: "Unknown Exam" },
          clips: [],
          log: null,
        };
      }
      recordsMap[key].clips.push(clip);
    }

    // Attach logs
    for (const log of parsedLogs) {
      const key = `${log.student_id}_${log.exam_id}`;
      if (!recordsMap[key]) {
        recordsMap[key] = {
          student_id: log.student_id,
          exam_id: log.exam_id,
          student: studentsMap[log.student_id] || { full_name: "Unknown", email: "" },
          exam: examsMap[log.exam_id] || { title: "Unknown Exam" },
          clips: [],
          log: null,
        };
      }
      recordsMap[key].log = log;
    }

    const records = Object.values(recordsMap).sort((a, b) => {
      const aTime = a.clips[0]?.created_at || a.log?.created_at || "";
      const bTime = b.clips[0]?.created_at || b.log?.created_at || "";
      return bTime.localeCompare(aTime);
    });

    res.json({ records, total: records.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Upload a violation video clip to Supabase storage
// Helper: ensure a specific bucket exists before uploading
async function ensureBucket(name) {
  const { data } = await supabase.storage.getBucket(name);
  if (!data) {
    const { error } = await supabase.storage.createBucket(name, { public: true });
    if (error && !error.message?.includes("already exists")) {
      console.error(`Failed to create bucket ${name}:`, error.message);
    } else {
      console.log(`✅ Created bucket: ${name}`);
    }
  }
}

export const uploadViolationClip = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exam_id, violation_type, video_data } = req.body;

    if (!video_data || !exam_id) {
      return res.status(400).json({ message: "Missing exam_id or video_data" });
    }

    // Ensure bucket exists
    await ensureBucket("violation-recordings");

    // Support both video and image data
    const isImage = video_data.startsWith("data:image/");
    const base64 = video_data.replace(/^data:(video|image)\/[\w.;+]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const ext = isImage ? "jpg" : "webm";
    const contentType = isImage ? "image/jpeg" : "video/webm";
    console.log(`📹 Uploading violation ${isImage ? "snapshot" : "clip"}: ${buffer.length} bytes, type: ${violation_type}`);

    if (buffer.length < 100) {
      return res.status(400).json({ message: "Data too small" });
    }

    const timestamp = Date.now();
    const fileName = `${userId}_${exam_id}_${violation_type || "violation"}_${timestamp}.${ext}`;

    // Remove existing file first (upsert can fail on some versions)
    await supabase.storage.from("violation-recordings").remove([fileName]);

    const { error: uploadError } = await supabase.storage
      .from("violation-recordings")
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("violation-recordings")
      .getPublicUrl(fileName);

    console.log("✅ Violation clip uploaded:", fileName);
    res.json({ message: "Violation clip uploaded", url: urlData.publicUrl });
  } catch (err) {
    console.error("uploadViolationClip error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

export const saveViolationLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exam_id, violations } = req.body;

    if (!exam_id || !violations) {
      return res.status(400).json({ message: "Missing exam_id or violations" });
    }

    // Ensure bucket exists
    await ensureBucket("violation-logs");

    const log = {
      student_id: userId,
      exam_id,
      violations,
      total_violations: violations.length,
      created_at: new Date().toISOString(),
    };

    const fileName = `log_${userId}_${exam_id}.json`;
    const buffer = Buffer.from(JSON.stringify(log, null, 2));

    // Remove old log first
    await supabase.storage.from("violation-logs").remove([fileName]);

    const { error: uploadError } = await supabase.storage
      .from("violation-logs")
      .upload(fileName, buffer, { contentType: "application/json", upsert: true });

    if (uploadError) {
      console.error("Supabase log upload error:", uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("violation-logs")
      .getPublicUrl(fileName);

    console.log("✅ Violation log saved:", fileName);
    res.json({ message: "Violation log saved", url: urlData.publicUrl });
  } catch (err) {
    console.error("saveViolationLog error:", err.message);
    res.status(500).json({ message: err.message });
  }
};
