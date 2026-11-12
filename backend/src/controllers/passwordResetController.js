import crypto from "crypto";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabase.js";
import { sendPasswordResetEmail } from "../services/emailService.js";

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Always return success to avoid revealing if email exists
    const successMsg = { message: "If that email exists, a reset link has been sent." };

    const { data: user } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (!user) return res.json(successMsg);

    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await supabase.from("password_reset_tokens").insert([
      { user_id: user.id, token, expires_at },
    ]);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    sendPasswordResetEmail(user.email, user.full_name, resetLink).catch(console.error);

    res.json(successMsg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const { data: resetToken } = await supabase
      .from("password_reset_tokens")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash })
      .eq("id", resetToken.user_id);

    if (updateError) throw updateError;

    await supabase
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("id", resetToken.id);

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
