import { supabase } from "../supabaseClient";

// ✅ Fetch questions for an exam
export async function fetchQuestionsByExam(exam_id) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("exam_id", exam_id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ✅ Add question
export async function addQuestion(payload) {
  const { data, error } = await supabase
    .from("questions")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ✅ Update question
export async function updateQuestion(id, payload) {
  const { data, error } = await supabase
    .from("questions")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ✅ Delete question
export async function deleteQuestion(id) {
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw error;
  return true;
}
