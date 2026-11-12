import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

// Initialize providers
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════════════════════════════════
   Unified AI call — tries Groq first (fast + generous),
   falls back to Gemini if Groq unavailable
   ═══════════════════════════════════════════ */

// Text-only call (for chat / question generation)
async function callAIText(prompt) {
  // Try Groq first (faster, higher free limits)
  if (groq) {
    try {
      const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return res.choices[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.log("Groq text failed, trying Gemini:", err.message);
    }
  }

  // Fallback to Gemini
  if (genAI) {
    const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
    for (const name of models) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (err) {
        if (err.message?.includes("429")) { await sleep(3000); continue; }
        if (err.message?.includes("404")) continue;
        throw err;
      }
    }
  }

  throw new Error("No AI provider available. Please set GROQ_API_KEY or GEMINI_API_KEY in .env");
}

// Vision call (image + text prompt)
async function callAIVision(prompt, imageBase64, mimeType) {
  // Try Groq vision first
  if (groq) {
    try {
      const dataUrl = `data:${mimeType};base64,${imageBase64}`;
      const res = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
        temperature: 0.3,
        max_tokens: 4096,
      });
      return res.choices[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.log("Groq vision failed, trying Gemini:", err.message);
    }
  }

  // Fallback to Gemini vision
  if (genAI) {
    const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
    for (const name of models) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: imageBase64, mimeType } },
        ]);
        return result.response.text().trim();
      } catch (err) {
        if (err.message?.includes("429")) { await sleep(3000); continue; }
        if (err.message?.includes("404")) continue;
        throw err;
      }
    }
  }

  throw new Error("No AI provider available. Please set GROQ_API_KEY or GEMINI_API_KEY in .env");
}

// Multi-image vision call (for PDF pages)
async function callAIMultiVision(prompt, images) {
  // Groq doesn't support multi-image well, try Gemini first for this
  if (genAI) {
    const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
    for (const name of models) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const parts = [prompt];
        for (const img of images) {
          parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
        }
        const result = await model.generateContent(parts);
        return result.response.text().trim();
      } catch (err) {
        if (err.message?.includes("429")) { await sleep(3000); continue; }
        if (err.message?.includes("404")) continue;
        throw err;
      }
    }
  }

  // Fallback: process one image at a time with Groq
  if (groq && images.length > 0) {
    return await callAIVision(prompt, images[0].base64, images[0].mimeType);
  }

  throw new Error("No AI provider available");
}

function parseJSON(text) {
  const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

/* ═══════════════════════════════════════════
   Prompts
   ═══════════════════════════════════════════ */

const EXTRACT_PROMPT = `You are an exam question extractor. Analyze the provided image/document carefully.

Extract ALL questions with their options, correct answers, and diagrams.

RULES:
- Detect questions (numbered or not), options (A/B/C/D or 1/2/3/4), and correct answers
- If an option is highlighted, circled, marked in green, ticked, or has any visual indicator — that is the correct answer
- If correct answers are written separately (like "Answer: B" or "Ans: C"), use that
- If no correct answer is detectable, default to option A (index 0)
- For diagrams: describe what the diagram shows in the "diagram_description" field
- Marks: if marks are mentioned per question, include them; otherwise default to 1

Return ONLY valid JSON in this exact format (no markdown, no backticks):
[
  {
    "question": "The question text here",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correct": 0,
    "marks": 1,
    "diagram_description": "description of diagram if present, or empty string",
    "has_diagram": false
  }
]

Where "correct" is the 0-based index (0=A, 1=B, 2=C, 3=D).
If less than 4 options exist, leave extra options as empty strings.
Return an empty array [] if no questions found.`;

const CHAT_PROMPT = `You are an AI exam question generator for teachers.
When asked to generate questions, return ONLY valid JSON (no markdown, no backticks) in this format:
[
  {
    "question": "question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "marks": 1,
    "diagram_description": "",
    "has_diagram": false
  }
]
Where "correct" is 0-based index of the correct option.
Generate diverse, well-crafted MCQ questions based on the teacher's request.
If the teacher asks for diagrams, set has_diagram to true and provide a clear diagram_description.`;

/* ═══════════════════════════════════════════
   Route handlers
   ═══════════════════════════════════════════ */

export const extractFromImage = async (req, res) => {
  try {
    const { image_data } = req.body;
    if (!image_data) return res.status(400).json({ message: "No image data" });

    const base64 = image_data.replace(/^data:image\/\w+;base64,/, "");
    const mimeMatch = image_data.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const text = await callAIVision(EXTRACT_PROMPT, base64, mimeType);
    const questions = parseJSON(text);
    res.json({ questions, raw: text });
  } catch (err) {
    console.error("AI extract error:", err.message);
    res.status(500).json({ message: "AI extraction failed: " + err.message });
  }
};

export const extractFromPdf = async (req, res) => {
  try {
    const { pages } = req.body;
    if (!pages || !pages.length) return res.status(400).json({ message: "No pages" });

    const allQuestions = [];
    for (let i = 0; i < pages.length; i += 3) {
      const batch = pages.slice(i, i + 3);
      const images = batch.map((page) => ({
        base64: page.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      }));
      try {
        const text = await callAIMultiVision(
          EXTRACT_PROMPT + "\n\nExtract questions from ALL the following pages:",
          images
        );
        const questions = parseJSON(text);
        allQuestions.push(...questions);
      } catch { /* skip failed batch */ }
    }
    res.json({ questions: allQuestions });
  } catch (err) {
    console.error("AI PDF extract error:", err.message);
    res.status(500).json({ message: "AI extraction failed: " + err.message });
  }
};

export const aiChat = async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ message: "No message" });

    const parts = [CHAT_PROMPT];
    if (history && history.length) {
      for (const h of history.slice(-6)) {
        parts.push(`${h.role === "user" ? "Teacher" : "AI"}: ${h.text}`);
      }
    }
    parts.push(`Teacher: ${message}`);

    const text = await callAIText(parts.join("\n\n"));

    let questions = null;
    try {
      const parsed = parseJSON(text);
      if (Array.isArray(parsed)) questions = parsed;
    } catch { /* not JSON */ }

    res.json({ reply: text, questions });
  } catch (err) {
    console.error("AI chat error:", err.message);
    res.status(500).json({ message: "AI chat failed: " + err.message });
  }
};

export const generateDiagram = async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ message: "No description" });

    const text = await callAIText(
      `Create a simple SVG diagram for: "${description}". Return ONLY the SVG code, no explanation. Keep it clean and simple with labels. Use a white background.`
    );

    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
    const svg = svgMatch ? svgMatch[0] : null;

    if (svg) {
      const base64 = Buffer.from(svg).toString("base64");
      res.json({ svg, dataUrl: `data:image/svg+xml;base64,${base64}` });
    } else {
      res.json({ svg: null, dataUrl: null, raw: text });
    }
  } catch (err) {
    console.error("Diagram gen error:", err.message);
    res.status(500).json({ message: "Diagram generation failed: " + err.message });
  }
};

// Analyze a camera snapshot for cheating objects
const PROCTOR_PROMPT = `You are an exam proctoring AI. Analyze this webcam image for cheating.

Check for:
- Mobile phone or smartphone visible
- Tablet or digital device
- Books, notes, papers, or cheat sheets
- Another person in frame (not the student)
- Earphones, earbuds, or headphones
- Smart watch or wearable device
- Student looking away from screen
- Any suspicious objects

Return ONLY valid JSON (no markdown, no backticks):
{
  "cheating": true or false,
  "confidence": 0.0 to 1.0,
  "violations": ["list of detected violations"],
  "description": "brief description of what you see"
}

If the image just shows a student facing the camera normally with no suspicious items, return cheating: false.
Be strict — if ANY prohibited item is visible, return cheating: true.`;

export const analyzeSnapshot = async (req, res) => {
  try {
    const { image_data } = req.body;
    if (!image_data) return res.status(400).json({ message: "No image data" });

    const base64 = image_data.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = "image/jpeg";

    const text = await callAIVision(PROCTOR_PROMPT, base64, mimeType);
    const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch (err) {
    // Don't crash exam if AI analysis fails
    res.json({ cheating: false, confidence: 0, violations: [], description: "Analysis unavailable" });
  }
};
