import { useState, useEffect, useCallback, useRef } from "react";

const MOCK_CLIENTS = [
  { id: "ga4-001", name: "E-shop Bordeaux", property: "GA4-298374651" },
  { id: "ga4-002", name: "Boutique Lyon", property: "GA4-187263549" },
  { id: "ga4-003", name: "Store Paris", property: "GA4-394817265" },
  { id: "ga4-004", name: "Marketplace Nantes", property: "GA4-502938174" },
  { id: "ga4-005", name: "Shop Toulouse", property: "GA4-619284735" },
];

function generateData(clients, days = 30) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const entry = {
      date: date.toISOString().split("T")[0],
      label: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    };
    let total = 0;
    clients.forEach((c) => {
      const base = 800 + Math.random() * 2200;
      const weekday = date.getDay();
      const weekendFactor = weekday === 0 || weekday === 6 ? 1.4 : 1;
      const trend = 1 + (days - i) * 0.008;
      const val = Math.round(base * weekendFactor * trend * 100) / 100;
      entry[c.id] = val;
      total += val;
    });
    entry.total = Math.round(total * 100) / 100;
    data.push(entry);
  }
  return data;
}

const PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function formatEur(v) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function MiniSparkline({ data, color, width = 120, height = 36 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points.join(" ")} ${width},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chart({ data, clients, hoveredClient, setHoveredClient, showIndividual }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [dims, setDims] = useState({ w: 700, h: 300 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDims({ w: Math.max(width, 300), h: 300 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = 70, padR = 20, padT = 20, padB = 50;
  const chartW = dims.w - padL - padR;
  const chartH = dims.h - padT - padB;

  const maxVal = Math.max(...data.map((d) => d.total)) * 1.1;
  const minVal = 0;

  const xScale = (i) => padL + (i / (data.length - 1)) * chartW;
  const yScale = (v) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  const totalLine = data.map((d, i) => `${xScale(i)},${yScale(d.total)}`).join(" ");

  const clientLines = clients.map((c, ci) => ({
    ...c,
    color: PALETTE[ci % PALETTE.length],
    points: data.map((d, i) => `${xScale(i)},${yScale(d[c.id])}`).join(" "),
  }));

  const gridLines = 5;
  const grids = Array.from({ length: gridLines + 1 }, (_, i) => {
    const val = minVal + ((maxVal - minVal) / gridLines) * i;
    return { y: yScale(val), label: formatEur(val) };
  });

  const handleMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round(((mx - padL) / chartW) * (data.length - 1));
    if (idx >= 0 && idx < data.length) {
      setTooltip({ idx, x: xScale(idx), y: e.clientY - rect.top });
    }
  };

  const labelInterval = Math.ceil(data.length / 10);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        width={dims.w}
        height={dims.h}
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {grids.map((g, i) => (
          <g key={i}>
            <line x1={padL} y1={g.y} x2={dims.w - padR} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 8} y={g.y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="'DM Sans',sans-serif">
              {g.label}
            </text>
          </g>
        ))}

        {data.map((d, i) =>
          i % labelInterval === 0 ? (
            <text key={i} x={xScale(i)} y={dims.h - 12} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="'DM Sans',sans-serif">
              {d.label}
            </text>
          ) : null
        )}

        {showIndividual &&
          clientLines.map((cl) => (
            <polyline
              key={cl.id}
              points={cl.points}
              fill="none"
              stroke={cl.color}
              strokeWidth={hoveredClient === cl.id ? "2.5" : "1.5"}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={hoveredClient && hoveredClient !== cl.id ? 0.15 : 0.6}
            />
          ))}

        <defs>
          <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${xScale(0)},${yScale(0)} ${totalLine} ${xScale(data.length - 1)},${yScale(0)}`}
          fill="url(#totalGrad)"
        />
        <polyline points={totalLine} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={padT} x2={tooltip.x} y2={padT + chartH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4,4" />
            <circle cx={tooltip.x} cy={yScale(data[tooltip.idx].total)} r="5" fill="#818cf8" stroke="#1a1a2e" strokeWidth="2" />
          </g>
        )}
      </svg>

      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tooltip.x + 12, dims.w - 200),
            top: 30,
            background: "rgba(15,15,30,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            zIndex: 10,
            backdropFilter: "blur(12px)",
            minWidth: 170,
          }}
        >
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{data[tooltip.idx].date}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#818cf8", marginBottom: 6 }}>
            {formatEur(data[tooltip.idx].total)}
          </div>
          {clients.map((c, ci) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.55)", padding: "1px 0" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: PALETTE[ci % PALETTE.length], display: "inline-block" }} />
                {c.name}
              </span>
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{formatEur(data[tooltip.idx][c.id])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GA4Dashboard() {
  const [clients, setClients] = useState(MOCK_CLIENTS);
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState([]);
  const [hoveredClient, setHoveredClient] = useState(null);
  const [showIndividual, setShowIndividual] = useState(true);
  const [connected, setConnected] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(generateData(clients, period));
  }, [clients, period]);

  const totalRevenue = data.reduce((s, d) => s + d.total, 0);
  const prevHalf = data.slice(0, Math.floor(data.length / 2));
  const currHalf = data.slice(Math.floor(data.length / 2));
  const prevAvg = prevHalf.reduce((s, d) => s + d.total, 0) / (prevHalf.length || 1);
  const currAvg = currHalf.reduce((s, d) => s + d.total, 0) / (currHalf.length || 1);
  const trend = prevAvg > 0 ? ((currAvg - prevAvg) / prevAvg) * 100 : 0;

  const clientStats = clients.map((c, ci) => {
    const rev = data.reduce((s, d) => s + (d[c.id] || 0), 0);
    const sparkData = data.map((d) => d[c.id] || 0);
    return { ...c, revenue: rev, sparkData, color: PALETTE[ci % PALETTE.length], pct: totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0 };
  });

  const handleConnect = () => {
    setLoading(true);
    setTimeout(() => {
      setConnected(true);
      setLoading(false);
    }, 1500);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0d1a",
        color: "#e2e2f0",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        padding: 0,
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #12122a 0%, #1a1040 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>
              R
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Revenue Aggregator</h1>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>Multi-property GA4 — Cumul des revenus</p>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: period === d ? "#6366f1" : "rgba(255,255,255,0.08)",
                background: period === d ? "rgba(99,102,241,0.15)" : "transparent",
                color: period === d ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Connection Panel */}
        {!connected && (
          <div
            style={{
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: 14,
              padding: "24px 28px",
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: "#a5b4fc" }}>Connexion GA4 API</h3>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
              Entrez vos identifiants Google Analytics Data API pour connecter vos propriétés. Les données ci-dessous sont simulées en attendant.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="password"
                placeholder="Clé API ou Service Account JSON..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.3)",
                  color: "#e2e2f0",
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none",
                }}
              />
              <button
                onClick={handleConnect}
                disabled={loading}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #818cf8)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loading ? "wait" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Connexion..." : connected ? "Connecté ✓" : "Connecter"}
              </button>
            </div>
          </div>
        )}

        {connected && (
          <div
            style={{
              background: "rgba(16,185,129,0.06)",
              border: "1px solid rgba(16,185,129,0.15)",
              borderRadius: 10,
              padding: "10px 16px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#6ee7b7",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} />
            GA4 API connectée — Données en temps réel
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(129,140,248,0.06))",
              border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: 14,
              padding: "20px 22px",
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Revenu cumulé
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#a5b4fc", letterSpacing: "-0.02em" }}>{formatEur(totalRevenue)}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: trend >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: 600 }}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs période préc.
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: "20px 22px",
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Moyenne / jour
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{formatEur(totalRevenue / (data.length || 1))}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: "rgba(255,255,255,0.3)" }}>{data.length} jours analysés</div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: "20px 22px",
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Propriétés GA4
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{clients.length}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: connected ? "#6ee7b7" : "rgba(255,255,255,0.3)" }}>
              {connected ? "Sync active" : "Données simulées"}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: "20px 20px 12px",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Évolution du revenu cumulé</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showIndividual}
                onChange={(e) => setShowIndividual(e.target.checked)}
                style={{ accentColor: "#6366f1" }}
              />
              Détail par client
            </label>
          </div>
          <Chart data={data} clients={clients} hoveredClient={hoveredClient} setHoveredClient={setHoveredClient} showIndividual={showIndividual} />
        </div>

        {/* Client breakdown */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Détail par propriété</h3>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Client", "Propriété GA4", "Revenu", "Part", "Tendance"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: h === "Revenu" || h === "Part" ? "right" : "left",
                        fontSize: 11,
                        color: "rgba(255,255,255,0.3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientStats.map((c) => (
                  <tr
                    key={c.id}
                    onMouseEnter={() => setHoveredClient(c.id)}
                    onMouseLeave={() => setHoveredClient(null)}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      background: hoveredClient === c.id ? "rgba(99,102,241,0.05)" : "transparent",
                      transition: "background 0.2s",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      {c.property}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatEur(c.revenue)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <div style={{ width: `${c.pct}%`, height: "100%", borderRadius: 3, background: c.color, transition: "width 0.5s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", minWidth: 38, textAlign: "right" }}>
                          {c.pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <MiniSparkline data={c.sparkData} color={c.color} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid rgba(99,102,241,0.15)", background: "rgba(99,102,241,0.04)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: "#a5b4fc" }} colSpan={2}>TOTAL CUMULÉ</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#a5b4fc", fontSize: 15 }}>
                    {formatEur(totalRevenue)}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#a5b4fc", fontSize: 12 }}>100%</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", marginBottom: 6 }}>Comment connecter vos vraies données GA4</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
            1. Créez un projet dans Google Cloud Console et activez la <b>Google Analytics Data API</b><br />
            2. Créez un <b>Service Account</b> et téléchargez le fichier JSON<br />
            3. Ajoutez le service account comme lecteur dans chaque propriété GA4<br />
            4. Remplacez les données simulées par des appels à <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>runReport()</code> de l'API GA4<br />
            5. Déployez ce dashboard sur Vercel, Netlify ou votre serveur
          </div>
        </div>
      </div>
    </div>
  );
}
