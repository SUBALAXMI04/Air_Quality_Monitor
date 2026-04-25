import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── AQI helpers ────────────────────────────────────────────────────────────
const AQI_LEVELS = [
  { max: 50,  label: "Good",                          color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" },
  { max: 100, label: "Moderate",                      color: "#eab308", bg: "#fefce8", border: "#fde68a" },
  { max: 150, label: "Unhealthy for Sensitive Groups",color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
  { max: 200, label: "Unhealthy",                     color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  { max: 300, label: "Very Unhealthy",                color: "#a855f7", bg: "#faf5ff", border: "#e9d5ff" },
  { max: 9999,label: "Hazardous",                     color: "#9f1239", bg: "#fff1f2", border: "#fecdd3" },
];
function getAQILevel(val) {
  return AQI_LEVELS.find((l) => val <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

// ─── Simulated live data ─────────────────────────────────────────────────────
const MAX_POINTS = 20;
const TIME_PROFILES = [
  { name: "Night",     start: 0,  end: 6,  values: { pm25: 18, co: 6.5, temp: 22.5, hum: 74 } },
  { name: "Morning",   start: 6,  end: 12, values: { pm25: 36, co: 14,  temp: 26.0, hum: 62 } },
  { name: "Afternoon", start: 12, end: 18, values: { pm25: 58, co: 28,  temp: 31.5, hum: 48 } },
  { name: "Evening",   start: 18, end: 24, values: { pm25: 72, co: 38,  temp: 27.5, hum: 58 } },
];

function getProfileByTime(date) {
  const hour = date.getHours();
  return TIME_PROFILES.find((p) => hour >= p.start && hour < p.end) || TIME_PROFILES[0];
}

function initSeriesFromValue(value, amplitude) {
  return Array.from({ length: MAX_POINTS }, (_, i) => ({
    t: i,
    v: +(value + Math.sin(i / 2.8) * amplitude).toFixed(2),
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Badge({ color, bg, border, children }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 600,
      color, background: bg, border: `1px solid ${border}`,
      borderRadius: 20, padding: "2px 10px", lineHeight: 1.6,
    }}>
      {children}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "#94a3b8", marginBottom: 14,
    }}>
      {children}
    </p>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)",
      padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

// ─── AQI Ring ─────────────────────────────────────────────────────────────────
function AQIRing({ value, level }) {
  const r = 52, circ = 2 * Math.PI * r;
  const pct = Math.min(value / 300, 1);
  return (
    <svg width={130} height={130} viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={r} fill="none" stroke="#f1f5f9" strokeWidth={10} />
      <circle cx={65} cy={65} r={r} fill="none"
        stroke={level.color} strokeWidth={10}
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round" transform="rotate(-90 65 65)"
        style={{ transition: "stroke-dasharray 0.7s ease, stroke 0.7s ease" }}
      />
      <text x={65} y={60} textAnchor="middle" fontSize={26} fontWeight={700}
        fill={level.color} fontFamily="Nunito, sans-serif"
        style={{ transition: "fill 0.5s" }}>{Math.round(value)}</text>
      <text x={65} y={78} textAnchor="middle" fontSize={10} fill="#94a3b8"
        fontFamily="Nunito, sans-serif">AQI</text>
    </svg>
  );
}

// ─── Sensor tile ─────────────────────────────────────────────────────────────
function SensorTile({ label, value, unit, color, icon, alert }) {
  return (
    <div style={{
      background: alert ? "#fef2f2" : "#f8fafc",
      border: `1.5px solid ${alert ? "#fecaca" : "#e2e8f0"}`,
      borderRadius: 14, padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
      transition: "background 0.4s, border-color 0.4s",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: alert ? "#fee2e2" : `${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: alert ? "#ef4444" : "#1e293b", lineHeight: 1.1 }}>
          {value}<span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", marginLeft: 3 }}>{unit}</span>
        </p>
        {alert && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 3, fontWeight: 600 }}>⚠ Exceeds safe limit</p>}
      </div>
    </div>
  );
}

// ─── Custom graph tooltip ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "8px 14px", fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    }}>
      <p style={{ color: "#64748b", marginBottom: 2 }}>t = {label}s</p>
      <p style={{ fontWeight: 700, color: "#1e293b" }}>{payload[0].value} {unit}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const initialProfile = getProfileByTime(new Date());
  const [pm25Series, setPm25Series] = useState(() => initSeriesFromValue(initialProfile.values.pm25, 3.5));
  const [coSeries,   setCoSeries]   = useState(() => initSeriesFromValue(initialProfile.values.co, 2.5));
  const [tempSeries, setTempSeries] = useState(() => initSeriesFromValue(initialProfile.values.temp, 1.2));
  const [humSeries,  setHumSeries]  = useState(() => initSeriesFromValue(initialProfile.values.hum, 2.8));
  const [tick, setTick] = useState(MAX_POINTS);
  const [now, setNow]   = useState(new Date());
  const tickRef = useRef(MAX_POINTS);
  const profileRef = useRef(initialProfile);

  const last = (s) => s[s.length - 1].v;
  const pm25 = last(pm25Series);
  const co   = last(coSeries);
  const temp = last(tempSeries);
  const hum  = last(humSeries);

  // AQI approximation from PM2.5
  const aqi = Math.round(Math.min(300, pm25 * 2.1 + 3));
  const level = getAQILevel(aqi);

  // Alerts
  const alerts = [];
  if (pm25 > 100) alerts.push({ id: "pm25", icon: "🟠", msg: `PM2.5 is ${pm25.toFixed(1)} µg/m³ — exceeds 100 µg/m³ limit`, color: "#f97316", bg: "#fff7ed", border: "#fed7aa" });
  if (co > 50)   alerts.push({ id: "co",   icon: "🔴", msg: `CO is ${co.toFixed(1)} ppm — exceeds 50 ppm limit`,          color: "#ef4444", bg: "#fef2f2", border: "#fecaca" });
  if (aqi > 150) alerts.push({ id: "aqi",  icon: "🟣", msg: `AQI is ${aqi} — ${level.label}`,                             color: level.color, bg: level.bg, border: level.border });

  useEffect(() => {
    const iv = setInterval(() => {
      const nextNow = new Date();
      const profile = getProfileByTime(nextNow);
      const nextTick = tickRef.current + 1;
      tickRef.current = nextTick;
      const phase = nextTick / 3.2;
      const drift = (base, amp) => +(base + Math.sin(phase) * amp).toFixed(1);

      if (profileRef.current.name !== profile.name) {
        profileRef.current = profile;
        setPm25Series(initSeriesFromValue(profile.values.pm25, 3.5));
        setCoSeries(initSeriesFromValue(profile.values.co, 2.5));
        setTempSeries(initSeriesFromValue(profile.values.temp, 1.2));
        setHumSeries(initSeriesFromValue(profile.values.hum, 2.8));
        tickRef.current = MAX_POINTS;
        setTick(MAX_POINTS);
        setNow(nextNow);
        return;
      }

      setTick(nextTick);
      setPm25Series((s) => [...s.slice(1), { t: s[s.length - 1].t + 1, v: drift(profile.values.pm25, 3.5) }]);
      setCoSeries((s)   => [...s.slice(1), { t: s[s.length - 1].t + 1, v: drift(profile.values.co, 2.5) }]);
      setTempSeries((s) => [...s.slice(1), { t: s[s.length - 1].t + 1, v: drift(profile.values.temp, 1.2) }]);
      setHumSeries((s)  => [...s.slice(1), { t: s[s.length - 1].t + 1, v: drift(profile.values.hum, 2.8) }]);
      setNow(nextNow);
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const graphs = [
    { label: "PM2.5 vs Time",       data: pm25Series, color: "#f59e0b", unit: "µg/m³", ref: 100, refLabel: "100 µg/m³" },
    { label: "CO Level vs Time",     data: coSeries,   color: "#a855f7", unit: "ppm",    ref: 50,  refLabel: "50 ppm" },
    { label: "Temperature vs Time",  data: tempSeries, color: "#f97316", unit: "°C",     ref: null },
    { label: "Humidity vs Time",     data: humSeries,  color: "#0ea5e9", unit: "%",      ref: null },
  ];

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block; animation: blink 1.4s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .aqi-table td, .aqi-table th { padding: 7px 14px; }
        @media(max-width: 900px) {
          .top-row { grid-template-columns: 1fr !important; }
          .g2 { grid-template-columns: repeat(2,1fr) !important; }
          .graphs-grid { grid-template-columns: 1fr !important; }
        }
        @media(max-width: 500px) {
          .g2 { grid-template-columns: 1fr !important; }
          .navbar { flex-direction: column !important; align-items: flex-start !important; height: auto !important; padding: 12px 16px !important; gap: 8px; }
          .wrap { padding: 16px 12px !important; }
        }
        .section { margin-bottom: 28px; }
        .graph-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.09) !important; }
        .graph-card { transition: box-shadow 0.2s; }
      `}</style>

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="navbar" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🌬️</div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "-0.01em" }}>Smart Air Quality Dashboard</p>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Node AQM-ALPHA-07 · Real-time monitoring</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
              <span className="live-dot" /> Live
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "5px 14px", fontSize: 13, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────── */}
      <div className="wrap" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── TOP ROW: AQI (left) + Sensors & Alerts (right) ── */}
        <div className="section">
          <div className="top-row" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>

            {/* LEFT: compact AQI panel */}
            <Card style={{ padding: 20 }}>
              <SectionTitle>1 · AQI Status</SectionTitle>
              {/* Ring + badge */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <AQIRing value={aqi} level={level} />
                <Badge color={level.color} bg={level.bg} border={level.border}>{level.label}</Badge>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>Based on PM2.5 readings</p>
              </div>
              {/* Compact color strips */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {AQI_LEVELS.map((l, i) => {
                  const ranges = ["0–50","51–100","101–150","151–200","201–300","301+"];
                  const isActive = level === l;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "5px 10px", borderRadius: 8,
                      background: isActive ? l.bg : "transparent",
                      border: `1px solid ${isActive ? l.border : "transparent"}`,
                      transition: "background 0.4s",
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: isActive ? l.color : "#64748b", fontWeight: isActive ? 700 : 400, flex: 1 }}>{l.label}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>{ranges[i]}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* RIGHT: Sensors stacked above Alerts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Sensor tiles */}
              <div>
                <SectionTitle>2 · Sensor Data Display</SectionTitle>
                <div className="g2" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                  <SensorTile label="Temperature" value={temp.toFixed(1)} unit="°C"    color="#f97316" icon="🌡️" alert={false} />
                  <SensorTile label="Humidity"    value={hum.toFixed(0)}  unit="%"     color="#0ea5e9" icon="💧" alert={false} />
                  <SensorTile label="CO Level"    value={co.toFixed(1)}   unit="ppm"   color="#a855f7" icon="🫧" alert={co > 50} />
                  <SensorTile label="PM2.5"       value={pm25.toFixed(1)} unit="µg/m³" color="#f59e0b" icon="🌫️" alert={pm25 > 100} />
                </div>
              </div>

              {/* Alerts */}
              <div>
                <SectionTitle>4 · Alerts &amp; Notifications</SectionTitle>
                <Card style={{ padding: 0 }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✅</div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>All Clear</p>
                        <p style={{ fontSize: 12, color: "#86efac" }}>All readings within safe limits.</p>
                      </div>
                    </div>
                  ) : (
                    alerts.map((a, i) => (
                      <div key={a.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "14px 18px",
                        borderBottom: i < alerts.length - 1 ? "1px solid #f8fafc" : "none",
                        background: a.bg,
                        borderLeft: `4px solid ${a.color}`,
                        borderRadius: i === 0 ? "16px 16px 0 0" : i === alerts.length - 1 ? "0 0 16px 16px" : 0,
                      }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", border: `1px solid ${a.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                          {a.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 12, color: a.color, marginBottom: 2 }}>Pollution Alert</p>
                          <p style={{ fontSize: 12, color: "#475569" }}>{a.msg}</p>
                        </div>
                        <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", paddingTop: 1 }}>
                          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))
                  )}
                  <div style={{ padding: "10px 18px", borderTop: "1px solid #f1f5f9", background: "#fafafa", borderRadius: "0 0 16px 16px", display: "flex", flexWrap: "wrap", gap: 16 }}>
                    {[{ label:"PM2.5 > 100 µg/m³", color:"#f97316"},{ label:"CO > 50 ppm", color:"#a855f7"},{ label:"AQI > 150", color:"#ef4444"}].map((t) => (
                      <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: t.color }} />
                        <span style={{ fontSize: 11, color: "#64748b" }}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

            </div>
          </div>
        </div>

        {/* ── SECTION 3: GRAPHS ──────────────────────────────── */}
        <div className="section">
          <SectionTitle>3 · Line Graph Visualization</SectionTitle>
          <div className="graphs-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {graphs.map((g) => (
              <Card key={g.label} className="graph-card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>{g.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>
                      {g.data[g.data.length - 1].v} <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{g.unit}</span>
                    </span>
                    {g.ref && g.data[g.data.length-1].v > g.ref && (
                      <span style={{ fontSize: 11, background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 20, padding: "1px 8px", fontWeight: 600 }}>⚠ Over limit</span>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={g.data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<CustomTooltip unit={g.unit} />} />
                    {g.ref && (
                      <ReferenceLine y={g.ref} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
                        label={{ value: g.refLabel, position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
                    )}
                    <Line
                      type="monotone" dataKey="v" stroke={g.color} strokeWidth={2.5}
                      dot={false} activeDot={{ r: 5, fill: g.color, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 6 }}>Last {MAX_POINTS} readings · updates every 2s</p>
              </Card>
            ))}
          </div>
        </div>



      </div>
    </div>
  );
}

