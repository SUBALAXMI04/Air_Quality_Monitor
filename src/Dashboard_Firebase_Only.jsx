import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

// CUSTOM HARDWARE DASHBOARD (BME688, PMS5003, SCD40, ZE07-CO)

// AQI helpers
const AQI_LEVELS = [
  { max: 50, label: "Good", color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" },
  { max: 100, label: "Moderate", color: "#eab308", bg: "#fefce8", border: "#fde68a" },
  { max: 150, label: "Unhealthy for Sensitive Groups", color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
  { max: 200, label: "Unhealthy", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  { max: 300, label: "Very Unhealthy", color: "#a855f7", bg: "#faf5ff", border: "#e9d5ff" },
  { max: 9999, label: "Hazardous", color: "#9f1239", bg: "#fff1f2", border: "#fecdd3" },
];

function getAQILevel(val) {
  return AQI_LEVELS.find((l) => val <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAqLwgpkEBubO9ExkpSN6mivSmO6tympTk",
  authDomain: "aqi-moitor.firebaseapp.com",
  projectId: "aqi-moitor",
  storageBucket: "aqi-moitor.firebasestorage.app",
  messagingSenderId: "1006432231718",
  appId: "1:1006432231718:web:17ac6cdbaa7045d9e1a1e7",
  measurementId: "G-VSQWG6FN3P",
  databaseURL: "https://aqi-moitor-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Data series management
const MAX_POINTS = 20;

function initSeries() {
  return [{ t: 0, v: 0 }];
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildSeriesFromHistory(historyObj, field) {
  if (!historyObj || typeof historyObj !== "object") return initSeries();

  const sortedEntries = Object.entries(historyObj).sort(
    ([a], [b]) => Number(a) - Number(b)
  );

  const series = sortedEntries.map(([, row], index) => ({
    t: index,
    v: toNum(row?.[field]),
  }));

  const trimmed = series.slice(-MAX_POINTS);
  return trimmed.length ? trimmed : initSeries();
}

// Helpers
function Badge({ color, bg, border, children }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 20,
        padding: "2px 10px",
        lineHeight: 1.6,
      }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#94a3b8",
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  );
}

function Card({ children, style = {}, className = "" }) {
  return (
    <div
      className={className}
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)",
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// AQI Ring
function AQIRing({ value, level }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / 300, 1);

  return (
    <svg width={130} height={130} viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={r} fill="none" stroke="#f1f5f9" strokeWidth={10} />
      <circle
        cx={65}
        cy={65}
        r={r}
        fill="none"
        stroke={level.color}
        strokeWidth={10}
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 65 65)"
        style={{ transition: "stroke-dasharray 0.7s ease, stroke 0.7s ease" }}
      />
      <text
        x={65}
        y={60}
        textAnchor="middle"
        fontSize={26}
        fontWeight={700}
        fill={level.color}
        fontFamily="Nunito, sans-serif"
        style={{ transition: "fill 0.5s" }}
      >
        {Math.round(value)}
      </text>
      <text x={65} y={78} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="Nunito, sans-serif">
        AQI
      </text>
    </svg>
  );
}

// Sensor
function SensorTile({ label, value, unit, color, alert }) {
  return (
    <div
      style={{
        background: alert ? "#fef2f2" : "#f8fafc",
        border: `1.5px solid ${alert ? "#fecaca" : "#e2e8f0"}`,
        borderRadius: 14,
        padding: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "background 0.4s, border-color 0.4s",
      }}
    >
      <div>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 4,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: alert ? "#ef4444" : "#1e293b",
            lineHeight: 1,
          }}
        >
          {value}
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginLeft: 4 }}>{unit}</span>
        </p>
      </div>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: alert ? "#ef4444" : color }} />
    </div>
  );
}

// Custom graph tooltip
function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "8px 14px",
        fontSize: 13,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
    >
      <p style={{ color: "#64748b", marginBottom: 2 }}>t = {label}s</p>
      <p style={{ fontWeight: 700, color: "#1e293b" }}>
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

// Main Dashboard
export default function Dashboard() {
  // 9 Different Data Series
  const [pm1Series, setPm1Series] = useState(() => initSeries());
  const [pm25Series, setPm25Series] = useState(() => initSeries());
  const [pm10Series, setPm10Series] = useState(() => initSeries());
  const [co2Series, setCo2Series] = useState(() => initSeries());
  const [coSeries, setCoSeries] = useState(() => initSeries());
  const [tempSeries, setTempSeries] = useState(() => initSeries());
  const [humSeries, setHumSeries] = useState(() => initSeries());
  const [presSeries, setPresSeries] = useState(() => initSeries());
  const [gasSeries, setGasSeries] = useState(() => initSeries());

  const [currentData, setCurrentData] = useState({
    pm1_0: 0,
    pm25: 0,
    pm10: 0,
    co2: 0,
    co: 0,
    temperature: 0,
    humidity: 0,
    pressure: 0,
    gas_resistance: 0,
  });

  const [now, setNow] = useState(new Date());
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  // Extract latest values
  const pm1 = currentData.pm1_0;
  const pm25 = currentData.pm25;
  const pm10 = currentData.pm10;
  const co2 = currentData.co2;
  const co = currentData.co;
  const temp = currentData.temperature;
  const hum = currentData.humidity;
  const pres = currentData.pressure;
  const gasR = currentData.gas_resistance;

  // AQI Approximation based on PM2.5 Standard
  const aqi = Math.round(Math.min(300, pm25 * 2.1));
  const level = getAQILevel(aqi);

  // Alerts logic
  const alerts = [];
  if (pm25 > 100)
    alerts.push({
      id: "pm25",
      icon: "🟠",
      msg: `PM2.5 is ${pm25.toFixed(1)} µg/m³ — Dust levels exceed safe limits.`,
      color: "#f97316",
      bg: "#fff7ed",
      border: "#fed7aa",
    });
  if (co2 > 1000)
    alerts.push({
      id: "co2",
      icon: "🟡",
      msg: `CO2 is ${co2.toFixed(0)} ppm — Elevated levels (Ventilate room).`,
      color: "#eab308",
      bg: "#fefce8",
      border: "#fde68a",
    });
  if (co > 9)
    alerts.push({
      id: "co",
      icon: "🔴",
      msg: `Carbon Monoxide is ${co.toFixed(1)} ppm — High Warning!`,
      color: "#ef4444",
      bg: "#fef2f2",
      border: "#fecaca",
    });
  if (gasR > 0 && gasR < 15)
    alerts.push({
      id: "gas",
      icon: "🟣",
      msg: `Gas Resistance is low (${gasR.toFixed(1)} kΩ) indicating high Volatile Organic Compounds.`,
      color: "#8b5cf6",
      bg: "#faf5ff",
      border: "#ddd6fe",
    });

  // Firebase listener for current live values
  useEffect(() => {
    const latestRef = ref(database, "air_quality/device1/latest");

    const unsubscribe = onValue(
      latestRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const d = {
            pm1_0: toNum(data.pm1_0),
            pm25: toNum(data.pm25),
            pm10: toNum(data.pm10),
            co2: toNum(data.co2),
            co: toNum(data.co),
            temperature: toNum(data.temperature),
            humidity: toNum(data.humidity),
            pressure: toNum(data.pressure),
            gas_resistance: toNum(data.gas_resistance),
          };

          setCurrentData(d);
          setConnectionStatus("connected");
        }
      },
      () => {
        setConnectionStatus("error");
      }
    );

    return () => unsubscribe();
  }, []);

  // Firebase listener for chart history
  useEffect(() => {
    const historyRef = ref(database, "air_quality/device1/history");

    const unsubscribe = onValue(
      historyRef,
      (snapshot) => {
        const history = snapshot.val();

        setPm1Series(buildSeriesFromHistory(history, "pm1_0"));
        setPm25Series(buildSeriesFromHistory(history, "pm25"));
        setPm10Series(buildSeriesFromHistory(history, "pm10"));
        setCo2Series(buildSeriesFromHistory(history, "co2"));
        setCoSeries(buildSeriesFromHistory(history, "co"));
        setTempSeries(buildSeriesFromHistory(history, "temperature"));
        setHumSeries(buildSeriesFromHistory(history, "humidity"));
        setPresSeries(buildSeriesFromHistory(history, "pressure"));
        setGasSeries(buildSeriesFromHistory(history, "gas_resistance"));

        setConnectionStatus("connected");
      },
      () => {
        setConnectionStatus("error");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  const graphs = [
    { label: "PM1.0 Particle Mass", data: pm1Series, color: "#fca5a5", unit: "µg/m³", ref: null },
    { label: "PM2.5 Particle Mass", data: pm25Series, color: "#ef4444", unit: "µg/m³", ref: 100 },
    { label: "PM10 Particle Mass", data: pm10Series, color: "#b91c1c", unit: "µg/m³", ref: null },
    { label: "CO2 (Carbon Dioxide)", data: co2Series, color: "#3b82f6", unit: "ppm", ref: 1000 },
    { label: "CO (Carbon Monoxide)", data: coSeries, color: "#1e3a8a", unit: "ppm", ref: 9 },
    { label: "Air Temperature", data: tempSeries, color: "#f97316", unit: "°C", ref: null },
    { label: "Relative Humidity", data: humSeries, color: "#0ea5e9", unit: "%", ref: null },
    { label: "Atmospheric Pressure", data: presSeries, color: "#14b8a6", unit: "hPa", ref: null },
    { label: "Gas Resistance (inverse)", data: gasSeries, color: "#8b5cf6", unit: "kΩ", ref: null },
  ];

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", background: "#f1f5f9", minHeight: "100vh", paddingBottom: "40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; animation: blink 1.4s infinite; }
        .live-dot.connected { background: #22c55e; }
        .live-dot.connecting { background: #f59e0b; animation: none; }
        .live-dot.error { background: #ef4444; animation: none; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        .g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media(max-width: 1024px) {
          .g3 { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media(max-width: 900px) {
          .top-row { grid-template-columns: 1fr !important; }
        }
        @media(max-width: 600px) {
          .g3 { grid-template-columns: 1fr !important; }
          .navbar { flex-direction: column !important; align-items: flex-start !important; height: auto !important; padding: 12px 16px !important; gap: 8px; }
          .wrap { padding: 16px 12px !important; }
        }
        .section { margin-bottom: 32px; }
        .graph-card { transition: box-shadow 0.2s; }
        .graph-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.09) !important; }
      `}</style>

      {/* NAVBAR */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div
          className="navbar"
          style={{
            maxWidth: 1250,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            padding: "0 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              🌌
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "-0.01em" }}>
                Smart Air Matrix
              </p>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>BME688 · PMS5003 · SCD40 · ZE07</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
              <span className={`live-dot ${connectionStatus}`} />
              {connectionStatus === "connected"
                ? "Live Telemetry"
                : connectionStatus === "error"
                ? "Connection Error"
                : "Connecting To Firebase..."}
            </div>
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "5px 14px",
                fontSize: 13,
                color: "#475569",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="wrap" style={{ maxWidth: 1250, margin: "0 auto", padding: "24px 20px" }}>
        <div className="section">
          <div className="top-row" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
            <Card style={{ padding: 20 }}>
              <SectionTitle>Real-time AQI</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <AQIRing value={aqi} level={level} />
                <Badge color={level.color} bg={level.bg} border={level.border}>
                  {level.label}
                </Badge>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>Derived off PMS5003 Target</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {AQI_LEVELS.map((l, i) => {
                  const ranges = ["0–50", "51–100", "101–150", "151–200", "201–300", "301+"];
                  const isActive = level === l;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: isActive ? l.bg : "transparent",
                        border: `1px solid ${isActive ? l.border : "transparent"}`,
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: isActive ? l.color : "#64748b", fontWeight: isActive ? 700 : 400, flex: 1 }}>
                        {l.label}
                      </span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{ranges[i]}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <SectionTitle>Live 9-Vector Matrix</SectionTitle>
                <div className="g3">
                  <SensorTile label="PM 1.0 (PMS5003)" value={pm1.toFixed(0)} unit="µg/m³" color="#fca5a5" alert={false} />
                  <SensorTile label="PM 2.5 (PMS5003)" value={pm25.toFixed(0)} unit="µg/m³" color="#ef4444" alert={pm25 > 100} />
                  <SensorTile label="PM 10 (PMS5003)" value={pm10.toFixed(0)} unit="µg/m³" color="#b91c1c" alert={false} />
                  <SensorTile label="CO2 (SCD40)" value={co2.toFixed(0)} unit="ppm" color="#3b82f6" alert={co2 > 1000} />
                  <SensorTile label="CO (ZE07)" value={co.toFixed(1)} unit="ppm" color="#1e3a8a" alert={co > 9} />
                  <SensorTile label="Temp (BME688)" value={temp.toFixed(1)} unit="°C" color="#f97316" alert={false} />
                  <SensorTile label="Humidity (BME688)" value={hum.toFixed(0)} unit="%" color="#0ea5e9" alert={false} />
                  <SensorTile label="Pressure (BME688)" value={pres.toFixed(0)} unit="hPa" color="#14b8a6" alert={false} />
                  <SensorTile label="Gas Res (BME688)" value={gasR.toFixed(1)} unit="kΩ" color="#8b5cf6" alert={gasR > 0 && gasR < 15} />
                </div>
              </div>

              {alerts.length > 0 && (
                <Card style={{ padding: 0 }}>
                  {alerts.map((a, i) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "14px 18px",
                        borderBottom: i < alerts.length - 1 ? "1px solid #f8fafc" : "none",
                        background: a.bg,
                        borderLeft: `4px solid ${a.color}`,
                        borderRadius:
                          i === 0
                            ? "16px 16px 0 0"
                            : i === alerts.length - 1
                            ? "0 0 16px 16px"
                            : 0,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          background: "#fff",
                          border: `1px solid ${a.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {a.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 12, color: a.color, marginBottom: 2 }}>System Warning</p>
                        <p style={{ fontSize: 12, color: "#475569" }}>{a.msg}</p>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* GRAPHS */}
        <div className="section">
          <SectionTitle>9-Point Telemetry Visualizer</SectionTitle>
          <div className="g3">
            {graphs.map((g) => (
              <Card key={g.label} className="graph-card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>{g.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>
                      {g.data[g.data.length - 1]?.v || 0}{" "}
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{g.unit}</span>
                    </span>
                    {g.ref && (g.data[g.data.length - 1]?.v || 0) > g.ref && (
                      <span
                        style={{
                          fontSize: 11,
                          background: "#fef2f2",
                          color: "#ef4444",
                          border: "1px solid #fecaca",
                          borderRadius: 20,
                          padding: "1px 8px",
                          fontWeight: 600,
                        }}
                      >
                        ⚠ Over Threshold
                      </span>
                    )}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={g.data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<CustomTooltip unit={g.unit} />} />
                    {g.ref && <ReferenceLine y={g.ref} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1} />}
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={g.color}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: g.color, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}