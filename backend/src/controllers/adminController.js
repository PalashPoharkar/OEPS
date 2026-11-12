import { supabase } from "../config/supabase.js";

export const getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || "";
  const offset = (page - 1) * limit;

  let countQuery = supabase.from("users").select("id", { count: "exact", head: true });
  let dataQuery = supabase
    .from("users")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false });

  if (search) {
    const pattern = `%${search}%`;
    countQuery = countQuery.or(`full_name.ilike.${pattern},email.ilike.${pattern},role.ilike.${pattern}`);
    dataQuery = dataQuery.or(`full_name.ilike.${pattern},email.ilike.${pattern},role.ilike.${pattern}`);
  }

  const { count } = await countQuery;
  const { data, error } = await dataQuery.range(offset, offset + limit - 1);

  if (error) return res.status(400).json({ message: error.message });
  return res.json({ data, total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) });
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  if (id === adminId) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  const { error } = await supabase.from("users").delete().eq("id", id);

  if (error) return res.status(400).json({ message: error.message });
  return res.json({ message: "User deleted successfully" });
};

export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ["admin", "teacher", "student"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const { data, error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", id)
    .select("id, role")
    .single();

  if (error) return res.status(400).json({ message: error.message });

  return res.json({ message: "Role updated ✅", user: data });
};
