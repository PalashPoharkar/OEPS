import { supabase } from "../supabaseClient";

export async function getProfileById(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}
