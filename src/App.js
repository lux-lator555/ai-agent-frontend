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
  let result = text.substring(start, end).trim();
  result = result.replace(/\n#{0,6}\s*\d+\.\s*$/, "").trim();
  return result;
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

function extractBestModelInfo(summary, metrics) {
  const modelNames = Object.keys(metrics || {});
  if (modelNames.length === 0) return null;
  const metricPriority = ["ROC-AUC", "F1 Score", "R² Score", "Accuracy"];
  let bestMetric = null;
  for (const m of metricPriority) {
    if (modelNames.some((mod) => metrics[mod][m])) { bestMetric = m; break; }
  }
  if (!bestMetric) return { name: modelNames[0], metric: null, value: null };
  let best = { name: modelNames[0], value: -Infinity };
  for (const mod of modelNames) {
    const val = parseFloat(metrics[mod][bestMetric] || -Infinity);
    if (val > best.value) best = { name: mod, value: val };
  }
  return { name: best.name, metric: bestMetric, value: best.value };
}

function distributeChartsInText(text, charts) {
  if (!charts || charts.length === 0) {
    return [{ type: "text", content: text }];
  }
  const anchorPatterns = [
    /confusion matrix/i, /feature importance/i, /shap/i, /learning curve/i,
    /roc curve/i, /residual/i, /elbow/i, /cluster/i, /anomaly/i, /scatter/i,
    /correlation/i, /distribution/i, /trend/i, /seasonality/i, /forecast/i,
    /cohort/i, /retention heatmap/i, /principal component/i, /pca/i,
    /rfm/i, /box plot/i, /pareto/i, /control chart/i,
  ];
  const paragraphs = text.split(/\n\n+/);
  const blocks = [];
  let chartIdx = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    blocks.push({ type: "text", content: paragraphs[i] });
    const matchesAnchor = anchorPatterns.some((p) => p.test(paragraphs[i]));
    if (matchesAnchor && chartIdx < charts.length) {
      blocks.push({ type: "chart", content: charts[chartIdx] });
      chartIdx++;
    }
  }
  while (chartIdx < charts.length) {
    blocks.push({ type: "chart", content: charts[chartIdx] });
    chartIdx++;
  }
  return blocks;
}

function Collapsible({ title, icon, defaultOpen = false, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={collapseStyles.container}>
      <div style={collapseStyles.header} onClick={() => setOpen(!open)}>
        <span style={collapseStyles.title}>
          <span style={{ marginRight: "8px" }}>{icon}</span>
          {title}
          {badge && <span style={{ marginLeft: "10px" }}>{badge}</span>}
        </span>
        <span style={{ ...collapseStyles.chev, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>
      {open && <div style={collapseStyles.body}>{children}</div>}
    </div>
  );
}

const collapseStyles = {
  container: { border: "1px solid #334155", borderRadius: "12px", marginBottom: "12px", overflow: "hidden", backgroundColor: "#0f172a" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", cursor: "pointer" },
  title: { fontSize: "14px", fontWeight: "600", color: "#cbd5e1", display: "flex", alignItems: "center" },
  chev: { fontSize: "16px", color: "#64748b", transition: "transform 0.15s" },
  body: { padding: "0 18px 18px", fontSize: "14px", color: "#94a3b8", lineHeight: "1.8" },
};

function ModelComparisonTable({ summary }) {
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
                    <td key={m} style={{ ...tableStyles.td, color: values[i] === best ? "#6366f1" : "#94a3b8", fontWeight: values[i] === best ? "700" : "400" }}>
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
  container: { marginTop: "16px", marginBottom: "16px" },
  title: { color: "#cbd5e1", fontSize: "15px", fontWeight: "600", marginBottom: "12px" },
  wrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { backgroundColor: "#1e293b", color: "#cbd5e1", padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #334155", fontWeight: "600" },
  td: { padding: "10px 14px", borderBottom: "1px solid #1e293b", color: "#94a3b8" },
};

function DataQualityReport({ report }) {
  if (!report) return null;
  const hasIssues = Object.keys(report.missing_values).length > 0 || Object.keys(report.outliers).length > 0 || report.duplicates > 0;
  return (
    <div>
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
            <div key={col} style={qualityStyles.item}><span style={qualityStyles.colName}>{col}</span><span style={qualityStyles.colValue}>{info.count} missing ({info.percentage}%)</span></div>
          ))}
        </div>
      )}
      {Object.keys(report.outliers).length > 0 && (
        <div style={qualityStyles.section}>
          <p style={qualityStyles.sectionTitle}>📊 Outliers Detected</p>
          {Object.entries(report.outliers).map(([col, count]) => (
            <div key={col} style={qualityStyles.item}><span style={qualityStyles.colName}>{col}</span><span style={qualityStyles.colValue}>{count} outliers</span></div>
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
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" },
  stat: { textAlign: "center", padding: "12px", backgroundColor: "#1e293b", borderRadius: "8px" },
  statValue: { display: "block", fontSize: "22px", fontWeight: "700", color: "#f8fafc" },
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
    <div>
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
  item: { padding: "10px 0", borderBottom: "1px solid #1e293b" },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" },
  finding: { color: "#cbd5e1", fontSize: "13px" },
  itemBadge: { fontSize: "12px", fontWeight: "600" },
  reason: { color: "#64748b", fontSize: "12px", margin: "0" },
  caveats: { color: "#fbbf24", fontSize: "12px", marginTop: "12px" },
};

function ConfidenceBadge({ scores }) {
  if (!scores || !scores.overall_confidence) return <span style={{ color: "#64748b" }}>—</span>;
  const colorMap = { high: "#4ade80", medium: "#fbbf24", low: "#f87171" };
  const emojiMap = { high: "🟢", medium: "🟡", low: "🔴" };
  const conf = scores.overall_confidence;
  return (
    <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "600", backgroundColor: colorMap[conf] + "20", color: colorMap[conf], border: `1px solid ${colorMap[conf]}` }}>
      {emojiMap[conf]} {conf.charAt(0).toUpperCase() + conf.slice(1)}
    </span>
  );
}

// ---------- SQL Query Tab ----------

function SqlBlock({ title, description, sql, defaultOpen = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Collapsible title={title} icon="📋" defaultOpen={defaultOpen}
      badge={<button onClick={(e) => { e.stopPropagation(); handleCopy(); }} style={sqlStyles.copyBtn}>{copied ? "✅ Copied!" : "Copy SQL"}</button>}>
      {description && <p style={sqlStyles.description}>{description}</p>}
      <pre style={sqlStyles.pre}><code style={sqlStyles.code}>{sql}</code></pre>
    </Collapsible>
  );
}

const sqlStyles = {
  copyBtn: { padding: "3px 10px", backgroundColor: "#1e293b", color: "#6366f1", border: "1px solid #6366f1", borderRadius: "6px", fontSize: "11px", cursor: "pointer", fontWeight: "500" },
  description: { color: "#64748b", fontSize: "13px", marginBottom: "12px", fontStyle: "italic" },
  pre: { backgroundColor: "#020617", borderRadius: "8px", padding: "16px", overflowX: "auto", margin: "0", border: "1px solid #1e293b" },
  code: { color: "#e2e8f0", fontSize: "12px", fontFamily: "monospace", lineHeight: "1.6", whiteSpace: "pre" },
  dbSelector: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", padding: "12px 16px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" },
  dbLabel: { color: "#94a3b8", fontSize: "13px", fontWeight: "600" },
  dbSelect: { padding: "6px 10px", backgroundColor: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: "6px", fontSize: "13px", cursor: "pointer" },
  infoBox: { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#64748b" },
  tableTag: { display: "inline-block", backgroundColor: "#1e293b", color: "#6366f1", padding: "2px 8px", borderRadius: "4px", fontFamily: "monospace", fontSize: "12px", marginLeft: "6px" },
};

function SqlTab({ sqlQueries }) {
  const [dbFlavor, setDbFlavor] = useState("standard");
  const [copiedCreate, setCopiedCreate] = useState(false);

  if (!sqlQueries || !sqlQueries.table_name) {
    return <p style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic" }}>No SQL queries generated yet. Run an analysis to generate SQL.</p>;
  }

  const adaptSql = (sql) => {
    if (!sql) return "";
    switch (dbFlavor) {
      case "sqlserver":
        return sql.replace(/LIMIT (\d+)/gi, "-- Use TOP $1 in SQL Server: SELECT TOP $1 ...")
                  .replace(/DATE_TRUNC/gi, "DATETRUNC");
      case "mysql":
        return sql.replace(/DECIMAL\(10,2\)/gi, "DOUBLE")
                  .replace(/VARCHAR\(255\)/gi, "TEXT");
      case "bigquery":
        return sql.replace(/DATETIME/gi, "TIMESTAMP")
                  .replace(/VARCHAR\(255\)/gi, "STRING")
                  .replace(/INTEGER/gi, "INT64")
                  .replace(/DECIMAL\(10,2\)/gi, "FLOAT64");
      default:
        return sql;
    }
  };

  return (
    <div>
      <div style={sqlStyles.dbSelector}>
        <span style={sqlStyles.dbLabel}>Database:</span>
        <select style={sqlStyles.dbSelect} value={dbFlavor} onChange={e => setDbFlavor(e.target.value)}>
          <option value="standard">Standard SQL (ANSI)</option>
          <option value="sqlserver">SQL Server / Azure</option>
          <option value="snowflake">Snowflake</option>
          <option value="bigquery">BigQuery</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
        </select>
        <span style={sqlStyles.dbLabel}>Table:</span>
        <span style={sqlStyles.tableTag}>{sqlQueries.table_name}</span>
      </div>

      <div style={sqlStyles.infoBox}>
        💡 These queries are generated based on the analysis performed. Copy them directly into your database client, BI tool, or data pipeline. Adjust table names and schema prefixes as needed for your environment.
      </div>

      <Collapsible title="Table Definition" icon="🏗️" defaultOpen={true}
        badge={
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(adaptSql(sqlQueries.create_table)); setCopiedCreate(true); setTimeout(() => setCopiedCreate(false), 2000); }} style={sqlStyles.copyBtn}>
            {copiedCreate ? "✅ Copied!" : "Copy SQL"}
          </button>
        }>
        <p style={sqlStyles.description}>Use this to create the table in your database before importing the CSV data.</p>
        <pre style={sqlStyles.pre}><code style={sqlStyles.code}>{adaptSql(sqlQueries.create_table)}</code></pre>
      </Collapsible>

      {sqlQueries.main_query && (
        <SqlBlock
          title="Main Analysis Query"
          description="Pulls the primary dataset used in this analysis with all relevant columns and filters."
          sql={adaptSql(sqlQueries.main_query)}
          defaultOpen={true}
        />
      )}

      {sqlQueries.metric_queries && sqlQueries.metric_queries.length > 0 && (
        <div>
          <h3 style={{ color: "#cbd5e1", fontSize: "15px", fontWeight: "600", margin: "20px 0 12px" }}>📊 Key Metric Queries</h3>
          {sqlQueries.metric_queries.map((q, i) => (
            <SqlBlock key={i} title={q.title} description={q.description} sql={adaptSql(q.sql)} />
          ))}
        </div>
      )}

      {sqlQueries.monitoring_query && sqlQueries.monitoring_query.sql && (
        <div>
          <h3 style={{ color: "#cbd5e1", fontSize: "15px", fontWeight: "600", margin: "20px 0 12px" }}>🔄 Operational Monitoring</h3>
          <SqlBlock
            title={sqlQueries.monitoring_query.title || "Daily Monitoring Query"}
            description={sqlQueries.monitoring_query.description}
            sql={adaptSql(sqlQueries.monitoring_query.sql)}
            defaultOpen={true}
          />
        </div>
      )}
    </div>
  );
}

// ---------- VBA Macros Tab ----------

function VbaBlock({ title, description, vba, defaultOpen = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(vba);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Collapsible title={title} icon="📊" defaultOpen={defaultOpen}
      badge={<button onClick={(e) => { e.stopPropagation(); handleCopy(); }} style={sqlStyles.copyBtn}>{copied ? "✅ Copied!" : "Copy VBA"}</button>}>
      {description && <p style={sqlStyles.description}>{description}</p>}
      <pre style={sqlStyles.pre}><code style={sqlStyles.code}>{vba}</code></pre>
    </Collapsible>
  );
}

function VbaTab({ vbaMacros }) {
  const [copiedSetup, setCopiedSetup] = useState(false);

  if (!vbaMacros || Object.keys(vbaMacros).length === 0) {
    return <p style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic" }}>No VBA macros generated yet. Run an analysis to generate VBA.</p>;
  }

  return (
    <div>
      <div style={sqlStyles.infoBox}>
        💡 Copy these macros into the Excel VBA editor (Alt+F11 → Insert → Module) to replicate this analysis directly in Excel. Update cell references and sheet names to match your workbook.
      </div>

      {vbaMacros.workbook_setup && (
        <Collapsible title="Workbook Setup" icon="🏗️" defaultOpen={true}
          badge={
            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(vbaMacros.workbook_setup); setCopiedSetup(true); setTimeout(() => setCopiedSetup(false), 2000); }} style={sqlStyles.copyBtn}>
              {copiedSetup ? "✅ Copied!" : "Copy VBA"}
            </button>
          }>
          <p style={sqlStyles.description}>Run this first to set up sheet names, headers, and formatting.</p>
          <pre style={sqlStyles.pre}><code style={sqlStyles.code}>{vbaMacros.workbook_setup}</code></pre>
        </Collapsible>
      )}

      {vbaMacros.kpi_dashboard_macro && vbaMacros.kpi_dashboard_macro.vba && (
        <VbaBlock title={vbaMacros.kpi_dashboard_macro.title || "KPI Dashboard Macro"}
          description={vbaMacros.kpi_dashboard_macro.description}
          vba={vbaMacros.kpi_dashboard_macro.vba} defaultOpen={true} />
      )}

      {vbaMacros.anomaly_flagging_macro && vbaMacros.anomaly_flagging_macro.vba && (
        <VbaBlock title={vbaMacros.anomaly_flagging_macro.title || "Anomaly Flagging Macro"}
          description={vbaMacros.anomaly_flagging_macro.description}
          vba={vbaMacros.anomaly_flagging_macro.vba} />
      )}

      {vbaMacros.chart_macro && vbaMacros.chart_macro.vba && (
        <VbaBlock title={vbaMacros.chart_macro.title || "Chart Generation Macro"}
          description={vbaMacros.chart_macro.description}
          vba={vbaMacros.chart_macro.vba} />
      )}

      {vbaMacros.refresh_macro && vbaMacros.refresh_macro.vba && (
        <VbaBlock title={vbaMacros.refresh_macro.title || "Data Refresh Macro"}
          description={vbaMacros.refresh_macro.description}
          vba={vbaMacros.refresh_macro.vba} />
      )}
    </div>
  );
}

// ---------- Board Deck Tab ----------

function BoardDeckTab({ boardDeck }) {
  if (!boardDeck || !boardDeck.slide1) {
    return <p style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic" }}>No board deck generated yet. Run an analysis to generate one.</p>;
  }

  const { slide1, slide2, slide3 } = boardDeck;

  return (
    <div style={deckStyles.wrap}>
      <div style={deckStyles.infoBox}>
        💡 A 60-second board-ready summary. Screenshot each slide directly into a presentation.
      </div>

      <div style={deckStyles.slide}>
        <div style={deckStyles.slideLabel}>Slide 1 of 3 — the finding</div>
        <div style={deckStyles.headline}>{slide1.headline}</div>
        <div style={deckStyles.metricRow}>
          {slide1.metrics && slide1.metrics.map((m, i) => (
            <div key={i} style={deckStyles.metricCard}>
              <div style={deckStyles.metricVal}>{m.val}</div>
              <div style={deckStyles.metricLbl}>{m.lbl}</div>
            </div>
          ))}
        </div>
        {slide1.chart && (
          <img src={`data:image/png;base64,${slide1.chart}`} alt="Slide 1 chart" style={deckStyles.chartImg} />
        )}
      </div>

      <div style={deckStyles.slide}>
        <div style={deckStyles.slideLabel}>Slide 2 of 3 — the recommendation</div>
        <div style={deckStyles.headline}>{slide2.headline}</div>
        <div style={deckStyles.recList}>
          {slide2.recommendations && slide2.recommendations.map((r, i) => (
            <div key={i} style={deckStyles.recItem}>
              <div style={deckStyles.recNum}>{i + 1}</div>
              <div style={deckStyles.recText}>{r.text}</div>
              <div style={deckStyles.recImpact}>{r.impact}</div>
            </div>
          ))}
        </div>
        <div style={deckStyles.askBanner}>🎯 {slide2.ask}</div>
      </div>

      <div style={deckStyles.slide}>
        <div style={deckStyles.slideLabel}>Slide 3 of 3 — the range of outcomes</div>
        <div style={deckStyles.headline}>{slide3.headline}</div>
        <div style={deckStyles.scenarioRow}>
          {slide3.scenarios && slide3.scenarios.map((s, i) => (
            <div key={i} style={{
              ...deckStyles.scenarioCard,
              ...(i === 1 ? deckStyles.scenarioCardHighlight : {})
            }}>
              <div style={{ ...deckStyles.scenarioLabel, color: i === 1 ? "#4ade80" : "#94a3b8" }}>{s.label}</div>
              <div style={{ ...deckStyles.scenarioVal, color: i === 1 ? "#4ade80" : "#f8fafc" }}>{s.val}</div>
              <div style={deckStyles.scenarioSub}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const deckStyles = {
  wrap: { display: "flex", flexDirection: "column", gap: "16px" },
  infoBox: { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: "#64748b" },
  slide: { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "24px 28px" },
  slideLabel: { fontSize: "12px", color: "#64748b", marginBottom: "10px" },
  headline: { fontSize: "19px", fontWeight: "600", color: "#f8fafc", marginBottom: "18px", lineHeight: "1.4" },
  metricRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" },
  metricCard: { backgroundColor: "#1e293b", borderRadius: "8px", padding: "14px", textAlign: "center" },
  metricVal: { fontSize: "22px", fontWeight: "700", color: "#f8fafc" },
  metricLbl: { fontSize: "12px", color: "#94a3b8", marginTop: "4px" },
  chartImg: { width: "100%", borderRadius: "8px", marginTop: "8px" },
  recList: { display: "flex", flexDirection: "column", gap: "10px" },
  recItem: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", backgroundColor: "#1e293b", borderRadius: "8px" },
  recNum: { width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#1e3a5f", color: "#93c5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600", flexShrink: 0 },
  recText: { fontSize: "14px", color: "#f8fafc", flex: 1 },
  recImpact: { fontSize: "13px", fontWeight: "600", color: "#4ade80", whiteSpace: "nowrap" },
  askBanner: { marginTop: "16px", padding: "14px 16px", backgroundColor: "#1e3a5f", borderRadius: "8px", fontSize: "13px", color: "#93c5fd" },
  scenarioRow: { display: "flex", gap: "12px" },
  scenarioCard: { flex: 1, borderRadius: "12px", padding: "18px 14px", textAlign: "center", backgroundColor: "#1e293b", border: "1px solid #334155" },
  scenarioCardHighlight: { border: "2px solid #4ade80" },
  scenarioLabel: { fontSize: "12px", marginBottom: "8px" },
  scenarioVal: { fontSize: "24px", fontWeight: "700" },
  scenarioSub: { fontSize: "11px", color: "#64748b", marginTop: "6px" },
};

// ---------- Main App ----------

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
  const [activeTab, setActiveTab] = useState("overview");
  const [chatOpen, setChatOpen] = useState(true);
  const resultsRef = useRef(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    const keepAlive = setInterval(() => {
      fetch(`${RENDER_URL}/`).catch(() => {});
    }, 10 * 60 * 1000);
    return () => clearInterval(keepAlive);
  }, []);

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
    setActiveTab("overview");
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
      await Promise.all(Array.from(images).map((img) => new Promise((resolve) => {
        if (img.complete) resolve();
        else { img.onload = resolve; img.onerror = resolve; }
      })));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const canvas = await html2canvas(resultsRef.current, {
        scale: 2, backgroundColor: "#1e293b", useCORS: true, allowTaint: true,
        logging: false, imageTimeout: 15000,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('img').forEach((img) => {
            img.style.display = 'block'; img.style.visibility = 'visible'; img.style.opacity = '1';
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

  const cleanedSummaryText = result ? cleanSummary(result.summary) : "";
  const metrics = result ? extractMetrics(cleanedSummaryText) : {};
  const bestModel = result ? extractBestModelInfo(cleanedSummaryText, metrics) : null;
  const contentBlocks = result ? distributeChartsInText(cleanedSummaryText, result.charts || []) : [];

  return (
    <div style={styles.page}>
      <div style={styles.outerCard}>
        <h1 style={styles.title}>🤖 AI Data Analyst Agent</h1>
        <p style={styles.subtitle}>Enter your Gemini API key first, then upload a CSV and the agent will automatically detect what to analyze.</p>

        {history.length > 0 && (
          <div style={styles.historyContainer}>
            <p style={styles.historyLabel}>Recent analyses:</p>
            <div style={styles.historyList}>
              {history.map((item) => (
                <button key={item.id} onClick={() => { setResult(item.data); setChatHistory([]); setActiveTab("overview"); }} style={styles.historyItem}>
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
          <label style={styles.label}>Upload File</label>
          <input type="file" accept=".csv,.xlsx,.xls,.json,.pdf" onChange={handleFileChange} style={styles.input} />
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
                "Run statistical hypothesis tests on this dataset. Check normality of key variables, compare groups using appropriate tests (t-test or Mann-Whitney), test correlations between variables, and generate box plots and a correlation heatmap. State the null hypothesis, p-value, and conclusion for each test in plain English.",
                "Run RFM analysis on this customer transaction dataset. Calculate Recency, Frequency, and Monetary scores for each customer. Segment customers into groups like Champions, Loyal Customers, At Risk, Lost, and New Customers. Generate a bar chart of customer counts per segment and a scatter plot of Recency vs Frequency colored by segment. Recommend marketing actions for each segment.",
                "Run cohort retention analysis on this dataset. Group customers into cohorts based on their signup date month. For each cohort, calculate the retention rate for each subsequent month. Generate a cohort retention heatmap. Determine whether newer cohorts retain better or worse than older cohorts and explain what this means for the business.",
                "Perform a Six Sigma and Lean analysis on this operational dataset. The key process metric is dwell_time_hours with a target of 2.5 hours. FIRST generate these 3 mandatory charts in a single code block: (1) a control chart of dwell_time_hours over time with UCL and LCL lines marked in red and data points outside limits colored red, (2) a Pareto chart of defect_category sorted by frequency with cumulative % line, (3) a SHAP feature importance bar chart showing top drivers of dwell time. THEN in a second code block calculate: mean, std dev, UCL, LCL, DPMO, and sigma level. THEN write the DMAIC summary with baseline sigma level, top root causes from Pareto and SHAP, recommended improvements, projected sigma level, and financial impact assuming each excess dwell hour costs $85."
              ].map((prompt, i) => (
                <button key={i} onClick={() => setGoal(prompt)} style={styles.promptButton}>
                  {["🔄 Churn Prediction", "💰 Salary Prediction", "👥 Customer Segmentation", "🚚 Shipment Delay", "🚨 Anomaly Detection", "📈 Trend Analysis", "🔬 Statistical Tests", "🏆 RFM Analysis", "📅 Cohort Analysis", "⚙️ Six Sigma / Lean"][i]}
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
      </div>

      {result && (
        <div style={styles.dashboardWrap}>
          <div style={styles.summaryBar}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryVal}>{result.rows?.toLocaleString()}</div>
              <div style={styles.summaryLbl}>Rows analyzed</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={{ ...styles.summaryVal, fontSize: "16px" }}>{bestModel?.name || "—"}</div>
              <div style={styles.summaryLbl}>Best model</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={{ ...styles.summaryVal, color: "#4ade80" }}>
                {bestModel?.value != null ? (bestModel.value <= 1 ? (bestModel.value * 100).toFixed(1) + "%" : bestModel.value.toFixed(2)) : "—"}
              </div>
              <div style={styles.summaryLbl}>{bestModel?.metric || "Metric"}</div>
            </div>
            <div style={styles.summaryCard}>
              <ConfidenceBadge scores={result.confidence_scores} />
              <div style={styles.summaryLbl}>Confidence</div>
            </div>
          </div>

          <div style={{ ...styles.layout, gridTemplateColumns: chatOpen ? "1fr 320px" : "1fr" }}>
            <div style={styles.mainCol} ref={resultsRef}>
              <div style={styles.actionRow}>
                <button onClick={handleExportPDF} disabled={exporting} style={exporting ? styles.exportButtonDisabled : styles.exportButton}>
                  {exporting ? "⏳ Generating PDF..." : "⬇ Download PDF Report"}
                </button>
                {result.model_export && Object.keys(result.model_export).length > 0 && (
                  <button onClick={handleExportModel} style={styles.exportModelButton}>📤 Export Model to PWA</button>
                )}
                {!chatOpen && (
                  <button onClick={() => setChatOpen(true)} style={styles.toggleChatButton}>💬 Open Chat</button>
                )}
              </div>

              <div style={styles.tabs}>
                <button onClick={() => setActiveTab("overview")} style={activeTab === "overview" ? styles.tabActive : styles.tab}>📊 Overview</button>
                <button onClick={() => setActiveTab("recommendations")} style={activeTab === "recommendations" ? styles.tabActive : styles.tab}>💡 Recommendations</button>
                <button onClick={() => setActiveTab("sql")} style={activeTab === "sql" ? styles.tabActive : styles.tab}>🗄️ SQL Queries</button>
                <button onClick={() => setActiveTab("vba")} style={activeTab === "vba" ? styles.tabActive : styles.tab}>📗 Excel / VBA</button>
                <button onClick={() => setActiveTab("deck")} style={activeTab === "deck" ? styles.tabActive : styles.tab}>🎯 Board Deck</button>
              </div>

              {activeTab === "overview" && (
                <div>
                  <Collapsible title="Data Quality Report" icon="🔍" defaultOpen={true}>
                    <DataQualityReport report={result.quality_report} />
                  </Collapsible>
                  <Collapsible title="Technical Analysis" icon="📈" defaultOpen={true}>
                    {contentBlocks.map((block, i) =>
                      block.type === "text" ? (
                        block.content.trim() && (
                          <div key={i} style={styles.markdownBody} className="markdownBody">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
                          </div>
                        )
                      ) : (
                        <img key={i} src={`data:image/png;base64,${block.content}`} alt={`Chart ${i + 1}`} style={styles.chart} />
                      )
                    )}
                    <ModelComparisonTable summary={cleanedSummaryText} />
                  </Collapsible>
                  <Collapsible title="Confidence Assessment" icon="🎯">
                    <ConfidenceScores scores={result.confidence_scores} />
                  </Collapsible>
                  {result.devils_advocate && (
                    <Collapsible title="Devil's Advocate Review" icon="🔍">
                      <p style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic", marginBottom: "12px" }}>
                        5 challenges to these findings — stress-testing the analysis before you act on it.
                      </p>
                      <div style={styles.markdownBody} className="markdownBody">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.devils_advocate}</ReactMarkdown>
                      </div>
                    </Collapsible>
                  )}
                </div>
              )}

              {activeTab === "recommendations" && (
                <div>
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
                  {result.roi_charts && result.roi_charts.length > 0 && (
                    <div style={styles.roiChartsSection}>
                      <h3 style={styles.roiChartsTitle}>📊 Projected Impact</h3>
                      {result.roi_charts.map((chart, i) => (
                        <img key={i} src={`data:image/png;base64,${chart}`} alt={`ROI Chart ${i + 1}`} style={styles.chart} />
                      ))}
                    </div>
                  )}
                  {result.monte_carlo && result.monte_carlo.chart && (
                    <div style={styles.monteCarloSection}>
                      <h3 style={styles.roiChartsTitle}>🎲 Monte Carlo Simulation</h3>
                      <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "12px" }}>
                        {result.monte_carlo.n_runs?.toLocaleString()} simulated outcomes modeling uncertainty in the projected impact.
                      </p>
                      <div style={styles.monteCarloStats}>
                        <div style={styles.mcStat}>
                          <div style={styles.mcStatVal}>${result.monte_carlo.p5?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={styles.mcStatLbl}>5th percentile (pessimistic)</div>
                        </div>
                        <div style={{ ...styles.mcStat, ...styles.mcStatHighlight }}>
                          <div style={{ ...styles.mcStatVal, color: "#4ade80" }}>${result.monte_carlo.p50?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={styles.mcStatLbl}>Median (most likely)</div>
                        </div>
                        <div style={styles.mcStat}>
                          <div style={styles.mcStatVal}>${result.monte_carlo.p95?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={styles.mcStatLbl}>95th percentile (optimistic)</div>
                        </div>
                      </div>
                      <div style={styles.mcProbBox}>
                        <p style={styles.mcProbText}>
                          🎯 <strong>{result.monte_carlo.prob_exceed_base_pct}%</strong> probability of meeting or exceeding the base case estimate
                        </p>
                        <p style={styles.mcProbText}>
                          ✅ <strong>{result.monte_carlo.prob_exceed_low_pct}%</strong> probability of exceeding the conservative estimate
                        </p>
                      </div>
                    <img src={`data:image/png;base64,${result.monte_carlo.chart}`} alt="Monte Carlo simulation histogram" style={styles.chart} />
                  </div>
                )}
                  {mainRecommendations && (
                    <Collapsible title="Recommended Initiatives & ROI" icon="💡" defaultOpen={true}
                      badge={<button onClick={handleCopy} style={styles.copyButton}>{copySuccess ? "✅ Copied!" : "📋 Copy"}</button>}>
                      <div style={styles.markdownBody} className="markdownBody">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{mainRecommendations}</ReactMarkdown>
                      </div>
                    </Collapsible>
                  )}
                </div>
              )}

              {activeTab === "sql" && (
                <SqlTab sqlQueries={result.sql_queries} />
              )}

              {activeTab === "vba" && (
                <VbaTab vbaMacros={result.vba_macros} />
              )}

              {activeTab === "deck" && (
                <BoardDeckTab boardDeck={result.board_deck} />
              )}
            </div>

            {chatOpen && (
              <div style={styles.chatPanel}>
                <div style={styles.chatHeader}>
                  <span>💬 Ask about this analysis</span>
                  <button onClick={() => setChatOpen(false)} style={styles.chatCloseButton} title="Collapse chat">✕</button>
                </div>
                <div style={styles.chatMessages}>
                  {chatHistory.length === 0 && (
                    <p style={styles.chatEmpty}>Ask anything about the analysis, request clarification, or explore what-if scenarios.</p>
                  )}
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
                <div style={styles.chatInputRow}>
                  <input type="text" placeholder="Ask a question..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFollowUp()} style={styles.chatInput} disabled={chatLoading} />
                  <button onClick={handleFollowUp} disabled={chatLoading || !chatInput.trim()} style={chatLoading || !chatInput.trim() ? styles.sendButtonDisabled : styles.sendButton}>Send</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", fontFamily: "'Segoe UI', sans-serif" },
  outerCard: { backgroundColor: "#1e293b", borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "900px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", marginBottom: "24px" },
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
  error: { color: "#f87171", marginTop: "16px", fontSize: "14px" },
  dashboardWrap: { width: "100%", maxWidth: "1200px" },
  summaryBar: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" },
  summaryCard: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px", textAlign: "center" },
  summaryVal: { fontSize: "24px", fontWeight: "700", color: "#f8fafc" },
  summaryLbl: { fontSize: "12px", color: "#64748b", marginTop: "4px" },
  layout: { display: "grid", gap: "16px", alignItems: "start" },
  mainCol: { minWidth: 0 },
  actionRow: { display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" },
  exportButton: { padding: "12px 16px", backgroundColor: "#0f172a", color: "#6366f1", border: "2px solid #6366f1", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  exportButtonDisabled: { padding: "12px 16px", backgroundColor: "#0f172a", color: "#334155", border: "2px solid #334155", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "not-allowed" },
  exportModelButton: { padding: "12px 16px", backgroundColor: "#0f172a", color: "#4ade80", border: "2px solid #4ade80", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  toggleChatButton: { padding: "12px 16px", backgroundColor: "#0f172a", color: "#94a3b8", border: "2px solid #334155", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginLeft: "auto" },
  tabs: { display: "flex", gap: "4px", marginBottom: "16px", borderBottom: "1px solid #334155", flexWrap: "wrap" },
  tab: { padding: "10px 16px", fontSize: "13px", cursor: "pointer", border: "none", background: "none", color: "#64748b", borderBottom: "2px solid transparent", marginBottom: "-1px", fontWeight: "500" },
  tabActive: { padding: "10px 16px", fontSize: "13px", cursor: "pointer", border: "none", background: "none", color: "#f8fafc", borderBottom: "2px solid #6366f1", marginBottom: "-1px", fontWeight: "600" },
  markdownBody: { color: "#94a3b8", fontSize: "14px", lineHeight: "1.8" },
  chart: { width: "100%", borderRadius: "8px", marginTop: "8px", marginBottom: "16px", border: "1px solid #334155" },
  executiveCard: { marginBottom: "16px", backgroundColor: "#0f172a", borderRadius: "12px", padding: "24px", border: "2px solid #4ade80" },
  executiveHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  executiveTitle: { color: "#4ade80", fontSize: "18px", marginBottom: "0px", fontWeight: "600" },
  execCopyButton: { padding: "6px 12px", backgroundColor: "#1e293b", color: "#4ade80", border: "1px solid #4ade80", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "500" },
  copyButton: { padding: "4px 10px", backgroundColor: "#1e293b", color: "#6366f1", border: "1px solid #6366f1", borderRadius: "8px", fontSize: "11px", cursor: "pointer", fontWeight: "500" },
  roiChartsSection: { marginBottom: "16px" },
  roiChartsTitle: { color: "#cbd5e1", fontSize: "15px", fontWeight: "600", marginBottom: "12px" },
  monteCarloSection: { marginBottom: "16px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "20px" },
  monteCarloStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" },
  mcStat: { backgroundColor: "#1e293b", borderRadius: "8px", padding: "14px", textAlign: "center", border: "1px solid #334155" },
  mcStatHighlight: { border: "2px solid #4ade80" },
  mcStatVal: { fontSize: "20px", fontWeight: "700", color: "#f8fafc" },
  mcStatLbl: { fontSize: "11px", color: "#94a3b8", marginTop: "4px" },
  mcProbBox: { backgroundColor: "#1e3a5f", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" },
  mcProbText: { fontSize: "13px", color: "#93c5fd", margin: "4px 0" },
  chatPanel: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", display: "flex", flexDirection: "column", height: "640px", position: "sticky", top: "20px" },
  chatHeader: { padding: "14px 16px", borderBottom: "1px solid #334155", fontSize: "14px", fontWeight: "600", color: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" },
  chatCloseButton: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px", padding: "0 4px" },
  chatMessages: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" },
  chatEmpty: { color: "#64748b", fontSize: "13px", fontStyle: "italic" },
  userBubble: { backgroundColor: "#334155", borderRadius: "12px", padding: "10px 14px", alignSelf: "flex-end", maxWidth: "92%", marginLeft: "auto" },
  agentBubble: { backgroundColor: "#0f172a", borderRadius: "12px", padding: "10px 14px", border: "1px solid #334155", maxWidth: "95%" },
  bubbleLabel: { fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: "600", textTransform: "uppercase" },
  thinking: { color: "#64748b", fontSize: "13px", fontStyle: "italic", margin: 0 },
  chatInputRow: { display: "flex", gap: "8px", padding: "12px", borderTop: "1px solid #334155" },
  chatInput: { flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "#f8fafc", fontSize: "13px" },
  sendButton: { padding: "10px 16px", backgroundColor: "#6366f1", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  sendButtonDisabled: { padding: "10px 16px", backgroundColor: "#334155", color: "#64748b", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "not-allowed" },
  suggestedPrompts: { marginTop: "10px" },
  suggestedLabel: { color: "#64748b", fontSize: "12px", marginBottom: "8px" },
  promptButtons: { display: "flex", flexWrap: "wrap", gap: "8px" },
  promptButton: { padding: "6px 12px", backgroundColor: "#0f172a", color: "#6366f1", border: "1px solid #6366f1", borderRadius: "20px", fontSize: "12px", cursor: "pointer", fontWeight: "500" },
};