import { supabase } from "../config/supabase.js";

export const getTeacherOverallStats = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const { data: exams } = await supabase
      .from("exams")
      .select("id, title, is_published, created_at")
      .eq("teacher_id", teacherId);

    if (!exams || exams.length === 0) {
      return res.json({
        totalExams: 0,
        publishedExams: 0,
        totalStudents: 0,
        avgScore: 0,
        passRate: 0,
        examScores: [],
      });
    }

    const examIds = exams.map((e) => e.id);

    const { data: results } = await supabase
      .from("exam_results")
      .select("exam_id, exam_title, score, total_marks, percentage, passed")
      .in("exam_id", examIds);

    const allResults = results || [];
    const totalStudents = new Set(allResults.map((r) => r.exam_id + r.percentage)).size;
    const avgScore = allResults.length
      ? Math.round(allResults.reduce((s, r) => s + r.percentage, 0) / allResults.length)
      : 0;
    const passRate = allResults.length
      ? Math.round((allResults.filter((r) => r.passed).length / allResults.length) * 100)
      : 0;

    // Per-exam average scores for chart
    const examScores = exams.map((exam) => {
      const er = allResults.filter((r) => r.exam_id === exam.id);
      return {
        title: exam.title,
        avgScore: er.length
          ? Math.round(er.reduce((s, r) => s + r.percentage, 0) / er.length)
          : 0,
        attempts: er.length,
        passRate: er.length
          ? Math.round((er.filter((r) => r.passed).length / er.length) * 100)
          : 0,
      };
    });

    res.json({
      totalExams: exams.length,
      publishedExams: exams.filter((e) => e.is_published).length,
      totalStudents: allResults.length,
      avgScore,
      passRate,
      examScores,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getExamAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: exam } = await supabase
      .from("exams")
      .select("*")
      .eq("id", id)
      .single();

    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const { data: results } = await supabase
      .from("exam_results")
      .select("*")
      .eq("exam_id", id);

    const allResults = results || [];

    // Score distribution buckets
    const distribution = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];
    allResults.forEach((r) => {
      const p = r.percentage;
      if (p <= 20) distribution[0].count++;
      else if (p <= 40) distribution[1].count++;
      else if (p <= 60) distribution[2].count++;
      else if (p <= 80) distribution[3].count++;
      else distribution[4].count++;
    });

    // Question-wise accuracy
    const questionAccuracy = [];
    if (allResults.length > 0 && allResults[0].results) {
      const sampleResults = allResults[0].results;
      const questionCount = Array.isArray(sampleResults) ? sampleResults.length : 0;

      for (let i = 0; i < questionCount; i++) {
        let correct = 0;
        let total = 0;
        allResults.forEach((r) => {
          if (Array.isArray(r.results) && r.results[i]) {
            total++;
            if (r.results[i].correct) correct++;
          }
        });
        questionAccuracy.push({
          question: `Q${i + 1}`,
          accuracy: total ? Math.round((correct / total) * 100) : 0,
        });
      }
    }

    // Violation stats
    const violationCounts = {};
    allResults.forEach((r) => {
      if (Array.isArray(r.violations)) {
        r.violations.forEach((v) => {
          const type = v.type || "unknown";
          violationCounts[type] = (violationCounts[type] || 0) + 1;
        });
      }
    });
    const violationStats = Object.entries(violationCounts).map(([type, count]) => ({
      type,
      count,
    }));

    res.json({
      exam,
      totalAttempts: allResults.length,
      avgScore: allResults.length
        ? Math.round(allResults.reduce((s, r) => s + r.percentage, 0) / allResults.length)
        : 0,
      passRate: allResults.length
        ? Math.round((allResults.filter((r) => r.passed).length / allResults.length) * 100)
        : 0,
      distribution,
      questionAccuracy,
      violationStats,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getExamResults = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: results, error } = await supabase
      .from("exam_results")
      .select("*")
      .eq("exam_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Enrich with student names
    const studentIds = [...new Set((results || []).map((r) => r.student_id))];
    let usersMap = {};
    if (studentIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", studentIds);
      (users || []).forEach((u) => {
        usersMap[u.id] = u;
      });
    }

    const enriched = (results || []).map((r) => ({
      ...r,
      student_name: usersMap[r.student_id]?.full_name || "Unknown",
      student_email: usersMap[r.student_id]?.email || "",
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getStudentAnalytics = async (req, res) => {
  try {
    const studentId = req.user.id;

    const { data: results } = await supabase
      .from("exam_results")
      .select("exam_title, percentage, passed, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });

    const allResults = results || [];
    const avgPercentage = allResults.length
      ? Math.round(allResults.reduce((s, r) => s + r.percentage, 0) / allResults.length)
      : 0;
    const passCount = allResults.filter((r) => r.passed).length;
    const failCount = allResults.length - passCount;

    const trend = allResults.map((r) => ({
      exam: r.exam_title,
      percentage: r.percentage,
      date: r.created_at,
    }));

    res.json({ avgPercentage, passCount, failCount, trend });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
