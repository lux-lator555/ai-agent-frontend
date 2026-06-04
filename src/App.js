import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const RENDER_URL = "https://ai-data-analyst-agent-t8b3.onrender.com";

const STATUS_MESSAGES = [
  "Teaching the AI to read spreadsheets...",
  "Arguing with the random forest about feature importance...",
  "Convincing the model your data isn't that messy...",
  "Cross-validating decisions your gut already knew...",
  "Turning correlation into something your CFO can act on...",
  "Hyperparameters have been strongly encouraged...",
  "Finding patterns buried in your pivot tables...",
  "Random forest has cast its votes...",
  "Translating p-values into plain English...",
  "Building a case the data can't deny...",
];

function RobotLoader() {
  const [position, setPosition] = useState(0);
  const [directionRef] = useState({ value: 1 });
  const [messageIndex, setMessageIndex] = useState(0);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    const moveRobot = setInterval(() => {
      setPosition((prev) => {
        const next = prev + directionRef.value * 2;
        if (next >= 90) {
          directionRef.value = -1;
          setFlip(true);
        }
        if (next <= 0) {
          directionRef.value = 1;
          setFlip(false);
        }
        return Math.max(0, Math.min(90, next));
      });
    }, 50);

    const rotateMessage = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 3000);

    return () => {
      clearInterval(moveRobot);
      clearInterval(rotateMessage);
    };
  }, [directionRef]);

  return (
    <div style={loaderStyles.container}>
      <div style={loaderStyles.track}>
        <div
          style={{
            ...loaderStyles.robot,
            left: `${position}%`,
            transform: flip ? "scaleX(-1)" : "scaleX(1)",
          }}
        >
          🤖
        </div>
        <div style={loaderStyles.trackLine} />
      </div>
      <p style={loaderStyles.message}>
        {STATUS_MESSAGES[messageIndex]}
      </p>
    </div>
  );
}

const loaderStyles = {
  container: {
    marginTop: "24px",
    marginBottom: "8px",
    textAlign: "center",
  },
  track: {
    position: "relative",
    width: "100%",
    height: "48px",
    display: "flex",
    alignItems: "center",
  },
  trackLine: {
    position: "absolute",
    bottom: "8px",
    left: "0",
    right: "0",
    height: "2px",
    backgroundColor: "#6366f1",
    borderRadius: "2px",
  },
  robot: {
    position: "absolute",
    fontSize: "28px",
    bottom: "10px",
    transition: "left 0.05s linear",
    userSelect: "none",
  },
  message: {
    color: "#6366f1",
    fontSize: "13px",
    fontStyle: "italic",
    marginTop: "12px",
    minHeight: "20px",
    transition: "opacity 0.3s",
  },
};

// Extract model metrics from summary text for comparison table
function extractMetrics(summary) {
  const models = {};
  const text = summary;

  const modelPatterns = [
    { pattern: /logistic regression/i, name: "Logistic Regression" },
    { pattern: /random forest/i, name: "Random Forest" },
    { pattern: /linear regression/i, name: "Linear Regression" },
    { pattern: /k-?means/i, name: "K-Means" },
  ];

  const metricPatterns = [
    { pattern: /accuracy[:\s*|**]*([0-9.]+)/i, key: "Accuracy" },
    { pattern: /precision[:\s*|**]*([0-9.]+)/i, key: "Precision" },
    { pattern: /recall[:\s*|**]*([0-9.]+)/i, key: "Recall" },
    { pattern: /f1[- ]?score[:\s*|**]*([0-9.]+)/i, key: "F1 Score" },
    { pattern: /r2[:\s*|**]*([0-9.]+)/i, key: "R² Score" },
    { pattern: /rmse[:\s*|**]*([0-9.]+)/i, key: "RMSE" },
    { pattern: /mae[:\s*|**]*([0-9.]+)/i, key: "MAE" },
  ];

  // Split text into sections by model name
  const sections = [];
  let lastIndex = 0;
  let lastModel = null;

  const allMatches = [];
  for (const { pattern, name } of modelPatterns) {
    const regex = new RegExp(pattern.source, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({ index: match.index, name });
    }
  }

  allMatches.sort((a, b) => a.index - b.index);

  for (let i = 0; i < allMatches.length; i++) {
    const start = allMatches[i].index;
    const end = allMatches[i + 1]?.index || text.length;
    const section = text.substring(start, end);
    const modelName = allMatches[i].name;

    if (!models[modelName]) models[modelName] = {};

    for (const { pattern, key } of metricPatterns) {
      const match = section.match(pattern);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val <= 1000) {
          models[modelName][key] = val.toFixed(4);
        }
      }
    }
  }

  return models;
}

function ModelComparisonTable({ summary }) {
  const metrics = extractMetrics(summary);
  const modelNames = Object.keys(metrics);

  if (modelNames.length < 2) return null;

  const allMetrics = [...new Set(modelNames.flatMap((m) => Object.keys(metrics[m])))];

  return (
    <div style={tableStyles.container}>
      <h3 style={tableStyles.title}>📊 Model Comparison</h3>
      <div style={tableStyles.wrapper}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}>Metric</th>
              {modelNames.map((m) => (
                <th key={m} style={tableStyles.th}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allMetrics.map((metric) => {
              const values = modelNames.map((m) => parseFloat(metrics[m][metric] || 0));
              const best = Math.max(...values);
              return (
                <tr key={metric}>
                  <td style={tableStyles.td}>{metric}</td>
                  {modelNames.map((m, i) => (
                    <td
                      key={m}
                      style={{
                        ...tableStyles.td,
                        color: values[i] === best ? "#6366f1" : "#94a3b8",
                        fontWeight: values[i] === best ? "700" : "400",
                      }}
                    >
                      {metrics[m][metric] || "—"}
                      {values[i] === best && " ✓"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tableStyles = {
  container: {
    marginTop: "24px",
    marginBottom: "24px",
  },
  title: {
    color: "#cbd5e1",
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "12px",
  },
  wrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    backgroundColor: "#0f172a",
    color: "#cbd5e1",
    padding: "10px 14px",
    textAlign: "left",
    borderBottom: "1px solid #334155",
    fontWeight: "600",
  },
  td: {
    padding: "10px 14px",
    borderBottom: "1px solid #1e293b",
    color: "#94a3b8",
  },
};

export default function App() {
  const [file, setFile] = useState(null);
  const [goal, setGoal] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const resultsRef = useRef(null);
  const chatBottomRef = useRef(null);

  const handleAnalyze = async () => {
    if (!file || !goal || !apiKey) {
      setError("Please fill in all fields and upload a CSV.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("goal", goal);
    formData.append("api_key", apiKey);

    try {
      const response = await fetch(`${RENDER_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Server error — please try again.");
      const data = await response.json();
      setResult(data);

      // Save to history
      setHistory((prev) => [
        {
          id: Date.now(),
          filename: file.name,
          goal: goal.substring(0, 60) + (goal.length > 60 ? "..." : ""),
          timestamp: new Date().toLocaleTimeString(),
          data,
        },
        ...prev.slice(0, 2),
      ]);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async () => {
    if (!chatInput.trim() || !result) return;

    const question = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    const newHistory = [...chatHistory, { role: "user", content: question }];
    setChatHistory(newHistory);

    try {
      const response = await fetch(`${RENDER_URL}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          original_summary: result.summary,
          original_recommendations: result.recommendations,
          conversation_history: chatHistory,
          api_key: apiKey,
        }),
      });

      if (!response.ok) throw new Error("Server error — please try again.");
      const data = await response.json();

      setChatHistory([
        ...newHistory,
        { role: "assistant", content: data.response },
      ]);

      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

    } catch (err) {
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!resultsRef.current) return;
    setExporting(true);

    try {
      const canvas = await html2canvas(resultsRef.current, {
        scale: 2,
        backgroundColor: "#1e293b",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("AI_Analysis_Report.pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.recommendations);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const cleanSummary = (text) => {
    if (!text) return "";
    return text.replace(/```python[\s\S]*?```/g, "").replace(/```[\s\S]*?```/g, "").trim();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🤖 AI Data Analyst Agent</h1>
        <p style={styles.subtitle}>
          Upload a CSV, describe your goal, and let the agent analyze your data.
        </p>

        {/* Analysis History */}
        {history.length > 0 && (
          <div style={styles.historyContainer}>
            <p style={styles.historyLabel}>Recent analyses:</p>
            <div style={styles.historyList}>
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setResult(item.data);
                    setChatHistory([]);
                  }}
                  style={styles.historyItem}
                >
                  <span style={styles.historyFile}>📁 {item.filename}</span>
                  <span style={styles.historyTime}>{item.timestamp}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>Upload CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Analysis Goal</label>
          <textarea
            placeholder="e.g. Identify which customers are likely to churn"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={styles.textarea}
          />
          <div style={styles.suggestedPrompts}>
            <p style={styles.suggestedLabel}>Suggested prompts:</p>
            <div style={styles.promptButtons}>
              {[
                "Predict which customers are likely to churn. Run logistic regression and random forest, show feature importance, accuracy, precision, recall and F1 score, generate confusion matrices and feature importance charts.",
                "Predict employee salary based on experience, performance and education. Run linear regression, show which features most strongly predict salary, evaluate with RMSE and R² score, generate feature importance and residual charts.",
                "Identify distinct customer segments using clustering. Use the elbow method to find optimal clusters, run K-Means, visualize the clusters, and describe each segment's characteristics and recommended marketing strategy.",
                "Predict which shipments are likely to be delayed. Run logistic regression and random forest, show feature importance, model accuracy, precision, recall and F1 score, generate confusion matrices and feature importance charts."
              ].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setGoal(prompt)}
                  style={styles.promptButton}
                >
                  {["🔄 Churn Prediction", "💰 Salary Prediction", "👥 Customer Segmentation", "🚚 Shipment Delay"][i]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Gemini API Key</label>
          <input
            type="password"
            placeholder="Your Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={styles.input}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={loading ? styles.buttonDisabled : styles.button}
        >
          {loading ? "Analyzing..." : "▶ Run Agent"}
        </button>

        {loading && <RobotLoader />}

        {error && <p style={styles.error}>{error}</p>}

        {result && (
          <div>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              style={exporting ? styles.exportButtonDisabled : styles.exportButton}
            >
              {exporting ? "⏳ Generating PDF..." : "⬇ Download PDF Report"}
            </button>

            <div ref={resultsRef} style={styles.results}>
              <h2 style={styles.resultsTitle}>📊 Analysis Report</h2>
              <p style={styles.meta}>
                {result.rows} rows · {result.columns} columns · {result.turns} agent turns
              </p>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📈 Technical Analysis</h3>
                <div style={styles.markdownBody}>
                  <ReactMarkdown>
                    {cleanSummary(result.summary)}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Model Comparison Table */}
              <ModelComparisonTable summary={cleanSummary(result.summary)} />

              {result.charts && result.charts.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>📉 Charts</h3>
                  {result.charts.map((chart, i) => (
                    <img
                      key={i}
                      src={`data:image/png;base64,${chart}`}
                      alt={`Chart ${i + 1}`}
                      style={styles.chart}
                    />
                  ))}
                </div>
              )}

              {result.recommendations && (
                <div style={styles.recommendationsCard}>
                  <div style={styles.recommendationsHeader}>
                    <h3 style={styles.recommendationsTitle}>
                      💡 Business Recommendations
                    </h3>
                    <button
                      onClick={handleCopy}
                      style={styles.copyButton}
                    >
                      {copySuccess ? "✅ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                  <div style={styles.markdownBody}>
                    <ReactMarkdown>
                      {result.recommendations}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.chatContainer}>
              <h3 style={styles.chatTitle}>💬 Ask a Follow-Up Question</h3>
              <p style={styles.chatSubtitle}>
                Ask anything about the analysis, request clarification, or explore what-if scenarios.
              </p>

              {chatHistory.length > 0 && (
                <div style={styles.chatHistory}>
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      style={msg.role === "user" ? styles.userBubble : styles.agentBubble}
                    >
                      <div style={styles.bubbleLabel}>
                        {msg.role === "user" ? "You" : "🤖 Agent"}
                      </div>
                      <div style={styles.markdownBody}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={styles.agentBubble}>
                      <div style={styles.bubbleLabel}>🤖 Agent</div>
                      <p style={styles.thinking}>Thinking...</p>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
              )}

              <div style={styles.chatInputRow}>
                <input
                  type="text"
                  placeholder="e.g. Which customers should we contact first?"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFollowUp()}
                  style={styles.chatInput}
                  disabled={chatLoading}
                />
                <button
                  onClick={handleFollowUp}
                  disabled={chatLoading || !chatInput.trim()}
                  style={chatLoading || !chatInput.trim() ? styles.sendButtonDisabled : styles.sendButton}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "40px 20px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "720px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  title: {
    color: "#f8fafc",
    fontSize: "28px",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#94a3b8",
    marginBottom: "32px",
    fontSize: "15px",
  },
  historyContainer: {
    marginBottom: "24px",
    padding: "12px",
    backgroundColor: "#0f172a",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  historyLabel: {
    color: "#64748b",
    fontSize: "12px",
    marginBottom: "8px",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  historyItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    cursor: "pointer",
    textAlign: "left",
  },
  historyFile: {
    color: "#cbd5e1",
    fontSize: "12px",
  },
  historyTime: {
    color: "#64748b",
    fontSize: "11px",
  },
  field: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    color: "#cbd5e1",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: "600",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontSize: "14px",
    minHeight: "80px",
    boxSizing: "border-box",
    resize: "vertical",
  },
  button: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "8px",
  },
  buttonDisabled: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#334155",
    color: "#94a3b8",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "not-allowed",
    marginTop: "8px",
  },
  exportButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#0f172a",
    color: "#6366f1",
    border: "2px solid #6366f1",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "16px",
  },
  exportButtonDisabled: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#0f172a",
    color: "#334155",
    border: "2px solid #334155",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "not-allowed",
    marginTop: "16px",
  },
  error: {
    color: "#f87171",
    marginTop: "16px",
    fontSize: "14px",
  },
  results: {
    marginTop: "32px",
    borderTop: "1px solid #334155",
    paddingTop: "24px",
  },
  resultsTitle: {
    color: "#f8fafc",
    fontSize: "20px",
    marginBottom: "8px",
  },
  meta: {
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "20px",
  },
  section: {
    marginBottom: "32px",
  },
  sectionTitle: {
    color: "#cbd5e1",
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "12px",
    marginTop: "24px",
  },
  markdownBody: {
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: "1.8",
  },
  chart: {
    width: "100%",
    borderRadius: "8px",
    marginBottom: "16px",
    border: "1px solid #334155",
  },
  recommendationsCard: {
    marginTop: "32px",
    backgroundColor: "#0f172a",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid #6366f1",
  },
  recommendationsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  recommendationsTitle: {
    color: "#6366f1",
    fontSize: "18px",
    marginBottom: "0px",
    fontWeight: "600",
  },
  copyButton: {
    padding: "6px 12px",
    backgroundColor: "#1e293b",
    color: "#6366f1",
    border: "1px solid #6366f1",
    borderRadius: "8px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "500",
  },
  chatContainer: {
    marginTop: "32px",
    borderTop: "1px solid #334155",
    paddingTop: "24px",
  },
  chatTitle: {
    color: "#f8fafc",
    fontSize: "18px",
    marginBottom: "8px",
  },
  chatSubtitle: {
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "16px",
  },
  chatHistory: {
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  userBubble: {
    backgroundColor: "#334155",
    borderRadius: "12px",
    padding: "12px 16px",
    alignSelf: "flex-end",
    maxWidth: "85%",
    marginLeft: "auto",
  },
  agentBubble: {
    backgroundColor: "#0f172a",
    borderRadius: "12px",
    padding: "12px 16px",
    border: "1px solid #334155",
    maxWidth: "95%",
  },
  bubbleLabel: {
    fontSize: "11px",
    color: "#64748b",
    marginBottom: "6px",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  thinking: {
    color: "#64748b",
    fontSize: "14px",
    fontStyle: "italic",
  },
  chatInputRow: {
    display: "flex",
    gap: "8px",
  },
  chatInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontSize: "14px",
  },
  sendButton: {
    padding: "10px 20px",
    backgroundColor: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  sendButtonDisabled: {
    padding: "10px 20px",
    backgroundColor: "#334155",
    color: "#64748b",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "not-allowed",
  },
  suggestedPrompts: {
    marginTop: "10px",
  },
  suggestedLabel: {
    color: "#64748b",
    fontSize: "12px",
    marginBottom: "8px",
  },
  promptButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  promptButton: {
    padding: "6px 12px",
    backgroundColor: "#0f172a",
    color: "#6366f1",
    border: "1px solid #6366f1",
    borderRadius: "20px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "500",
  },
};