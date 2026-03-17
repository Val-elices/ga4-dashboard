import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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
      <polygon points={`0,${height} ${points.join(" ")} ${width},${height}`} fill={`url(#spark-${color.replace("#", "")})`} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chart({ data, clients, hoveredClient, showIndividual }) {
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
  const maxVal = Math.max(...data.map((d) => d.total)) * 1.1 || 100;
  const minVal = 0;
  const xScale = (i) => padL + (i / (data.length - 1 || 1)) * chartW;
  const yScale = (v) => padT + chartH - ((v - minVal) / (maxVal - minVal || 1)) * chartH;
  const totalLine = data.map((d, i) => `${xScale(i)},${yScale(d.total)}`).join(" ");

  const clientLines = clients.map((c, ci) => ({
    ...c, color: PALETTE[ci % PALETTE.length],
    points: data.map((d, i) => `${xScale(i)},${yScale(d[c.id] || 0)}`).join(" "),
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
    if (idx >= 0 && idx < data.length) setTooltip({ idx, x: xScale(idx), y: e.clientY - rect.top });
  };

  const labelInterval = Math.ceil(data.length / 10);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg width={dims.w} height={dims.h} style={{ display: "block", cursor: "crosshair" }} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        {grids.map((g, i) => (
          <g key={i}>
            <line x1={padL} y1={g.y} x2={dims.w - padR} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 8} y={g.y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="'DM Sans',sans-serif">{g.label}</text>
          </g>
        ))}
        {data.map((d, i) => i % labelInterval === 0 ? (
          <text key={i} x={xScale(i)} y={dims.h - 12} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="'DM Sans',sans-serif">
            {new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
          </text>
        ) : null)}
        {showIndividual && clientLines.map((cl) => (
          <polyline key={cl.id} points={cl.points} fill="none" stroke={cl.color}
            strokeWidth={hoveredClient === cl.id ? "2.5" : "1.5"} strokeLinecap="round" strokeLinejoin="round"
            opacity={hoveredClient && hoveredClient !== cl.id ? 0.15 : 0.6} />
        ))}
        <defs>
          <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${xScale(0)},${yScale(0)} ${totalLine} ${xScale(data.length - 1)},${yScale(0)}`} fill="url(#totalGrad)" />
        <polyline points={totalLine} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={padT} x2={tooltip.x} y2={padT + chartH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4,4" />
            <circle cx={tooltip.x} cy={yScale(data[tooltip.idx].total)} r="5" fill="#818cf8" stroke="#1a1a2e" strokeWidth="2" />
          </g>
        )}
      </svg>
      {tooltip && (
        <div style={{ position: "absolute", left: Math.min(tooltip.x + 12, dims.w - 200), top: 30, background: "rgba(15,15,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", zIndex: 10, backdropFilter: "blur(12px)", minWidth: 170 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{data[tooltip.idx].date}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#818cf8", marginBottom: 6 }}>{formatEur(data[tooltip.idx].total)}</div>
          {clients.map((c, ci) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.55)", padding: "1px 0" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: PALETTE[ci % PALETTE.length], display: "inline-block" }} />
                {c.name}
              </span>
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{formatEur(data[tooltip.idx][c.id] || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════════════════════
export default function GA4Dashboard() {
	const [customRange, setCustomRange] = useState(null);
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState([]);
  const [clients, setClients] = useState([]);
  const [hoveredClient, setHoveredClient] = useState(null);
  const [showIndividual, setShowIndividual] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [auth, setAuth] = useState({ authenticated: false, email: null, checking: true });

  // Vérifier si l'utilisateur est connecté
  useEffect(() => {
    fetch(`${API_URL}/auth/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setAuth({ ...data, checking: false }))
      .catch(() => setAuth({ authenticated: false, email: null, checking: false }));
  }, []);

  // Vérifier les params URL après callback OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      setAuth((prev) => ({ ...prev, authenticated: true, checking: true }));
      // Re-check le statut
      fetch(`${API_URL}/auth/status`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => setAuth({ ...data, checking: false }));
      // Nettoyer l'URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("error")) {
      setError(`Erreur d'authentification : ${params.get("error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Charger les données quand connecté
  const fetchData = useCallback(async () => {
    if (!auth.authenticated) return;
    setLoading(true);
    setError(null);
    try {
     const url = customRange
	  ? `${API_URL}/api/revenue?startDate=${customRange.start}&endDate=${customRange.end}`
	  : `${API_URL}/api/revenue?days=${period}`;
		const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) {
        setAuth({ authenticated: false, email: null, checking: false });
        setError("Session expirée. Reconnectez-vous.");
        return;
      }
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Erreur inconnue");

      setClients(
        json.clients.map((c, i) => ({
          id: c.id, name: c.name, property: `GA4-${c.propertyId}`,
          totalRevenue: c.totalRevenue, totalTransactions: c.totalTransactions,
          dailyRevenue: c.dailyRevenue, color: PALETTE[i % PALETTE.length],
        }))
      );
      setData(json.dailyData);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, auth.authenticated, customRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/login`;
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, { credentials: "include" });
    setAuth({ authenticated: false, email: null, checking: false });
    setData([]);
    setClients([]);
  };

  const totalRevenue = clients.reduce((s, c) => s + c.totalRevenue, 0);
  const prevHalf = data.slice(0, Math.floor(data.length / 2));
  const currHalf = data.slice(Math.floor(data.length / 2));
  const prevAvg = prevHalf.reduce((s, d) => s + d.total, 0) / (prevHalf.length || 1);
  const currAvg = currHalf.reduce((s, d) => s + d.total, 0) / (currHalf.length || 1);
  const trend = prevAvg > 0 ? ((currAvg - prevAvg) / prevAvg) * 100 : 0;
  const clientStats = clients.map((c) => ({ ...c, pct: totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0 }));

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#e2e2f0", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
	<style>{`
	  * { margin: 0; padding: 0; box-sizing: border-box; }
	  html, body, #root { width: 100%; min-height: 100vh; overflow-x: hidden; }
	`}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #12122a 0%, #1a1040 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>R</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Revenue TOTAL cumulé</h1>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            Multi-propriété GA4
            {auth.authenticated && <span style={{ color: "#6ee7b7", marginLeft: 8 }}>● {auth.email}</span>}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
		  {auth.authenticated && (
			<>
			  <button onClick={fetchData} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>
				↻ Refresh
			  </button>
			  {[{label: "30j", days: 30}, {label: "60j", days: 60}, {label: "90j", days: 90}, {label: "6 mois", days: 180}, {label: "12 mois", days: 365}].map((p) => (
				<button key={p.days} onClick={() => { setPeriod(p.days); setCustomRange(null); }} style={{
				  padding: "6px 14px", borderRadius: 8, border: "1px solid",
				  borderColor: period === p.days && !customRange ? "#6366f1" : "rgba(255,255,255,0.08)",
				  background: period === p.days && !customRange ? "rgba(99,102,241,0.15)" : "transparent",
				  color: period === p.days && !customRange ? "#a5b4fc" : "rgba(255,255,255,0.4)",
				  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
				}}>{p.label}</button>
			  ))}
			  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
				<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
				  style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e2f0", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
				<span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>→</span>
				<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
				  style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#e2e2f0", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
				<button onClick={() => { if (startDate && endDate) setCustomRange({ start: startDate, end: endDate }); }}
				  style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid",
					borderColor: customRange ? "#6366f1" : "rgba(255,255,255,0.08)",
					background: customRange ? "rgba(99,102,241,0.15)" : "transparent",
					color: customRange ? "#a5b4fc" : "rgba(255,255,255,0.4)",
					fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
				  OK
				</button>
			  </div>
			  <button onClick={handleLogout} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "#fca5a5", fontSize: 11, cursor: "pointer", marginLeft: 4 }}>
				Déconnexion
			  </button>
			</>
		  )}
		</div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ─── Login Screen ─── */}
        {!auth.authenticated && !auth.checking && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700 }}>R</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, textAlign: "center" }}>Connectez votre compte Google</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0, textAlign: "center", maxWidth: 400 }}>
              Utilisez le compte Google qui a accès à vos propriétés GA4. Aucun service account nécessaire.
            </p>
            <button
              onClick={handleLogin}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 32px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "linear-gradient(135deg, #1a1a2e, #12122a)",
                color: "#e2e2f0", fontSize: 15, fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "rgba(99,102,241,0.08)"; }}
              onMouseLeave={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "linear-gradient(135deg, #1a1a2e, #12122a)"; }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Se connecter avec Google
            </button>
            {error && (
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#fca5a5", maxWidth: 400, textAlign: "center" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* ─── Checking auth ─── */}
        {auth.checking && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.3)" }}>
            Vérification de la connexion...
          </div>
        )}

        {/* ─── Dashboard ─── */}
        {auth.authenticated && !auth.checking && (
          <>
            {error && (
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: "#fca5a5" }}>
                <b>Erreur :</b> {error}
              </div>
            )}

            {loading && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)" }}>
                <div style={{ fontSize: 24, marginBottom: 12, animation: "spin 1s linear infinite" }}>⟳</div>
                Chargement des données GA4...
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {!loading && (
              <>
                {/* KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                  <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(129,140,248,0.06))", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, padding: "20px 22px" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Revenu cumulé</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#a5b4fc", letterSpacing: "-0.02em" }}>{formatEur(totalRevenue)}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: trend >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: 600 }}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs période préc.</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 22px" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Moyenne / jour</div>
                    <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{formatEur(totalRevenue / (data.length || 1))}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: "rgba(255,255,255,0.3)" }}>{data.length} jours</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 22px" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Propriétés GA4</div>
                    <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{clients.length}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: "#6ee7b7" }}>API connectée</div>
                  </div>
                </div>

                {/* Chart */}
                {data.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 20px 12px", marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Évolution du revenu cumulé</h3>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                        <input type="checkbox" checked={showIndividual} onChange={(e) => setShowIndividual(e.target.checked)} style={{ accentColor: "#6366f1" }} />
                        Détail par client
                      </label>
                    </div>
                    <Chart data={data} clients={clients} hoveredClient={hoveredClient} showIndividual={showIndividual} />
                  </div>
                )}

                {/* Table */}
                {clientStats.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Détail par propriété</h3>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            {["Client", "Propriété GA4", "Revenu", "Part", "Tendance"].map((h) => (
                              <th key={h} style={{ padding: "10px 16px", textAlign: h === "Revenu" || h === "Part" ? "right" : "left", fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {clientStats.map((c) => (
                            <tr key={c.id} onMouseEnter={() => setHoveredClient(c.id)} onMouseLeave={() => setHoveredClient(null)}
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: hoveredClient === c.id ? "rgba(99,102,241,0.05)" : "transparent", transition: "background 0.2s", cursor: "pointer" }}>
                              <td style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                                <span style={{ fontWeight: 600 }}>{c.name}</span>
                              </td>
                              <td style={{ padding: "12px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{c.property}</td>
                              <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{formatEur(c.totalRevenue)}</td>
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                                  <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                    <div style={{ width: `${c.pct}%`, height: "100%", borderRadius: 3, background: c.color, transition: "width 0.5s" }} />
                                  </div>
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", minWidth: 38, textAlign: "right" }}>{c.pct.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td style={{ padding: "12px 16px" }}><MiniSparkline data={c.dailyRevenue} color={c.color} /></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "1px solid rgba(99,102,241,0.15)", background: "rgba(99,102,241,0.04)" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "#a5b4fc" }} colSpan={2}>TOTAL CUMULÉ</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#a5b4fc", fontSize: 15 }}>{formatEur(totalRevenue)}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#a5b4fc", fontSize: 12 }}>100%</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
