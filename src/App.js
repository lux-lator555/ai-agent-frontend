import { useState } from "react";
import ReactMarkdown from "react-markdown";

const RENDER_URL = "https://ai-data-analyst-agent-t8b3.onrender.com";

export default function App() {
  const [file, setFile] = useState(null);
  const [goal, setGoal] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!file || !goal || !apiKey) {
      setError("Please fill in all fields and upload a CSV.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          {loading ? "🔄 Agent is analyzing..." : "▶ Run Agent"}
        </button>

        {error && <p style={styles.error}>{error}</p>}

        {result && (
          <div style={styles.results}>
            <h2 style={styles.resultsTitle}>📊 Results</h2>
            <p style={styles.meta}>
              {result.rows} rows · {result.columns} columns · {result.turns} agent turns
            </p>

            {/* Technical Analysis */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>📈 Technical Analysis</h3>
              <div style={styles.markdownBody}>
                <ReactMarkdown>
                  {cleanSummary(result.summary)}
                </ReactMarkdown>
              </div>
            </div>

            {/* Charts */}
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

            {/* Business Recommendations */}
            {result.recommendations && (
              <div style={styles.recommendationsCard}>
                <h3 style={styles.recommendationsTitle}>
                  💡 Business Recommendations
                </h3>
                <div style={styles.markdownBody}>
                  <ReactMarkdown>
                    {result.recommendations}
                  </ReactMarkdown>
                </div>
              </div>
            )}
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
  recommendationsTitle: {
    color: "#6366f1",
    fontSize: "18px",
    marginBottom: "16px",
    fontWeight: "600",
  },
};