import { supabase } from "../config/supabase.js";
import { sendExamPublishedEmail } from "../services/emailService.js";

// ✅ Teacher creates exam
export const createExam = async (req, res) => {
  try {
    const teacher_id = req.user.id; // from protect middleware
    const { title, description, duration_minutes, total_marks, start_time, end_time } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const { data, error } = await supabase
      .from("exams")
      .insert([
        {
          teacher_id,
          title,
          description,
          duration_minutes: duration_minutes || 30,
          total_marks: total_marks || 100,
          start_time: start_time || null,
          end_time: end_time || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Exam created ✅", exam: data });
  } catch (err) {
    console.error("createExam error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Teacher gets only their exams (admin can pass ?teacher_id= to view any teacher's exams)
export const getMyExams = async (req, res) => {
  try {
    const teacher_id =
      req.user.role === "admin" && req.query.teacher_id
        ? req.query.teacher_id
        : req.user.id;

    const { data, error } = await supabase
      .from("exams")
      .select("*")
      .eq("teacher_id", teacher_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("getMyExams error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Delete exam and its questions
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher_id = req.user.role === "admin" ? undefined : req.user.id;

    // Delete related questions first
    await supabase.from("questions").delete().eq("exam_id", id);

    let query = supabase.from("exams").delete().eq("id", id);
    if (teacher_id) query = query.eq("teacher_id", teacher_id);

    const { error } = await query;
    if (error) throw error;

    res.json({ message: "Exam deleted" });
  } catch (err) {
    console.error("deleteExam error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Publish/unpublish exam
export const togglePublishExam = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const { id } = req.params;
    const { is_published } = req.body;

    const { data, error } = await supabase
      .from("exams")
      .update({ is_published })
      .eq("id", id)
      .eq("teacher_id", teacher_id) // ✅ security
      .select()
      .single();

    if (error) throw error;

    // Send email notifications when publishing
    if (is_published && data) {
      supabase
        .from("users")
        .select("email, full_name")
        .eq("role", "student")
        .then(({ data: students }) => {
          (students || []).forEach((s) => {
            sendExamPublishedEmail(s.email, s.full_name, data.title).catch(console.error);
          });
        })
        .catch(console.error);
    }

    res.json({ message: "Exam updated ✅", exam: data });
  } catch (err) {
    console.error("togglePublishExam error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// Get published exams (with scheduling awareness)
export const getPublishedExams = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("exams")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Filter by scheduling: show if no time set OR current time is within range
    const now = new Date();
    const filtered = (data || []).filter((exam) => {
      if (!exam.start_time && !exam.end_time) return true;
      if (exam.end_time && new Date(exam.end_time) < now) return false;
      return true;
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
