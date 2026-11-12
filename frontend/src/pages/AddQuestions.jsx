import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "../supabaseClient";
import { api } from "../services/apiclient";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const EMPTY_Q = { question: "", options: ["", "", "", ""], correct: 0, marks: 1, diagram: "" };

export default function AddQuestions() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([{ ...EMPTY_Q }]);

  // AI extraction state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [transferQueue, setTransferQueue] = useState([]); // questions ready to transfer
  const [previewImage, setPreviewImage] = useState(null);

  // AI Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  /* ═══ LOAD EXISTING QUESTIONS ═══ */
  useEffect(() => { fetchQuestions(); }, [examId]);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("questions").select("*").eq("exam_id", examId).order("id");
    if (!error && data.length > 0) {
      setQuestions(data.map(q => ({
        question: q.question,
        options: [q.option_a, q.option_b, q.option_c, q.option_d],
        correct: ["A", "B", "C", "D"].indexOf(q.correct_option),
        marks: q.marks || 1,
        diagram: q.diagram_url || "",
      })));
    }
  };

  /* ═══ QUESTION HANDLERS ═══ */
  const updateQuestion = (qi, key, val) => { const c = [...questions]; c[qi][key] = val; setQuestions(c); };
  const updateOption = (qi, oi, val) => { const c = [...questions]; c[qi].options[oi] = val; setQuestions(c); };
  const addAnotherQuestion = () => setQuestions([...questions, { ...EMPTY_Q }]);
  const deleteQuestion = (i) => { if (questions.length === 1) return; const c = [...questions]; c.splice(i, 1); setQuestions(c); };
  const onDragEnd = (res) => {
    if (!res.destination) return;
    const c = [...questions]; const [m] = c.splice(res.source.index, 1); c.splice(res.destination.index, 0, m); setQuestions(c);
  };

  /* ═══ AI: EXTRACT FROM IMAGE ═══ */
  const fileToBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file);
  });

  const handleAiImageExtract = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    setAiLoading(true);
    setAiStatus("AI is analyzing the image...");
    setPreviewImage(URL.createObjectURL(file));
    setTransferQueue([]);

    try {
      const base64 = await fileToBase64(file);
      const { data } = await api.post("/api/ai/extract-image", { image_data: base64 });
      if (data.questions?.length) {
        setTransferQueue(data.questions.map(q => ({ ...q, diagram: q.diagram_description ? "" : "" })));
        setAiStatus(`Found ${data.questions.length} question(s)`);
      } else {
        setAiStatus("No questions detected in the image");
      }
    } catch (err) {
      setAiStatus("AI extraction failed: " + (err.response?.data?.message || err.message));
    } finally {
      setAiLoading(false);
    }
  };

  /* ═══ AI: EXTRACT FROM PDF ═══ */
  const handleAiPdfExtract = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    setAiLoading(true);
    setAiStatus("Reading PDF pages...");
    setPreviewImage(null);
    setTransferQueue([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];

      // Render each page to an image
      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        setAiStatus(`Rendering page ${i}/${Math.min(pdf.numPages, 10)}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
      }

      setAiStatus("AI is analyzing the PDF...");
      const { data } = await api.post("/api/ai/extract-pdf", { pages });
      if (data.questions?.length) {
        setTransferQueue(data.questions.map(q => ({ ...q, diagram: "" })));
        setAiStatus(`Found ${data.questions.length} question(s) from ${pages.length} page(s)`);
      } else {
        setAiStatus("No questions detected in the PDF");
      }
    } catch (err) {
      setAiStatus("PDF extraction failed: " + (err.response?.data?.message || err.message));
    } finally {
      setAiLoading(false);
    }
  };

  /* ═══ AI: BULK IMAGE EXTRACT ═══ */
  const handleAiBulkExtract = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = "";

    setAiLoading(true);
    setPreviewImage(null);
    setTransferQueue([]);
    const allQ = [];

    for (let i = 0; i < files.length; i++) {
      setAiStatus(`Analyzing image ${i + 1}/${files.length}...`);
      try {
        const base64 = await fileToBase64(files[i]);
        const { data } = await api.post("/api/ai/extract-image", { image_data: base64 });
        if (data.questions?.length) allQ.push(...data.questions);
      } catch { /* skip failed */ }
    }

    if (allQ.length) {
      setTransferQueue(allQ.map(q => ({ ...q, diagram: "" })));
      setAiStatus(`Found ${allQ.length} question(s) from ${files.length} image(s)`);
    } else {
      setAiStatus("No questions detected");
    }
    setAiLoading(false);
  };

  /* ═══ TRANSFER QUEUE → QUESTIONS ═══ */
  const transferAll = () => {
    const mapped = transferQueue.map(q => ({
      question: q.question,
      options: q.options || ["", "", "", ""],
      correct: q.correct ?? 0,
      marks: q.marks || 1,
      diagram: q.diagram || "",
    }));
    setQuestions(prev => prev[0].question === "" ? mapped : [...prev, ...mapped]);
    setTransferQueue([]);
    setAiStatus("Transferred!");
  };

  const transferOne = (idx) => {
    const q = transferQueue[idx];
    const mapped = {
      question: q.question,
      options: q.options || ["", "", "", ""],
      correct: q.correct ?? 0,
      marks: q.marks || 1,
      diagram: q.diagram || "",
    };
    setQuestions(prev => prev[0].question === "" ? [mapped] : [...prev, mapped]);
    setTransferQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const removeFromQueue = (idx) => setTransferQueue(prev => prev.filter((_, i) => i !== idx));

  /* ═══ AI CHAT ═══ */
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);

    try {
      const { data } = await api.post("/api/ai/chat", {
        message: msg,
        history: chatMessages,
      });

      if (data.questions?.length) {
        // AI returned questions — add to transfer queue
        setTransferQueue(prev => [...prev, ...data.questions.map(q => ({ ...q, diagram: "" }))]);
        setChatMessages(prev => [...prev, {
          role: "ai",
          text: `Generated ${data.questions.length} question(s). Check the transfer panel!`,
          hasQuestions: true,
        }]);
      } else {
        setChatMessages(prev => [...prev, { role: "ai", text: data.reply }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "ai", text: "Error: " + (err.response?.data?.message || err.message) }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  /* ═══ DIAGRAM UPLOAD ═══ */
  const handleDiagramUpload = (qi, e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const c = [...questions]; c[qi].diagram = reader.result; setQuestions(c); };
    reader.readAsDataURL(file);
  };
  const removeDiagram = (qi) => { const c = [...questions]; c[qi].diagram = ""; setQuestions(c); };

  /* ═══ SUBMIT ═══ */
  const handleSubmit = async (e) => {
    e.preventDefault();
    for (const q of questions) {
      if (!q.question || q.options.some(o => !o)) { alert("Fill all questions and options"); return; }
    }

    // Build payload — only include columns that exist in the table
    const payload = questions.map(q => {
      const row = {
        exam_id: examId,
        question: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        option_d: q.options[3],
        correct_option: ["A", "B", "C", "D"][q.correct] || "A",
        marks: q.marks || 1,
      };
      // Only include diagram_url if it has a value (avoids 400 if column doesn't exist)
      if (q.diagram) row.diagram_url = q.diagram;
      return row;
    });

    // Try with diagram_url first, fallback without it
    let { error } = await supabase.from("questions").insert(payload);

    if (error && error.message?.includes("diagram_url")) {
      // Column doesn't exist — retry without it
      const fallback = payload.map(({ diagram_url, ...rest }) => rest);
      const res = await supabase.from("questions").insert(fallback);
      error = res.error;
    }

    if (error) {
      console.error("Save error:", error);
      alert("Failed to save: " + error.message);
    } else {
      alert("Questions saved!");
      fetchQuestions();
    }
  };

  /* ═══ UI ═══ */
  return (
    <div className="themed-page" style={S.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => navigate(-1)}><i className="fas fa-arrow-left" /> Back</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-primary)" }}>Add Questions</h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Exam ID: {examId}</span>
        </div>
        <button style={S.chatToggle} onClick={() => setChatOpen(!chatOpen)}>
          <i className="fas fa-robot" /> AI Chat
        </button>
      </div>

      <div style={S.layout}>
        {/* ─── LEFT: QUESTIONS FORM ─── */}
        <form onSubmit={handleSubmit} style={S.card}>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="q">
              {(p) => (
                <div ref={p.innerRef} {...p.droppableProps}>
                  {questions.map((q, qi) => (
                    <Draggable key={qi} draggableId={String(qi)} index={qi}>
                      {(p) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                          <div style={S.qBlock}>
                            <div style={S.qHeader}>
                              <h4 style={{ margin: 0 }}>Q{qi + 1}</h4>
                              <button type="button" style={S.deleteBtn} onClick={() => deleteQuestion(qi)}>
                                <i className="fas fa-trash" />
                              </button>
                            </div>
                            <textarea value={q.question} onChange={e => updateQuestion(qi, "question", e.target.value)} style={S.input} placeholder="Question text..." required />
                            <div style={S.diagramSection}>
                              {q.diagram ? (
                                <div style={S.diagramPreview}>
                                  <img src={q.diagram} style={S.diagramImg} alt="Diagram" />
                                  <button type="button" style={S.removeDiagramBtn} onClick={() => removeDiagram(qi)}>Remove</button>
                                </div>
                              ) : (
                                <label style={S.diagramLabel}>
                                  <input type="file" accept="image/*" hidden onChange={(e) => handleDiagramUpload(qi, e)} />
                                  <i className="fas fa-image" style={{ marginRight: 4 }} /> Add Diagram
                                </label>
                              )}
                            </div>
                            {q.options.map((o, oi) => (
                              <div key={oi} style={S.optionRow}>
                                <span style={{ ...S.optionLabel, background: q.correct === oi ? "var(--primary)" : "var(--bg-card-nested)", color: q.correct === oi ? "#fff" : "var(--text-secondary)" }}>
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <input value={o} onChange={e => updateOption(qi, oi, e.target.value)} style={{ ...S.input, marginBottom: 0, flex: 1 }} placeholder={`Option ${String.fromCharCode(65 + oi)}`} required />
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <select value={q.correct} onChange={e => updateQuestion(qi, "correct", Number(e.target.value))} style={{ ...S.input, marginBottom: 0, flex: 1 }}>
                                {["A", "B", "C", "D"].map((l, i) => <option key={i} value={i}>Correct: {l}</option>)}
                              </select>
                              <input type="number" min="1" value={q.marks} onChange={e => updateQuestion(qi, "marks", Number(e.target.value))} style={{ ...S.input, marginBottom: 0, width: 80 }} placeholder="Marks" />
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {p.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <button type="button" style={S.addBtn} onClick={addAnotherQuestion}>+ Add Question</button>
          <button style={S.submitBtn}>Save All Questions</button>
        </form>

        {/* ─── RIGHT: AI PANEL ─── */}
        <div style={S.aiPanel}>
          <div style={S.aiTitle}><i className="fas fa-wand-magic-sparkles" style={{ marginRight: 8 }} /> AI Question Extractor</div>

          <input hidden id="aiImg" type="file" accept="image/*" onChange={handleAiImageExtract} />
          <input hidden id="aiBulk" type="file" accept="image/*" multiple onChange={handleAiBulkExtract} />
          <input hidden id="aiPdf" type="file" accept=".pdf" onChange={handleAiPdfExtract} />

          <div style={S.aiButtons}>
            <button style={S.aiBtn} onClick={() => document.getElementById("aiImg").click()} disabled={aiLoading}>
              <i className="fas fa-image" /> Single Image
            </button>
            <button style={S.aiBtn} onClick={() => document.getElementById("aiBulk").click()} disabled={aiLoading}>
              <i className="fas fa-images" /> Multiple Images
            </button>
            <button style={S.aiBtn} onClick={() => document.getElementById("aiPdf").click()} disabled={aiLoading}>
              <i className="fas fa-file-pdf" /> PDF Upload
            </button>
          </div>

          {/* Status */}
          {aiStatus && (
            <div style={{ ...S.aiStatusBox, borderColor: aiLoading ? "var(--info)" : transferQueue.length ? "var(--primary)" : "var(--warning)" }}>
              {aiLoading && <div style={S.miniSpinner} />}
              <span>{aiStatus}</span>
            </div>
          )}

          {/* Image preview */}
          {previewImage && (
            <div style={S.previewBox}>
              <img src={previewImage} style={S.previewImg} alt="Uploaded" />
            </div>
          )}

          {/* Transfer Queue */}
          {transferQueue.length > 0 && (
            <div style={S.transferSection}>
              <div style={S.transferHeader}>
                <span style={S.transferTitle}>
                  <i className="fas fa-list-check" style={{ marginRight: 6 }} />
                  {transferQueue.length} Question(s) Ready
                </span>
                <button style={S.transferAllBtn} onClick={transferAll}>
                  <i className="fas fa-arrow-left" style={{ marginRight: 4 }} /> Transfer All
                </button>
              </div>
              {transferQueue.map((q, i) => (
                <div key={i} style={{ ...S.transferCard, animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
                  <div style={S.transferQ}>
                    <span style={S.transferNum}>Q{i + 1}</span>
                    <span style={S.transferText}>{q.question}</span>
                  </div>
                  <div style={S.transferOpts}>
                    {(q.options || []).map((o, oi) => (
                      <span key={oi} style={{ ...S.transferOpt, background: q.correct === oi ? "#DCFCE7" : "var(--bg-card-nested)", color: q.correct === oi ? "#166534" : "var(--text-secondary)", fontWeight: q.correct === oi ? 700 : 400 }}>
                        {String.fromCharCode(65 + oi)}. {o}
                        {q.correct === oi && <i className="fas fa-check" style={{ marginLeft: 4, fontSize: 10 }} />}
                      </span>
                    ))}
                  </div>
                  {q.diagram_description && (
                    <div style={S.diagramDesc}>
                      <i className="fas fa-chart-area" style={{ marginRight: 4 }} /> {q.diagram_description}
                    </div>
                  )}
                  <div style={S.transferActions}>
                    <button style={S.transferOneBtn} onClick={() => transferOne(i)}>
                      <i className="fas fa-plus" /> Add
                    </button>
                    <button style={S.removeQBtn} onClick={() => removeFromQueue(i)}>
                      <i className="fas fa-times" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── AI CHAT POPUP ─── */}
      {chatOpen && (
        <div style={S.chatPopup}>
          <style>{`
            @keyframes typingDot { 0%,60%,100%{opacity:.3;transform:translateY(0)} 30%{opacity:1;transform:translateY(-4px)} }
            @keyframes chatSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          `}</style>

          {/* Header */}
          <div style={S.chatHeader}>
            <div style={S.chatHeaderLeft}>
              <div style={S.chatAvatar}><i className="fas fa-robot" style={{ fontSize: 14 }} /></div>
              <div>
                <div style={S.chatHeaderName}>AI Question Assistant</div>
                <div style={S.chatHeaderStatus}>
                  <span style={{ ...S.statusDot, background: chatLoading ? "#F59E0B" : "#22C55E" }} />
                  {chatLoading ? "Thinking..." : "Online"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={S.chatHeaderBtn} onClick={() => { setChatMessages([]); setTransferQueue([]); }} title="Clear chat">
                <i className="fas fa-trash-alt" />
              </button>
              <button style={S.chatHeaderBtn} onClick={() => setChatOpen(false)} title="Close">
                <i className="fas fa-times" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={S.chatBody}>
            {chatMessages.length === 0 && (
              <div style={S.chatWelcome}>
                <div style={S.welcomeIcon}>
                  <i className="fas fa-wand-magic-sparkles" style={{ fontSize: 28, color: "var(--primary)" }} />
                </div>
                <div style={S.welcomeTitle}>How can I help you?</div>
                <div style={S.welcomeText}>I can generate exam questions on any topic. Try one of these:</div>
                <div style={S.chipGrid}>
                  {[
                    "Make 5 MCQs on photosynthesis",
                    "10 physics questions on Newton's laws",
                    "Generate chemistry MCQs on periodic table",
                    "5 hard math questions on calculus",
                  ].map((chip, i) => (
                    <button key={i} style={S.chip} onClick={() => { setChatInput(chip); }}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((m, i) => (
              <div key={i} style={{ ...S.chatMsgRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "chatSlideUp 0.3s ease" }}>
                {m.role === "ai" && (
                  <div style={S.msgAvatar}><i className="fas fa-robot" style={{ fontSize: 11, color: "var(--primary)" }} /></div>
                )}
                <div style={{
                  ...S.chatBubble,
                  background: m.role === "user" ? "var(--primary)" : "var(--bg-card-nested)",
                  color: m.role === "user" ? "#fff" : "var(--text-primary)",
                  borderBottomRightRadius: m.role === "user" ? 4 : 16,
                  borderBottomLeftRadius: m.role === "ai" ? 4 : 16,
                }}>
                  <div style={S.bubbleText}>{m.text}</div>
                  {m.hasQuestions && (
                    <div style={S.bubbleTag}>
                      <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
                      Questions added to transfer panel
                    </div>
                  )}
                  <div style={S.msgTime}>
                    {m.role === "user" ? "You" : "AI"} · just now
                  </div>
                </div>
                {m.role === "user" && (
                  <div style={{ ...S.msgAvatar, background: "var(--primary)", color: "#fff" }}>
                    <i className="fas fa-user" style={{ fontSize: 11 }} />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {chatLoading && (
              <div style={{ ...S.chatMsgRow, justifyContent: "flex-start", animation: "chatSlideUp 0.2s ease" }}>
                <div style={S.msgAvatar}><i className="fas fa-robot" style={{ fontSize: 11, color: "var(--primary)" }} /></div>
                <div style={{ ...S.chatBubble, background: "var(--bg-card-nested)", padding: "12px 18px", borderBottomLeftRadius: 4 }}>
                  <div style={S.typingDots}>
                    <span style={{ ...S.dot, animationDelay: "0s" }} />
                    <span style={{ ...S.dot, animationDelay: "0.15s" }} />
                    <span style={{ ...S.dot, animationDelay: "0.3s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={S.chatInputArea}>
            <div style={S.chatInputRow}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask me to generate questions..."
                style={S.chatInputField}
                disabled={chatLoading}
              />
              <button
                style={{ ...S.chatSendBtn, opacity: (!chatInput.trim() || chatLoading) ? 0.5 : 1 }}
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
              >
                <i className="fas fa-paper-plane" />
              </button>
            </div>
            <div style={S.chatFooter}>
              Powered by AI · Questions appear in the transfer panel
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ STYLES ═══ */
const S = {
  page: { minHeight: "100vh", padding: 20, color: "var(--text-primary)" },
  topBar: { display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" },
  backBtn: { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, fontSize: 13 },
  chatToggle: { marginLeft: "auto", background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 },
  layout: { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 },
  card: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", padding: 16, borderRadius: 14, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  qBlock: { border: "1px solid var(--border-default)", padding: 14, borderRadius: 10, marginBottom: 12, background: "var(--bg-card-nested)" },
  qHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  deleteBtn: { background: "var(--danger-light)", border: "none", color: "var(--danger-light-text)", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  input: { width: "100%", padding: 10, marginBottom: 8, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)", borderRadius: 6, boxSizing: "border-box", fontSize: 13 },
  optionRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 },
  optionLabel: { width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, border: "1px solid var(--border-default)" },
  diagramSection: { marginBottom: 8 },
  diagramLabel: { display: "inline-flex", alignItems: "center", padding: "6px 12px", background: "var(--bg-card-nested)", border: "1px dashed var(--text-muted)", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" },
  diagramPreview: { position: "relative", display: "inline-block" },
  diagramImg: { maxWidth: "100%", maxHeight: 150, borderRadius: 6, border: "1px solid var(--border-default)" },
  removeDiagramBtn: { position: "absolute", top: 4, right: 4, background: "var(--danger)", color: "#fff", border: "none", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" },
  addBtn: { width: "100%", padding: 10, background: "var(--bg-card-nested)", border: "1px dashed var(--border-default)", color: "var(--text-secondary)", borderRadius: 8, marginBottom: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 },
  submitBtn: { width: "100%", padding: 12, background: "var(--primary)", color: "var(--text-on-primary)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 },

  /* AI Panel */
  aiPanel: { background: "var(--glass-bg)", backdropFilter: "blur(var(--glass-blur))", padding: 16, borderRadius: 14, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" },
  aiTitle: { fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center" },
  aiButtons: { display: "flex", gap: 6, flexWrap: "wrap" },
  aiBtn: { flex: 1, minWidth: 100, padding: "10px 8px", background: "var(--primary)", color: "var(--text-on-primary)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 },
  aiStatusBox: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-default)", marginTop: 10, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", background: "var(--bg-card-nested)" },
  miniSpinner: { width: 16, height: 16, border: "2px solid var(--border-default)", borderTop: "2px solid var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 },
  previewBox: { marginTop: 10, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-default)", maxHeight: 200 },
  previewImg: { width: "100%", display: "block", objectFit: "contain" },

  /* Transfer */
  transferSection: { marginTop: 12 },
  transferHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  transferTitle: { fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center" },
  transferAllBtn: { background: "var(--primary)", color: "var(--text-on-primary)", border: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center" },
  transferCard: { background: "var(--bg-card-nested)", border: "1px solid var(--border-light)", borderRadius: 8, padding: 10, marginBottom: 6 },
  transferQ: { display: "flex", gap: 8, marginBottom: 6 },
  transferNum: { background: "var(--primary)", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800, flexShrink: 0, height: "fit-content" },
  transferText: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 },
  transferOpts: { display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 },
  transferOpt: { padding: "3px 8px", borderRadius: 4, fontSize: 12, border: "1px solid var(--border-light)" },
  diagramDesc: { fontSize: 11, color: "var(--info)", marginBottom: 6, display: "flex", alignItems: "center" },
  transferActions: { display: "flex", gap: 6 },
  transferOneBtn: { background: "var(--primary)", color: "#fff", border: "none", padding: "4px 12px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 },
  removeQBtn: { background: "var(--danger-light)", color: "var(--danger-light-text)", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 },

  /* Chat popup */
  chatPopup: {
    position: "fixed", bottom: 20, right: 20, width: 400, height: 560,
    background: "var(--bg-card-solid)", borderRadius: 20,
    boxShadow: "0 12px 48px rgba(0,0,0,0.25), 0 0 0 1px var(--glass-border)",
    display: "flex", flexDirection: "column", zIndex: 1000, overflow: "hidden",
  },
  chatHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 16px", background: "var(--bg-page)",
    borderBottom: "1px solid var(--border-light)",
  },
  chatHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  chatAvatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "var(--primary-light)", color: "var(--primary)",
    display: "grid", placeItems: "center",
  },
  chatHeaderName: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)" },
  chatHeaderStatus: { fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  chatHeaderBtn: {
    background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
    fontSize: 14, padding: 6, borderRadius: 6,
  },

  chatBody: {
    flex: 1, overflowY: "auto", padding: "16px 14px",
    display: "flex", flexDirection: "column", gap: 12,
    background: "var(--bg-page)",
  },

  /* Welcome */
  chatWelcome: { display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 8px", gap: 8 },
  welcomeIcon: {
    width: 56, height: 56, borderRadius: "50%",
    background: "var(--primary-light)", display: "grid", placeItems: "center",
  },
  welcomeTitle: { fontSize: 16, fontWeight: 800, color: "var(--text-primary)" },
  welcomeText: { fontSize: 12, color: "var(--text-muted)", textAlign: "center" },
  chipGrid: { display: "flex", flexDirection: "column", gap: 6, width: "100%", marginTop: 6 },
  chip: {
    background: "var(--bg-card-nested)", border: "1px solid var(--border-light)",
    borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)",
    cursor: "pointer", textAlign: "left", fontWeight: 500,
    transition: "all 0.15s",
  },

  /* Messages */
  chatMsgRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  msgAvatar: {
    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
    background: "var(--primary-light)", color: "var(--primary)",
    display: "grid", placeItems: "center", fontSize: 12,
  },
  chatBubble: {
    padding: "10px 14px", borderRadius: 16, fontSize: 13,
    lineHeight: 1.5, wordBreak: "break-word", maxWidth: "75%",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  },
  bubbleText: { whiteSpace: "pre-wrap" },
  bubbleTag: {
    marginTop: 6, fontSize: 11, fontWeight: 600,
    color: "#166534", background: "#DCFCE7",
    padding: "4px 8px", borderRadius: 6,
    display: "inline-flex", alignItems: "center",
  },
  msgTime: { fontSize: 10, color: "var(--text-muted)", marginTop: 4, opacity: 0.7 },

  /* Typing dots */
  typingDots: { display: "flex", gap: 4, alignItems: "center", height: 20 },
  dot: {
    width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)",
    animation: "typingDot 1.2s ease-in-out infinite",
  },

  /* Input area */
  chatInputArea: { padding: "10px 14px 8px", borderTop: "1px solid var(--border-light)", background: "var(--bg-card-solid)" },
  chatInputRow: { display: "flex", gap: 8 },
  chatInputField: {
    flex: 1, padding: "10px 14px", border: "1px solid var(--border-default)",
    borderRadius: 12, fontSize: 13, background: "var(--bg-input)",
    color: "var(--text-primary)", outline: "none",
  },
  chatSendBtn: {
    background: "var(--primary)", color: "#fff", border: "none",
    borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontSize: 14,
    transition: "opacity 0.15s",
  },
  chatFooter: {
    fontSize: 10, color: "var(--text-muted)", textAlign: "center",
    marginTop: 6, paddingBottom: 2,
  },
};
