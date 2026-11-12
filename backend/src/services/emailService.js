import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  await transporter.sendMail({
    from: `"OEPS Portal" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

export const sendWelcomeEmail = (email, fullName) =>
  sendEmail({
    to: email,
    subject: "Welcome to OEPS!",
    html: `<h2>Welcome, ${fullName}!</h2>
      <p>Your account has been created successfully on the Online Exam Portal System.</p>
      <p>You can now log in and start taking exams.</p>`,
  });

export const sendExamPublishedEmail = (email, fullName, examTitle) =>
  sendEmail({
    to: email,
    subject: `New Exam Published: ${examTitle}`,
    html: `<h2>Hi ${fullName},</h2>
      <p>A new exam <strong>"${examTitle}"</strong> has been published and is now available for you.</p>
      <p>Log in to your dashboard to start the exam.</p>`,
  });

export const sendResultAvailableEmail = (email, fullName, examTitle, percentage) =>
  sendEmail({
    to: email,
    subject: `Your Result: ${examTitle}`,
    html: `<h2>Hi ${fullName},</h2>
      <p>Your result for <strong>"${examTitle}"</strong> is now available.</p>
      <p>You scored <strong>${percentage}%</strong>.</p>
      <p>Log in to your dashboard to see the detailed breakdown.</p>`,
  });

export const sendPasswordResetEmail = (email, fullName, resetLink) =>
  sendEmail({
    to: email,
    subject: "Password Reset - OEPS",
    html: `<h2>Hi ${fullName},</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetLink}" style="background:#22C55E;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
  });
