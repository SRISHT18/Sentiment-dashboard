import { useState, useRef, useCallback } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SAMPLE = [
  "The product exceeded all my expectations — absolutely love it!",
  "Delivery was extremely slow and customer support completely ignored me.",
  "It's okay, nothing special but does the job.",
  "Absolutely love the new update, the app is so smooth now!",
  "Terrible quality. Fell apart after just one week of use.",
  "Customer service was helpful and resolved my issue quickly.",
  "Not impressed. The packaging was damaged and one item was missing.",
  "Works as described, decent value for money.",
  "Exceeded expectations! Will definitely order again.",
  "Waited 3 weeks for delivery. Very disappointed.",
  "Pretty good overall, minor issues but nothing major.",
  "Best purchase I've made this year, highly recommend!",
].join("\n");

const COLORS = { Positive: "#34d399", Negative: "#f87171", Neutral: "#94a3b8" };
const BG = { Positive: "#064e3b22", Negative: "#7f1d1d22", Neutral: "#1e293b44" };

// ── Pipeline step indicator ──────────────────────────────────────────────────
const STEPS = ["Upload", "Clean", "Analyze", "Count", "Dashboard", "Export"];

function Pipeline({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28, overflowX: "auto", paddingBottom: 4 }}>
      {STEPS.map((s, i) => (
        <span key={s} style={{ display: "flex", alignItems: "center" }}>
          <span style={{
            fontSize: 11, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
            background: i < active ? "#064e3b" : i === active ? "#1d4ed8" : "#1e293b",
            color: i < active ? "#34d399" : i === active ? "#93c5fd" : "#64748b",
            fontWeight: i === active ? 600 : 400,
            border: `1px solid ${i < active ? "#065f46" : i === active ? "#2563eb" : "#334155"}`,
          }}>
            {i < active ? "✓ " : ""}{s}
          </span>
          {i < STEPS.length - 1 && <span style={{ color: "#334155", margin: "0 4px", fontSize: 10 }}>›</span>}
        </span>
      ))}
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: "#1a1d27", border: "1px solid #1e293b", borderRadius: 12,
      padding: "16px 20px", flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "#e2e8f0" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
function Badge({ sentiment }) {
  const icons = { Positive: "😊", Negative: "😞", Neutral: "😐" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: BG[sentiment], color: COLORS[sentiment],
      border: `1px solid ${COLORS[sentiment]}33`,
      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
    }}>
      {icons[sentiment]} {sentiment}
    </span>
  );
}

// ── Confidence bar ───────────────────────────────────────────────────────────
function ConfBar({ value, sentiment }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{Math.round(value * 100)}%</div>
      <div style={{ height: 4, background: "#1e293b", borderRadius: 2, width: 80 }}>
        <div style={{ height: "100%", width: `${value * 100}%`, background: COLORS[sentiment], borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const reset = () => { setData(null); setStep(0); setError(""); setProgress(0); };

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith(".csv")) { setError("Please upload a .csv file."); return; }
    setLoading(true); setError(""); setStep(1);
    simulateProgress();
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/upload-csv`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).detail);
      const json = await res.json();
      finishLoad(json);
    } catch (e) { setError(e.message); setLoading(false); setStep(0); }
  }, []);

  const simulateProgress = () => {
    setProgress(10);
    const id = setInterval(() => setProgress(p => p < 85 ? p + 5 : p), 300);
    return () => clearInterval(id);
  };

  const finishLoad = (json) => {
    setProgress(100);
    setTimeout(() => { setData(json); setStep(5); setLoading(false); setProgress(0); }, 400);
  };

  const handleAnalyze = async () => {
    const lines = pasteText.split("\n").map(l => l.trim()).filter(l => l.length > 2);
    if (!lines.length) { setError("Enter at least one feedback line."); return; }
    setLoading(true); setError(""); setStep(1);
    simulateProgress();
    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: lines }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const json = await res.json();
      finishLoad(json);
    } catch (e) { setError(e.message); setLoading(false); setStep(0); }
  };

  const handleExport = async () => {
    if (!data) return;
    const texts = data.results.map(r => r.original_text);
    const res = await fetch(`${API}/export-csv`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sentiment_report.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const doughnutData = data && {
    labels: ["Positive", "Negative", "Neutral"],
    datasets: [{
      data: [data.positive, data.negative, data.neutral],
      backgroundColor: ["#34d399", "#f87171", "#94a3b8"],
      borderWidth: 0, hoverOffset: 6,
    }],
  };

  const barData = data && {
    labels: data.results.map((_, i) => `#${i + 1}`),
    datasets: [{
      label: "Confidence %",
      data: data.results.map(r => Math.round(r.confidence * 100)),
      backgroundColor: data.results.map(r => COLORS[r.sentiment] + "cc"),
      borderRadius: 4, barPercentage: 0.7,
    }],
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, background: "#1d4ed8", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📊</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Sentiment Analysis Dashboard</h1>
        </div>
        <p style={{ fontSize: 13, color: "#64748b" }}>Upload a CSV or paste customer feedback — classify as Positive, Negative, or Neutral using DistilBERT</p>
      </div>

      <Pipeline active={step} />

      {/* Input section */}
      {!data && (
        <div style={{ marginBottom: 28 }}>
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            style={{
              border: "1px dashed #334155", borderRadius: 12, padding: "32px 24px",
              textAlign: "center", cursor: "pointer", marginBottom: 16,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#1a1d27"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <p style={{ fontSize: 14, color: "#94a3b8" }}>Drop a CSV file here or click to browse</p>
            <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Needs a column named: feedback, text, review, or comment</p>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          </div>

          <div style={{ textAlign: "center", color: "#334155", fontSize: 12, marginBottom: 16 }}>— or paste directly —</div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>One entry per line:</label>
            <textarea
              rows={7}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"The product exceeded all my expectations!\nDelivery was extremely slow...\nIt's okay, nothing special."}
              style={{
                width: "100%", background: "#1a1d27", border: "1px solid #1e293b",
                borderRadius: 10, padding: "12px 14px", color: "#e2e8f0",
                fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none",
              }}
            />
          </div>

          {error && <div style={{ background: "#7f1d1d22", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={handleAnalyze} disabled={loading} style={btnStyle("#1d4ed8", "#fff")}>
              {loading ? "⏳ Analyzing..." : "✨ Analyze sentiment"}
            </button>
            <button onClick={() => setPasteText(SAMPLE)} style={btnStyle("#1e293b", "#94a3b8")}>💡 Load sample data</button>
            <button onClick={() => { setPasteText(""); setError(""); }} style={btnStyle("#1e293b", "#94a3b8")}>🗑 Clear</button>
          </div>

          {loading && (
            <div style={{ marginTop: 16, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#3b82f6", transition: "width 0.3s", borderRadius: 2 }} />
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Metrics */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <MetricCard label="Total entries" value={data.total} />
            <MetricCard label="Positive" value={data.positive} color="#34d399" sub={`${data.positive_pct}%`} />
            <MetricCard label="Negative" value={data.negative} color="#f87171" sub={`${data.negative_pct}%`} />
            <MetricCard label="Neutral" value={data.neutral} color="#94a3b8" sub={`${data.neutral_pct}%`} />
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={cardTitle}>Sentiment distribution</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                {["Positive","Negative","Neutral"].map(s => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS[s] }} />{s}
                  </span>
                ))}
              </div>
              <div style={{ position: "relative", height: 200 }}>
                <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: "65%" }} />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={cardTitle}>Confidence per entry</div>
              <div style={{ position: "relative", height: 220 }}>
                <Bar data={barData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { min: 0, max: 100, ticks: { callback: v => v + "%", color: "#475569", font: { size: 10 } }, grid: { color: "#1e293b" } },
                    x: { ticks: { color: "#475569", font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } },
                  },
                }} />
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, marginBottom: 20, overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e293b" }}>
              <span style={cardTitle}>All results</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#0f1117" }}>
                    {["#", "Feedback", "Cleaned text", "Sentiment", "Confidence"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "#475569", fontWeight: 500, borderBottom: "1px solid #1e293b", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.results.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #1e293b" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1a1d27"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 14px", color: "#475569", minWidth: 30 }}>{r.id}</td>
                      <td style={{ padding: "10px 14px", maxWidth: 260, color: "#cbd5e1" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.original_text}>{r.original_text}</div>
                      </td>
                      <td style={{ padding: "10px 14px", maxWidth: 240, color: "#64748b" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.cleaned_text}>{r.cleaned_text}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}><Badge sentiment={r.sentiment} /></td>
                      <td style={{ padding: "10px 14px" }}><ConfBar value={r.confidence} sentiment={r.sentiment} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={handleExport} style={btnStyle("#065f46", "#34d399")}>⬇ Export CSV report</button>
            <button onClick={reset} style={btnStyle("#1e293b", "#94a3b8")}>🔄 New analysis</button>
          </div>
        </>
      )}
    </div>
  );
}

const btnStyle = (bg, color) => ({
  background: bg, color, border: "none", padding: "9px 18px",
  borderRadius: 8, fontSize: 13, fontFamily: "inherit",
  cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
});

const cardStyle = {
  background: "#1a1d27", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 20px",
};

const cardTitle = { fontSize: 13, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 12 };
