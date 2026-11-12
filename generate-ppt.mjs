import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
pptx.layout = "WIDE";

const BG = "F9FAFB";
const GREEN = "22C55E";
const DARK = "111827";
const GRAY = "6B7280";
const WHITE = "FFFFFF";

const addTitleSlide = (title, subtitle) => {
  const slide = pptx.addSlide();
  slide.background = { color: DARK };
  slide.addText(title, { x: 0.8, y: 2.0, w: 11.7, h: 1.5, fontSize: 40, bold: true, color: GREEN, fontFace: "Arial" });
  slide.addText(subtitle, { x: 0.8, y: 3.5, w: 11.7, h: 1, fontSize: 20, color: WHITE, fontFace: "Arial" });
};

const addSectionSlide = (title) => {
  const slide = pptx.addSlide();
  slide.background = { color: GREEN };
  slide.addText(title, { x: 0.8, y: 2.8, w: 11.7, h: 1.5, fontSize: 36, bold: true, color: DARK, fontFace: "Arial" });
};

const addLibSlide = (name, category, description, keyFeatures, usedFor) => {
  const slide = pptx.addSlide();
  slide.background = { color: BG };

  // Category badge
  slide.addText(category, { x: 0.8, y: 0.4, w: 2.5, h: 0.4, fontSize: 11, bold: true, color: WHITE, fill: { color: GREEN }, align: "center", shape: pptx.shapes.ROUNDED_RECTANGLE, rectRadius: 0.15 });

  // Library name
  slide.addText(name, { x: 0.8, y: 1.0, w: 11.7, h: 0.8, fontSize: 32, bold: true, color: DARK, fontFace: "Arial" });

  // Description
  slide.addText(description, { x: 0.8, y: 1.9, w: 11.7, h: 0.7, fontSize: 16, color: GRAY, fontFace: "Arial" });

  // Key Features heading
  slide.addText("Key Features", { x: 0.8, y: 2.8, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: DARK, fontFace: "Arial" });

  // Features list
  const featureText = keyFeatures.map(f => ({ text: `•  ${f}\n`, options: { fontSize: 14, color: DARK, fontFace: "Arial", breakType: "none" } }));
  slide.addText(featureText, { x: 0.8, y: 3.3, w: 5.5, h: 3.5, valign: "top" });

  // Used For heading
  slide.addText("Used In This Project For", { x: 7.0, y: 2.8, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: DARK, fontFace: "Arial" });

  // Used for list
  const usedText = usedFor.map(u => ({ text: `•  ${u}\n`, options: { fontSize: 14, color: DARK, fontFace: "Arial", breakType: "none" } }));
  slide.addText(usedText, { x: 7.0, y: 3.3, w: 5.5, h: 3.5, valign: "top" });
};

// ===================== SLIDES =====================

// 1. Title
addTitleSlide("OEPS - Online Exam Proctoring System", "Technology Stack & Libraries Overview");

// 2. Section: Frontend
addSectionSlide("Frontend Libraries");

// 3. React
addLibSlide(
  "React v19.2",
  "FRONTEND CORE",
  "A JavaScript library for building user interfaces using a component-based architecture with a virtual DOM for efficient rendering.",
  [
    "Component-based architecture",
    "Virtual DOM for fast UI updates",
    "Hooks (useState, useEffect, useRef, useContext)",
    "Declarative rendering",
    "Large ecosystem & community",
  ],
  [
    "Building all UI pages (Login, Dashboards, Exam)",
    "Managing state (answers, timer, violations)",
    "Context API for auth state (AuthProvider)",
    "Refs for camera, timer, and proctoring models",
  ]
);

// 4. React Router DOM
addLibSlide(
  "React Router DOM v7.12",
  "FRONTEND ROUTING",
  "The standard routing library for React, enabling navigation between views without full page reloads (SPA).",
  [
    "Declarative route definitions",
    "Nested and protected routes",
    "URL parameters (useParams)",
    "Programmatic navigation (useNavigate)",
    "Route state passing between pages",
  ],
  [
    "Page navigation (Login → Dashboard → Exam)",
    "Protected routes with role-based access",
    "Passing exam data between Countdown → ExamPage → Result",
    "URL params for examId",
  ]
);

// 5. Axios
addLibSlide(
  "Axios v1.13",
  "HTTP CLIENT",
  "A promise-based HTTP client for making API requests from the browser with automatic JSON handling and interceptors.",
  [
    "Promise-based API requests",
    "Automatic JSON transformation",
    "Request/response interceptors",
    "Default headers configuration",
    "Error handling with status codes",
  ],
  [
    "All API calls to the Express backend",
    "JWT token injection via default headers",
    "Login, register, exam CRUD operations",
    "Student result submission",
  ]
);

// 6. Supabase JS
addLibSlide(
  "@supabase/supabase-js v2.93",
  "DATABASE CLIENT",
  "The official JavaScript client for Supabase — an open-source Firebase alternative providing a PostgreSQL database, auth, and storage.",
  [
    "Real-time PostgreSQL queries",
    "Row-level security (RLS)",
    "Insert, select, update, delete operations",
    "Filtering, ordering, pagination",
    "Storage for file uploads",
  ],
  [
    "Direct database queries for questions CRUD",
    "Fetching exams and questions in ExamPage",
    "Storing exam results and student data",
    "Used in both frontend and backend",
  ]
);

// 7. MediaPipe Tasks Vision
addLibSlide(
  "@mediapipe/tasks-vision v0.10",
  "AI / PROCTORING",
  "Google's ML library for real-time computer vision tasks including face detection, hand tracking, and landmark recognition.",
  [
    "FaceLandmarker — 478 facial landmarks",
    "HandLandmarker — hand gesture detection",
    "GPU-accelerated with CPU fallback",
    "Real-time video frame processing",
    "Iris tracking for gaze estimation",
  ],
  [
    "Face detection (no face / multiple faces)",
    "Eye gaze tracking (looking left/right/away)",
    "Hand detection (cheating prevention)",
    "5-strike warning system with auto-submit",
  ]
);

// 8. Tesseract.js
addLibSlide(
  "Tesseract.js v7.0",
  "OCR ENGINE",
  "A pure JavaScript port of the Tesseract OCR engine — extracts text from images directly in the browser.",
  [
    "Client-side OCR (no server needed)",
    "Supports 100+ languages",
    "Works with photos, screenshots, scans",
    "Web Worker based (non-blocking)",
    "High accuracy text recognition",
  ],
  [
    "Image-to-text conversion for question import",
    "Single image OCR for text extraction",
    "Bulk image upload for batch question creation",
    "Teacher workflow: photo → questions",
  ]
);

// 9. pdfjs-dist
addLibSlide(
  "pdfjs-dist v5.5",
  "PDF PARSER",
  "Mozilla's PDF rendering library that parses PDF files and extracts text content directly in the browser.",
  [
    "Client-side PDF parsing",
    "Text extraction with position data",
    "Page-by-page processing",
    "Web Worker for performance",
    "Preserves text layout and structure",
  ],
  [
    "PDF-to-questions converter",
    "Extracts text with line-break preservation",
    "Smart parsing: detects Q numbers & options",
    "Teacher workflow: PDF → questions",
  ]
);

// 10. @hello-pangea/dnd
addLibSlide(
  "@hello-pangea/dnd v18.0",
  "DRAG & DROP",
  "A beautiful, accessible drag-and-drop library for React lists (community fork of react-beautiful-dnd).",
  [
    "Smooth drag animations",
    "Keyboard accessible",
    "Vertical list reordering",
    "DragDropContext, Droppable, Draggable",
    "Natural movement physics",
  ],
  [
    "Reordering questions in Add Questions page",
    "Drag to rearrange question order before saving",
    "Intuitive teacher UX for exam creation",
  ]
);

// 11. Vite
addLibSlide(
  "Vite v7.2",
  "BUILD TOOL",
  "A next-generation frontend build tool that provides instant dev server startup and lightning-fast HMR (Hot Module Replacement).",
  [
    "Instant dev server (no bundling in dev)",
    "Hot Module Replacement (HMR)",
    "Optimized production builds (Rollup)",
    "ES modules native support",
    "Environment variable handling",
  ],
  [
    "Development server (localhost:5173)",
    "Fast refresh during development",
    "Production build for deployment",
    "VITE_* env vars for API URL & Supabase keys",
  ]
);

// 12. Section: Backend
addSectionSlide("Backend Libraries");

// 13. Express
addLibSlide(
  "Express v5.2",
  "BACKEND FRAMEWORK",
  "The most popular Node.js web framework for building REST APIs with middleware support and routing.",
  [
    "Minimal and flexible HTTP framework",
    "Middleware pipeline (auth, CORS, logging)",
    "Router-based route organization",
    "Request/response handling",
    "JSON body parsing built-in",
  ],
  [
    "REST API server on port 5000",
    "Routes: /api/auth, /api/exams, /api/students",
    "Middleware: JWT auth, role checks, rate limiting",
    "Request logging for debugging",
  ]
);

// 14. bcrypt
addLibSlide(
  "bcrypt v6.0",
  "SECURITY",
  "A library for hashing passwords using the bcrypt algorithm — the industry standard for secure password storage.",
  [
    "One-way password hashing",
    "Salt generation (10 rounds)",
    "Timing-safe comparison",
    "Resistant to brute-force attacks",
    "Industry standard (OWASP recommended)",
  ],
  [
    "Hashing passwords during registration",
    "Comparing passwords during login",
    "Stored as password_hash in users table",
  ]
);

// 15. jsonwebtoken
addLibSlide(
  "jsonwebtoken (JWT) v9.0",
  "AUTHENTICATION",
  "A library to create, sign, and verify JSON Web Tokens — used for stateless authentication in APIs.",
  [
    "Token creation with payload + secret",
    "Expiration time support (7 days)",
    "Signature verification",
    "Stateless — no server sessions needed",
    "Payload carries user ID and role",
  ],
  [
    "Generating tokens on login/register",
    "Protecting API routes via middleware",
    "Role-based access control (admin/teacher/student)",
    "Token stored in localStorage on frontend",
  ]
);

// 16. express-rate-limit
addLibSlide(
  "express-rate-limit v8.2",
  "SECURITY",
  "A middleware for Express that limits repeated requests to APIs — prevents brute-force and DDoS attacks.",
  [
    "Request counting per IP",
    "Configurable time window",
    "Custom limit per route",
    "Automatic 429 Too Many Requests response",
    "In-memory or external store",
  ],
  [
    "Rate limiting login attempts",
    "Rate limiting registration requests",
    "Preventing brute-force password attacks",
  ]
);

// 17. cors
addLibSlide(
  "cors v2.8",
  "MIDDLEWARE",
  "Express middleware to enable Cross-Origin Resource Sharing — allows the frontend (port 5173) to call the backend (port 5000).",
  [
    "Enables cross-origin HTTP requests",
    "Configurable allowed origins",
    "Supports preflight (OPTIONS) requests",
    "Headers: Access-Control-Allow-*",
    "Essential for separate frontend/backend",
  ],
  [
    "Allowing frontend on :5173 to call backend on :5000",
    "Applied globally via app.use(cors())",
  ]
);

// 18. dotenv
addLibSlide(
  "dotenv v17.2",
  "CONFIGURATION",
  "Loads environment variables from a .env file into process.env — keeps secrets out of source code.",
  [
    "Reads .env file on startup",
    "Injects into process.env",
    "Keeps secrets out of git",
    "Supports comments and multiline",
    "Zero-dependency",
  ],
  [
    "Loading SUPABASE_URL and SERVICE_ROLE_KEY",
    "Loading JWT_SECRET",
    "Loading PORT configuration",
  ]
);

// 19. nodemon
addLibSlide(
  "nodemon v3.1",
  "DEV TOOL",
  "A development utility that automatically restarts the Node.js server when file changes are detected.",
  [
    "Watches for file changes",
    "Auto-restarts server",
    "Configurable file extensions",
    "Supports .js, .mjs, .json",
    "Development-only tool",
  ],
  [
    "Auto-restarting backend during development",
    "Watching src/ for code changes",
    "npm run dev → nodemon src/server.js",
  ]
);

// 20. Anti-Cheating Summary
const summarySlide = pptx.addSlide();
summarySlide.background = { color: DARK };
summarySlide.addText("Anti-Cheating Features", { x: 0.8, y: 0.5, w: 11.7, h: 0.8, fontSize: 30, bold: true, color: GREEN, fontFace: "Arial" });

const features = [
  ["MediaPipe Face Detection", "Detects no face or multiple faces in camera"],
  ["Eye Gaze Tracking", "Iris-to-eye ratio detects looking left/right/away"],
  ["Hand Detection", "Flags hands in camera frame"],
  ["Tab Switch Detection", "visibilitychange API detects Alt+Tab"],
  ["Fullscreen Enforcement", "Auto-enters fullscreen, violations on exit"],
  ["Copy/Paste Block", "Prevents copy, cut, paste, right-click"],
  ["Text Selection Block", "CSS userSelect: none on exam page"],
  ["5-Strike Auto-Submit", "Auto-submits exam after 5 extreme violations"],
  ["Violation Logging", "All violations logged with timestamps in results"],
];

features.forEach((f, i) => {
  const y = 1.5 + i * 0.6;
  summarySlide.addText(f[0], { x: 0.8, y, w: 4, h: 0.5, fontSize: 15, bold: true, color: GREEN, fontFace: "Arial" });
  summarySlide.addText(f[1], { x: 5.0, y, w: 7.5, h: 0.5, fontSize: 14, color: WHITE, fontFace: "Arial" });
});

// 21. Thank you
const endSlide = pptx.addSlide();
endSlide.background = { color: DARK };
endSlide.addText("Thank You", { x: 0.8, y: 2.5, w: 11.7, h: 1.5, fontSize: 44, bold: true, color: GREEN, fontFace: "Arial", align: "center" });
endSlide.addText("OEPS — Online Exam Proctoring System", { x: 0.8, y: 4.2, w: 11.7, h: 0.8, fontSize: 20, color: GRAY, fontFace: "Arial", align: "center" });

// Save
pptx.writeFile({ fileName: "OEPS_Libraries_Overview.pptx" }).then(() => {
  console.log("PPT saved: OEPS_Libraries_Overview.pptx");
});
