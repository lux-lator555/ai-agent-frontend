import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
        if (next >= 90) { directionRef.value = -1; setFlip(true); }
        if (next <= 0) { directionRef.value = 1; setFlip(false); }
        return Math.max(0, Math.min(90, next));
      });
    }, 50);
    const rotateMessage = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 3000);
    return () => { clearInterval(moveRobot); clearInterval(rotateMessage); };
  }, [directionRef]);

  return (
    <div style={loaderStyles.container}>
      <div style={loaderStyles.track}>
        <div style={{ ...loaderStyles.robot, left: `${position}%`, transform: flip ? "scaleX(-1)" : "scaleX(1)" }}>🤖</div>
        <div style={loaderStyles.trackLine} />
      </div>
      <p style={loaderStyles.message}>{STATUS_MESSAGES[messageIndex]}</p>
    </div>
  );
}

const loaderStyles = {
  container: { marginTop: "24px", marginBottom: "8px", textAlign: "center" },
  track: { position: "relative", width: "100%", height: "48px", display: "flex", alignItems: "center" },
  trackLine: { position: "absolute", bottom: "8px", left: "0", right: "0", height: "2px", backgroundColor: "#6366f1", borderRadius: "2px" },
  robot: { position: "absolute", fontSize: "28px", bottom: "10px", transition: "left 0.05s linear", userSelect: "none" },
  message: { color: "#6366f1", fontSize: "13px", fontStyle: "italic", marginTop: "12px", minHeight: "20px" },
};

function extractSection(text, startMarker, endMarker) {
  if (!text) return "";
  let start = 0;
  let end = text.length;
  if (startMarker) {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return "";
    start = startIdx;
  }
  if (endMarker) {
    const endIdx = text.indexOf(endMarker);
    if (endIdx !== -1) end = endIdx;
  }
  return text.substring(start, end).trim();
}

function extractMetrics(summary) {
  const models = {};
  const text = summary;
  const modelPatterns = [
    { pattern: /logistic regression/i, name: "Logistic Regression" },
    { pattern: /random forest/i, name: "Random Forest" },
    { pattern: /linear regression/i, name: "Linear Regression" },
    { pattern: /k-?means/i, name: "K-Means" },
    { pattern: /xgboost/i, name: "XGBoost" },
    { pattern: /lightgbm/i, name: "LightGBM" },
  ];
const metricPatterns = [
    { pattern: /\baccuracy[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "Accuracy" },
    { pattern: /\bprecision[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "Precision" },
    { pattern: /\brecall[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "Recall" },
    { pattern: /\bf1[- ]?score[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "F1 Score" },
    { pattern: /\broc[- ]?auc[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "ROC-AUC" },
    { pattern: /\br2[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "R² Score" },
    { pattern: /\brmse[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "RMSE" },
    { pattern: /\bmae[^0-9]*?([0-9]+\.?[0-9]*)%?/i, key: "MAE" },
  ];
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
        let val = parseFloat(match[1]);
        if (val > 1 && val <= 100) val = val / 100;
        if (!isNaN(val) && val >= 0 && val <= 1) {
          if (!models[modelName][key]) models[modelName][key] = val.toFixed(4);
        }
      }
    }
  }
  return models;
}

function ModelComparisonTable({ summary }) {
  // Check if the summary already contains a markdown table with model metrics
  const hasMarkdownTable = /\|.*Accuracy.*\|/i.test(summary) || /\|.*Model.*\|.*Accuracy/i.test(summary);
  if (hasMarkdownTable) return null;

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
              {modelNames.map((m) => <th key={m} style={tableStyles.th}>{m}</th>)}
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
                    <td key={m} style={{
                      ...tableStyles.td,
                      color: values[i] === best ? "#6366f1" : "#94a3b8",
                      fontWeight: values[i] === best ? "700" : "400",
                    }}>
                      {metrics[m][metric] || "—"}{values[i] === best && " ✓"}
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
  container: { marginTop: "24px", marginBottom: "24px" },
  title: { color: "#cbd5e1", fontSize: "16px", fontWeight: "600", marginBottom: "12px" },
  wrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { backgroundColor: "#0f172a", color: "#cbd5e1", padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #334155", fontWeight: "600" },
  td: { padding: "10px 14px", borderBottom: "1px solid #1e293b", color: "#94a3b8" },
};

function DataQualityReport({ report }) {
  if (!report) return null;
  const hasIssues = Object.keys(report.missing_values).length > 0 || Object.keys(report.outliers).length > 0 || report.duplicates > 0;
  return (
    <div style={qualityStyles.container}>
      <h3 style={qualityStyles.title}>🔍 Data Quality Report</h3>
      <div style={qualityStyles.grid}>
        <div style={qualityStyles.stat}><span style={qualityStyles.statValue}>{report.total_rows}</span><span style={qualityStyles.statLabel}>Total Rows</span></div>
        <div style={qualityStyles.stat}><span style={qualityStyles.statValue}>{report.total_columns}</span><span style={qualityStyles.statLabel}>Columns</span></div>
        <div style={qualityStyles.stat}><span style={{ ...qualityStyles.statValue, color: report.duplicates > 0 ? "#f87171" : "#4ade80" }}>{report.duplicates}</span><span style={qualityStyles.statLabel}>Duplicates</span></div>
        <div style={qualityStyles.stat}><span style={{ ...qualityStyles.statValue, color: Object.keys(report.missing_values).length > 0 ? "#fbbf24" : "#4ade80" }}>{Object.keys(report.missing_values).length}</span><span style={qualityStyles.statLabel}>Cols w/ Missing</span></div>
      </div>
      {Object.keys(report.missing_values).length > 0 && (
        <div style={qualityStyles.section}>
          <p style={qualityStyles.sectionTitle}>⚠️ Missing Values</p>
          {Object.entries(report.missing_values).map(([col, info]) => (
            <div key={col} style={qualityStyles.item}>
              <span style={qualityStyles.colName}>{col}</span>
              <span style={qualityStyles.colValue}>{info.count} missing ({info.percentage}%)</span>
            </div>
          ))}
        </div>
      )}
      {Object.keys(report.outliers).length > 0 && (
        <div style={qualityStyles.section}>
          <p style={qualityStyles.sectionTitle}>📊 Outliers Detected</p>
          {Object.entries(report.outliers).map(([col, count]) => (
            <div key={col} style={qualityStyles.item}>
              <span style={qualityStyles.colName}>{col}</span>
              <span style={qualityStyles.colValue}>{count} outliers</span>
            </div>
          ))}
        </div>
      )}
      <div style={qualityStyles.section}>
        <p style={qualityStyles.sectionTitle}>{hasIssues ? "💡 Recommendations" : "✅ Data Quality"}</p>
        {report.recommendations.map((rec, i) => (<p key={i} style={qualityStyles.recommendation}>{rec}</p>))}
      </div>
    </div>
  );
}

const qualityStyles = {
  container: { marginBottom: "24px", backgroundColor: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #334155" },
  title: { color: "#cbd5e1", fontSize: "16px", fontWeight: "600", marginBottom: "16px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" },
  stat: { textAlign: "center", padding: "12px", backgroundColor: "#1e293b", borderRadius: "8px" },
  statValue: { display: "block", fontSize: "24px", fontWeight: "700", color: "#f8fafc" },
  statLabel: { display: "block", fontSize: "11px", color: "#64748b", marginTop: "4px" },
  section: { marginTop: "12px" },
  sectionTitle: { color: "#94a3b8", fontSize: "13px", fontWeight: "600", marginBottom: "8px" },
  item: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b" },
  colName: { color: "#cbd5e1", fontSize: "13px" },
  colValue: { color: "#fbbf24", fontSize: "13px" },
  recommendation: { color: "#4ade80", fontSize: "13px", marginBottom: "4px" },
};

function ConfidenceScores({ scores }) {
  if (!scores || !scores.scores || scores.scores.length === 0) return null;
  const colorMap = { high: "#4ade80", medium: "#fbbf24", low: "#f87171" };
  const emojiMap = { high: "🟢", medium: "🟡", low: "🔴" };
  return (
    <div style={confidenceStyles.container}>
      <div style={confidenceStyles.header}>
        <h3 style={confidenceStyles.title}>🎯 Confidence Assessment</h3>
        <span style={{
          ...confidenceStyles.badge,
          backgroundColor: colorMap[scores.overall_confidence] + "20",
          color: colorMap[scores.overall_confidence],
          border: `1px solid ${colorMap[scores.overall_confidence]}`,
        }}>
          {emojiMap[scores.overall_confidence]} Overall: {scores.overall_confidence.toUpperCase()}
        </span>
      </div>
      {scores.scores.map((item, i) => (
        <div key={i} style={confidenceStyles.item}>
          <div style={confidenceStyles.itemHeader}>
            <span style={confidenceStyles.finding}>{item.finding}</span>
            <span style={{ ...confidenceStyles.itemBadge, color: colorMap[item.confidence] }}>{emojiMap[item.confidence]} {item.confidence.toUpperCase()}</span>
          </div>
          <p style={confidenceStyles.reason}>{item.reason}</p>
        </div>
      ))}
      {scores.caveats && <p style={confidenceStyles.caveats}>⚠️ {scores.caveats}</p>}
    </div>
  );
}

const confidenceStyles = {
  container: { marginTop: "24px", backgroundColor: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #334155" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  title: { color: "#cbd5e1", fontSize: "16px", fontWeight: "600" },
  badge: { padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" },
  item: { padding: "10px 0", borderBottom: "1px solid #1e293b" },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" },
  finding: { color: "#cbd5e1", fontSize: "13px" },
  itemBadge: { fontSize: "12px", fontWeight: "600" },
  reason: { color: "#64748b", fontSize: "12px", margin: "0" },
  caveats: { color: "#fbbf24", fontSize: "12px", marginTop: "12px" },
};

export default function App() {
  const [file, setFile] = useState(null);
  const [goal, setGoal] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [execCopySuccess, setExecCopySuccess] = useState(false);
  const [detection, setDetection] = useState(null);
  const resultsRef = useRef(null);
  const chatBottomRef = useRef(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setDetection(null);
    setGoal("");
    if (selectedFile && apiKey) {
      setDetecting(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("api_key", apiKey);
        const response = await fetch(`${RENDER_URL}/autodetect`, { method: "POST", body: formData });
        if (response.ok) {
          const data = await response.json();
          setDetection(data);
          setGoal(data.suggested_goal);
        }
      } catch (err) {
        console.error("Auto-detect failed:", err);
      } finally {
        setDetecting(false);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file || !goal || !apiKey) { setError("Please fill in all fields and upload a CSV."); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("goal", goal);
    formData.append("api_key", apiKey);
    try {
      const response = await fetch(`${RENDER_URL}/analyze`, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Server error — please try again.");
      const data = await response.json();
      setResult(data);
      setHistory((prev) => [{ id: Date.now(), filename: file.name, goal: goal.substring(0, 60) + (goal.length > 60 ? "..." : ""), timestamp: new Date().toLocaleTimeString(), data }, ...prev.slice(0, 2)]);
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
        body: JSON.stringify({ question, original_summary: result.summary, original_recommendations: result.recommendations, conversation_history: chatHistory, api_key: apiKey }),
      });
      if (!response.ok) throw new Error("Server error — please try again.");
      const data = await response.json();
      setChatHistory([...newHistory, { role: "assistant", content: data.response }]);
      setTimeout(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
    } catch (err) {
      setChatHistory([...newHistory, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!resultsRef.current) return;
    setExporting(true);
    try {
      const images = resultsRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) resolve();
              else { img.onload = resolve; img.onerror = resolve; }
            })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const canvas = await html2canvas(resultsRef.current, {
        scale: 2,
        backgroundColor: "#1e293b",
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const clonedImages = clonedDoc.querySelectorAll('img');
          clonedImages.forEach((img) => {
            img.style.display = 'block';
            img.style.visibility = 'visible';
            img.style.opacity = '1';
          });
        }
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

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

  const handleExportModel = () => {
    if (!result?.model_export) return;
    const blob = new Blob([JSON.stringify(result.model_export, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "model_export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.recommendations);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleExecCopy = () => {
    const execSummary = extractSection(result.recommendations, "Executive Summary", null);
    navigator.clipboard.writeText(execSummary);
    setExecCopySuccess(true);
    setTimeout(() => setExecCopySuccess(false), 2000);
  };

  const cleanSummary = (text) => {
    if (!text) return "";
    return text.replace(/```python[\s\S]*?```/g, "").replace(/```[\s\S]*?```/g, "").trim();
  };

  const mainRecommendations = result?.recommendations
    ? extractSection(result.recommendations, null, "Executive Summary")
    : "";

  const executiveSummary = result?.recommendations
    ? extractSection(result.recommendations, "Executive Summary", null)
    : "";

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🤖 AI Data Analyst Agent</h1>
        <p style={styles.subtitle}>Enter your Gemini API key first, then upload a CSV and the agent will automatically detect what to analyze.</p>

        {history.length > 0 && (
          <div style={styles.historyContainer}>
            <p style={styles.historyLabel}>Recent analyses:</p>
            <div style={styles.historyList}>
              {history.map((item) => (
                <button key={item.id} onClick={() => { setResult(item.data); setChatHistory([]); }} style={styles.historyItem}>
                  <span style={styles.historyFile}>📁 {item.filename}</span>
                  <span style={styles.historyTime}>{item.timestamp}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>Gemini API Key</label>
          <input type="password" placeholder="Your Gemini API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={styles.input} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Upload CSV</label>
          <input type="file" accept=".csv" onChange={handleFileChange} style={styles.input} />
          {detecting && <p style={styles.detecting}>🔍 Scanning dataset...</p>}
          {detection && (
            <div style={styles.detectionCard}>
              <p style={styles.detectionTitle}>🎯 Auto-detected: {detection.problem_type}</p>
              <p style={styles.detectionDetail}>Target: <strong>{detection.target_column || "None (unsupervised)"}</strong> · Models: <strong>{detection.recommended_models?.join(", ")}</strong></p>
              <p style={styles.detectionReasoning}>{detection.reasoning}</p>
            </div>
          )}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Analysis Goal</label>
          <textarea placeholder="e.g. Identify which customers are likely to churn" value={goal} onChange={(e) => setGoal(e.target.value)} style={styles.textarea} />
          <div style={styles.suggestedPrompts}>
            <p style={styles.suggestedLabel}>Suggested prompts:</p>
            <div style={styles.promptButtons}>
              {[
                "Predict which customers are likely to churn. Run BOTH logistic regression AND random forest models separately. For each model print accuracy, precision, recall, F1 score and ROC-AUC. Generate confusion matrix charts and feature importance charts. Use SHAP to explain the top 5 features driving churn predictions.",
                "Predict employee salary based on experience, performance and education. Run linear regression, show which features most strongly predict salary, evaluate with RMSE and R² score, generate feature importance and residual charts. Use SHAP to explain salary predictions.",
                "Identify distinct customer segments using clustering. Use the elbow method to find optimal clusters, run K-Means, visualize the clusters, and describe each segment's characteristics and recommended marketing strategy.",
                "Predict which shipments are likely to be delayed. Run BOTH logistic regression AND random forest models separately. For each model print accuracy, precision, recall, F1 score and ROC-AUC. Generate confusion matrix and feature importance charts. Use SHAP to explain delay predictions.",
                "Detect anomalies and outliers in this dataset. Use Isolation Forest and DBSCAN to identify unusual records. Show how many anomalies were found, visualize them in a scatter plot with anomalies highlighted in red, and explain in plain English what makes each anomaly unusual and what business action should be taken.",
                "Analyze trends in this dataset. Identify date columns and parse them. Calculate month-over-month growth rates, identify seasonality patterns, determine overall trend direction, and forecast the next 3 periods. Generate a time series line chart and a growth rate bar chart. Explain what the trends mean for the business.",
                "Run statistical hypothesis tests on this dataset. Check normality of key variables, compare groups using appropriate tests (t-test or Mann-Whitney), test correlations between variables, and generate box plots and a correlation heatmap. State the null hypothesis, p-value, and conclusion for each test in plain English."
              ].map((prompt, i) => (
                <button key={i} onClick={() => setGoal(prompt)} style={styles.promptButton}>
                  {["🔄 Churn Prediction", "💰 Salary Prediction", "👥 Customer Segmentation", "🚚 Shipment Delay", "🚨 Anomaly Detection", "📈 Trend Analysis", "🔬 Statistical Tests"][i]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={loading} style={loading ? styles.buttonDisabled : styles.button}>
          {loading ? "Analyzing..." : "▶ Run Agent"}
        </button>

        {loading && <RobotLoader />}
        {error && <p style={styles.error}>{error}</p>}

        {result && (
          <div>
            <button onClick={handleExportPDF} disabled={exporting} style={exporting ? styles.exportButtonDisabled : styles.exportButton}>
              {exporting ? "⏳ Generating PDF..." : "⬇ Download PDF Report"}
            </button>

            {result.model_export && Object.keys(result.model_export).length > 0 && (
              <button onClick={handleExportModel} style={styles.exportModelButton}>
                📤 Export Model to PWA
              </button>
            )}

            <div ref={resultsRef} style={styles.results}>
              <h2 style={styles.resultsTitle}>📊 Analysis Report</h2>
              <p style={styles.meta}>{result.rows} rows · {result.columns} columns · {result.turns} agent turns</p>

              <DataQualityReport report={result.quality_report} />

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📈 Technical Analysis</h3>
                <div style={styles.markdownBody} className="markdownBody">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanSummary(result.summary)}</ReactMarkdown>
                </div>
              </div>

              <ModelComparisonTable summary={cleanSummary(result.summary)} />
              <ConfidenceScores scores={result.confidence_scores} />

              {result.charts && result.charts.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>📉 Charts</h3>
                  {result.charts.map((chart, i) => (
                    <img key={i} src={`data:image/png;base64,${chart}`} alt={`Chart ${i + 1}`} style={styles.chart} />
                  ))}
                </div>
              )}

              {mainRecommendations && (
                <div style={styles.recommendationsCard}>
                  <div style={styles.recommendationsHeader}>
                    <h3 style={styles.recommendationsTitle}>💡 Business Recommendations</h3>
                    <button onClick={handleCopy} style={styles.copyButton}>{copySuccess ? "✅ Copied!" : "📋 Copy"}</button>
                  </div>
                  <div style={styles.markdownBody} className="markdownBody">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{mainRecommendations}</ReactMarkdown>
                  </div>
                </div>
              )}

              {executiveSummary && (
                <div style={styles.executiveCard}>
                  <div style={styles.executiveHeader}>
                    <h3 style={styles.executiveTitle}>👔 Executive Summary</h3>
                    <button onClick={handleExecCopy} style={styles.execCopyButton}>{execCopySuccess ? "✅ Copied!" : "📋 Copy for Presentation"}</button>
                  </div>
                  <div style={styles.markdownBody} className="markdownBody">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{executiveSummary}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.chatContainer}>
              <h3 style={styles.chatTitle}>💬 Ask a Follow-Up Question</h3>
              <p style={styles.chatSubtitle}>Ask anything about the analysis, request clarification, or explore what-if scenarios.</p>

              {chatHistory.length > 0 && (
                <div style={styles.chatHistory}>
                  {chatHistory.map((msg, i) => (
                    <div key={i} style={msg.role === "user" ? styles.userBubble : styles.agentBubble}>
                      <div style={styles.bubbleLabel}>{msg.role === "user" ? "You" : "🤖 Agent"}</div>
                      <div style={styles.markdownBody} className="markdownBody">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
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
                <input type="text" placeholder="e.g. Which customers should we contact first?" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFollowUp()} style={styles.chatInput} disabled={chatLoading} />
                <button onClick={handleFollowUp} disabled={chatLoading || !chatInput.trim()} style={chatLoading || !chatInput.trim() ? styles.sendButtonDisabled : styles.sendButton}>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 20px", fontFamily: "'Segoe UI', sans-serif" },
  card: { backgroundColor: "#1e293b", borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "720px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" },
  title: { color: "#f8fafc", fontSize: "28px", marginBottom: "8px" },
  subtitle: { color: "#94a3b8", marginBottom: "32px", fontSize: "15px" },
  historyContainer: { marginBottom: "24px", padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" },
  historyLabel: { color: "#64748b", fontSize: "12px", marginBottom: "8px" },
  historyList: { display: "flex", flexDirection: "column", gap: "6px" },
  historyItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", textAlign: "left" },
  historyFile: { color: "#cbd5e1", fontSize: "12px" },
  historyTime: { color: "#64748b", fontSize: "11px" },
  detecting: { color: "#6366f1", fontSize: "12px", marginTop: "8px", fontStyle: "italic" },
  detectionCard: { marginTop: "10px", padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #6366f1" },
  detectionTitle: { color: "#6366f1", fontSize: "13px", fontWeight: "600", marginBottom: "4px" },
  detectionDetail: { color: "#94a3b8", fontSize: "12px", marginBottom: "4px" },
  detectionReasoning: { color: "#64748b", fontSize: "12px", fontStyle: "italic" },
  field: { marginBottom: "20px" },
  label: { display: "block", color: "#cbd5e1", marginBottom: "8px", fontSize: "14px", fontWeight: "600" },
  input: { width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "#f8fafc", fontSize: "14px", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "#f8fafc", fontSize: "14px", minHeight: "80px", boxSizing: "border-box", resize: "vertical" },
  button: { width: "100%", padding: "14px", backgroundColor: "#6366f1", color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "600", cursor: "pointer", marginTop: "8px" },
  buttonDisabled: { width: "100%", padding: "14px", backgroundColor: "#334155", color: "#94a3b8", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "600", cursor: "not-allowed", marginTop: "8px" },
  exportButton: { width: "100%", padding: "12px", backgroundColor: "#0f172a", color: "#6366f1", border: "2px solid #6366f1", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginTop: "16px" },
  exportButtonDisabled: { width: "100%", padding: "12px", backgroundColor: "#0f172a", color: "#334155", border: "2px solid #334155", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "not-allowed", marginTop: "16px" },
  exportModelButton: { width: "100%", padding: "12px", backgroundColor: "#0f172a", color: "#4ade80", border: "2px solid #4ade80", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginTop: "8px" },
  error: { color: "#f87171", marginTop: "16px", fontSize: "14px" },
  results: { marginTop: "32px", borderTop: "1px solid #334155", paddingTop: "24px" },
  resultsTitle: { color: "#f8fafc", fontSize: "20px", marginBottom: "8px" },
  meta: { color: "#64748b", fontSize: "13px", marginBottom: "20px" },
  section: { marginBottom: "32px" },
  sectionTitle: { color: "#cbd5e1", fontSize: "16px", fontWeight: "600", marginBottom: "12px", marginTop: "24px" },
  markdownBody: { color: "#94a3b8", fontSize: "14px", lineHeight: "1.8" },
  chart: { width: "100%", borderRadius: "8px", marginBottom: "16px", border: "1px solid #334155" },
  recommendationsCard: { marginTop: "32px", backgroundColor: "#0f172a", borderRadius: "12px", padding: "24px", border: "1px solid #6366f1" },
  recommendationsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  recommendationsTitle: { color: "#6366f1", fontSize: "18px", marginBottom: "0px", fontWeight: "600" },
  copyButton: { padding: "6px 12px", backgroundColor: "#1e293b", color: "#6366f1", border: "1px solid #6366f1", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "500" },
  executiveCard: { marginTop: "16px", backgroundColor: "#0f172a", borderRadius: "12px", padding: "24px", border: "2px solid #4ade80" },
  executiveHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  executiveTitle: { color: "#4ade80", fontSize: "18px", marginBottom: "0px", fontWeight: "600" },
  execCopyButton: { padding: "6px 12px", backgroundColor: "#1e293b", color: "#4ade80", border: "1px solid #4ade80", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "500" },
  chatContainer: { marginTop: "32px", borderTop: "1px solid #334155", paddingTop: "24px" },
  chatTitle: { color: "#f8fafc", fontSize: "18px", marginBottom: "8px" },
  chatSubtitle: { color: "#64748b", fontSize: "13px", marginBottom: "16px" },
  chatHistory: { marginBottom: "16px", display: "flex", flexDirection: "column", gap: "12px" },
  userBubble: { backgroundColor: "#334155", borderRadius: "12px", padding: "12px 16px", alignSelf: "flex-end", maxWidth: "85%", marginLeft: "auto" },
  agentBubble: { backgroundColor: "#0f172a", borderRadius: "12px", padding: "12px 16px", border: "1px solid #334155", maxWidth: "95%" },
  bubbleLabel: { fontSize: "11px", color: "#64748b", marginBottom: "6px", fontWeight: "600", textTransform: "uppercase" },
  thinking: { color: "#64748b", fontSize: "14px", fontStyle: "italic" },
  chatInputRow: { display: "flex", gap: "8px" },
  chatInput: { flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "#f8fafc", fontSize: "14px" },
  sendButton: { padding: "10px 20px", backgroundColor: "#6366f1", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  sendButtonDisabled: { padding: "10px 20px", backgroundColor: "#334155", color: "#64748b", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "not-allowed" },
  suggestedPrompts: { marginTop: "10px" },
  suggestedLabel: { color: "#64748b", fontSize: "12px", marginBottom: "8px" },
  promptButtons: { display: "flex", flexWrap: "wrap", gap: "8px" },
  promptButton: { padding: "6px 12px", backgroundColor: "#0f172a", color: "#6366f1", border: "1px solid #6366f1", borderRadius: "20px", fontSize: "12px", cursor: "pointer", fontWeight: "500" },
};