import bcrypt from "bcrypt";
import { supabase } from "../config/supabase.js";

export const getProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role, created_at, face_image_url, audio_url")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    // Construct profile photo URL from storage (predictable filename)
    // This works even if the profile_photo_url column doesn't exist
    const fileName = `${req.user.id}_profile.jpg`;
    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(fileName);

    // Check if the file actually exists by trying to get its metadata
    const { data: fileData } = await supabase.storage
      .from("profile-photos")
      .list("", { search: fileName });

    const hasProfilePhoto = fileData && fileData.some((f) => f.name === fileName);

    res.json({
      ...data,
      profile_photo_url: hasProfilePhoto ? urlData.publicUrl : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ full_name: full_name.trim() })
      .eq("id", req.user.id)
      .select("id, full_name, email, role")
      .single();

    if (error) throw error;
    res.json({ message: "Profile updated", user: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both passwords required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash })
      .eq("id", req.user.id);

    if (updateError) throw updateError;
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
