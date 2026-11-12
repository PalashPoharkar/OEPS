import { supabase } from "../config/supabase.js";
import { sendResultAvailableEmail } from "../services/emailService.js";

/* Create profile */
export const createProfile = async (req, res) => {
  const { name, age, className } = req.body;
  const studentId = req.user.id;

  const { data, error } = await supabase
    .from("student_dashboard")
    .insert([
      {
        student_id: studentId,
        name,
        age,
        class: className,
      },
    ])
    .select()
    .single();

  if (error)
    return res.status(400).json({ message: error.message });

  res.json(data);
};

/* Get my dashboard */
export const getMyDashboard = async (req, res) => {
  const studentId = req.user.id;

  const { data } = await supabase
    .from("student_dashboard")
    .select("*")
    .eq("student_id", studentId)
    .limit(1);

  res.json(data?.[0] || null);
};

/* Update dashboard stats after exam */
export const updateDashboardStats = async (req, res) => {
  const studentId = req.user.id;
  const { total_exams, passed_exams, grade } = req.body;

  // Check if profile exists
  const { data: existing } = await supabase
    .from("student_dashboard")
    .select("student_id")
    .eq("student_id", studentId)
    .limit(1);

  let result;
  if (existing && existing.length > 0) {
    result = await supabase
      .from("student_dashboard")
      .update({ total_exams, passed_exams, grade })
      .eq("student_id", studentId)
      .select()
      .limit(1);
  } else {
    // Fetch user's full_name from users table
    const { data: userData } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", studentId)
      .limit(1);

    result = await supabase
      .from("student_dashboard")
      .insert([{
        student_id: studentId,
        name: userData?.[0]?.full_name || "Student",
        age: 0,
        class: "Unknown",
        total_exams,
        passed_exams,
        grade,
      }])
      .select()
      .limit(1);
  }

  if (result.error) {
    console.log("Dashboard update error:", JSON.stringify(result.error));
    return res.status(400).json({ message: result.error.message, details: result.error });
  }
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  res.json(row);
};

/* Save exam result */
export const saveExamResult = async (req, res) => {
  const studentId = req.user.id;
  const { exam_id, exam_title, score, total_marks, percentage, passed, results } = req.body;

  const { data, error } = await supabase
    .from("exam_results")
    .insert([{
      student_id: studentId,
      exam_id,
      exam_title,
      score,
      total_marks,
      percentage,
      passed,
      results,
    }])
    .select()
    .limit(1);

  if (error) return res.status(400).json({ message: error.message });

  // Send result email (fire-and-forget)
  const saved = data?.[0];
  if (saved) {
    supabase
      .from("users")
      .select("email, full_name")
      .eq("id", studentId)
      .single()
      .then(({ data: u }) => {
        if (u) sendResultAvailableEmail(u.email, u.full_name, exam_title, percentage).catch(console.error);
      })
      .catch(console.error);
  }

  res.json(saved || null);
};

/* Get exam results for student (with pagination) */
export const getExamResults = async (req, res) => {
  const studentId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const { count } = await supabase
    .from("exam_results")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  const { data, error } = await supabase
    .from("exam_results")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ data: data || [], total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) });
};

/* Get published exams for my class */
export const getClassExams = async (req, res) => {
  const studentId = req.user.id;

  const { data: profiles } = await supabase
    .from("student_dashboard")
    .select("class")
    .eq("student_id", studentId)
    .limit(1);

  const profile = profiles?.[0];
  if (!profile) return res.json([]);

  const { data } = await supabase
    .from("exams")
    .select("*")
    .eq("class", profile.class)
    .eq("is_published", true);

  res.json(data || []);
};
