import { supabase } from "../config/supabase.js";

export const uploadFace = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: base64Data } = req.body;

    if (!base64Data) {
      return res.status(400).json({ message: "No image data provided" });
    }

    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const fileName = `${userId}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("face-captures")
      .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("face-captures")
      .getPublicUrl(fileName);

    await supabase
      .from("users")
      .update({ face_image_url: urlData.publicUrl })
      .eq("id", userId);

    res.json({ message: "Face image uploaded", url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: base64Data } = req.body;

    if (!base64Data) {
      return res.status(400).json({ message: "No image data provided" });
    }

    // Ensure bucket exists
    const { data: bucket } = await supabase.storage.getBucket("profile-photos");
    if (!bucket) {
      await supabase.storage.createBucket("profile-photos", { public: true });
      console.log("✅ Created profile-photos bucket");
    }

    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const fileName = `${userId}_profile.jpg`;

    // Remove old file first (upsert can fail on some Supabase versions)
    await supabase.storage.from("profile-photos").remove([fileName]);

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("Profile photo upload error:", uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(fileName);

    // Try to update DB column (might not exist — that's ok)
    await supabase
      .from("users")
      .update({ profile_photo_url: urlData.publicUrl })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.log("Note: profile_photo_url column update skipped:", error.message);
      });

    console.log("✅ Profile photo uploaded for user:", userId);
    res.json({ message: "Profile photo uploaded", url: urlData.publicUrl });
  } catch (err) {
    console.error("Profile photo upload failed:", err.message);
    res.status(500).json({ message: err.message });
  }
};

export const uploadAudio = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: base64Data } = req.body;

    if (!base64Data) {
      return res.status(400).json({ message: "No audio data provided" });
    }

    const base64 = base64Data.replace(/^data:audio\/[\w.]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const fileName = `${userId}_${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from("audio-recordings")
      .upload(fileName, buffer, { contentType: "audio/webm", upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("audio-recordings")
      .getPublicUrl(fileName);

    await supabase
      .from("users")
      .update({ audio_url: urlData.publicUrl })
      .eq("id", userId);

    res.json({ message: "Audio uploaded", url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
