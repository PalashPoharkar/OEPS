import express from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

console.log("✅ RUNNING SERVER FILE: src/server.js");

dotenv.config();
const app = express();

// Gzip compression — reduces response sizes by ~70%
app.use(compression());

// Only log non-OPTIONS requests to reduce spam
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") console.log("➡️", req.method, req.url);
  next();
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => res.send("Backend is running ✅"));

app.get("/api/admin/test", (req, res) => {
  res.json({ ok: true, message: "Admin route working ✅" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Backend running on http://localhost:${PORT}`)
);
