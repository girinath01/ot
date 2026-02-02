import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const styles = {
  page: {
    background: "#0b0f14",
    color: "#e5e7eb",
    minHeight: "100vh",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial",
  },
  container: { maxWidth: 1100, margin: "0 auto", padding: 20 },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  title: { fontSize: 28, margin: 0 },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 },
  tab: (active) => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${active ? "#22c55e" : "#374151"}`,
    background: active ? "rgba(34,197,94,0.12)" : "#0f172a",
    color: "#e5e7eb",
    cursor: "pointer",
    userSelect: "none",
  }),
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 12,
    marginTop: 14,
  },
  card: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
  },
  cardTitle: {
    fontSize: 14,
    color: "#93c5fd",
    margin: 0,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  big: { fontSize: 22, margin: 0 },
  link: { color: "#93c5fd", textDecoration: "none" },
  button: (tone = "neutral") => {
    const map = {
      neutral: {
        border: "#374151",
        bg: "#111827",
        glow: "rgba(59,130,246,0.0)",
      },
      good: {
        border: "#14532d",
        bg: "rgba(34,197,94,0.15)",
        glow: "rgba(34,197,94,0.15)",
      },
      warn: {
        border: "#7c2d12",
        bg: "rgba(245,158,11,0.15)",
        glow: "rgba(245,158,11,0.12)",
      },
      danger: {
        border: "#7f1d1d",
        bg: "rgba(239,68,68,0.15)",
        glow: "rgba(239,68,68,0.12)",
      },
    };
    const c = map[tone] || map.neutral;
    return {
      padding: "8px 12px",
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      background: c.bg,
      color: "#e5e7eb",
      cursor: "pointer",
      boxShadow: `0 0 0 0 ${c.glow}`,
    };
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    borderRadius: 14,
    overflow: "hidden",
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#9ca3af",
    padding: "10px 12px",
    background: "#0b1220",
    borderBottom: "1px solid #1f2937",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #111827",
    verticalAlign: "top",
  },
  pill: (tone) => {
    const map = {
      up: { bg: "rgba(34,197,94,0.18)", bd: "#14532d", tx: "#bbf7d0" },
      down: { bg: "rgba(239,68,68,0.16)", bd: "#7f1d1d", tx: "#fecaca" },
      ui: { bg: "rgba(59,130,246,0.14)", bd: "#1e3a8a", tx: "#bfdbfe" },
      unknown: {
        bg: "rgba(148,163,184,0.10)",
        bd: "#334155",
        tx: "#e2e8f0",
      },
    };
    const c = map[tone] || map.unknown;
    return {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      background: c.bg,
      border: `1px solid ${c.bd}`,
      color: c.tx,
      fontSize: 12,
    };
  },
  code: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    color: "#cbd5e1",
  },
};

const SCENARIOS = [
  {
    id: "normal",
    title: "Normal Baseline",
    expected: ["Stable metrics", "No anomaly logs", "Events low"],
  },
  {
    id: "sensor_drift",
    title: "Sensor Drift",
    expected: [
      "ot_temp_c slowly increases",
      "log event_type=alarm",
      "ot_events_total increases (temp_high)",
    ],
  },
  {
    id: "valve_stuck",
    title: "Valve Stuck",
    expected: [
      "ot_valve_state stays 0",
      "log event_type=anomaly",
      "ot_events_total increases (valve_mismatch)",
    ],
  },
  {
    id: "comms_jitter",
    title: "Comms Jitter",
    expected: [
      "intermittent timeout logs",
      "ot_events_total increases (timeout)",
      "metrics still flowing",
    ],
  },
  {
    id: "rogue_device",
    title: "Rogue Device Join",
    expected: [
      "log event_type=asset",
      "ot_events_total increases (new_device)",
      "no major timeseries shift",
    ],
  },
];

function Topology() {
  return (
    <div style={styles.card}>
      <p style={styles.cardTitle}>TOPOLOGY</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Zone title="IT ZONE" items={["it-web (future)", "it-auth-lite (future)"]} />
        <Zone title="DMZ" items={["dmz-broker (future)", "jump (future)"]} />
        <Zone
          title="OT ZONE"
          items={["ot-sim (live)", "historian (MVP via Postgres)"]}
        />
      </div>
      <div style={{ marginTop: 12, color: "#9ca3af", fontSize: 13 }}>
        MVP topology is simplified. In roadmap we add more services per zone.
      </div>
    </div>
  );
}

function Zone({ title, items }) {
  return (
    <div
      style={{
        background: "#0b1220",
        border: "1px solid #1f2937",
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>segmented</div>
      </div>
      <ul style={{ margin: "10px 0 0 16px", color: "#cbd5e1" }}>
        {items.map((x) => (
          <li key={x} style={{ marginBottom: 6 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [services, setServices] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);

  const zones = useMemo(() => {
    const z = { CORE: 0, OT: 0, DMZ: 0, IT: 0 };
    services.forEach((s) => {
      if (!z[s.zone]) z[s.zone] = 0;
      z[s.zone] += 1;
    });
    return z;
  }, [services]);

  async function refresh() {
    setLoading(true);
    try {
      const s = await fetch(`${API}/api/services`).then((r) => r.json());
      setServices(s);
      const rr = await fetch(`${API}/api/runs`).then((r) => r.json());
      setRuns(rr.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function runScenario(scenario_id) {
    await fetch(`${API}/api/scenarios/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_id }),
    });
    refresh();
  }

  async function resetScenario() {
    await fetch(`${API}/api/scenarios/reset`, { method: "POST" });
    refresh();
  }

  useEffect(() => {
    refresh();
  }, []);

  function statusTone(status) {
    if (!status) return "unknown";
    if (status === "ui") return "ui";
    if (String(status).startsWith("up")) return "up";
    if (String(status).startsWith("down")) return "down";
    return "unknown";
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <h1 style={styles.title}>IT/OT Lab v2</h1>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              style={styles.link}
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
            >
              Grafana
            </a>
            <a
              style={styles.link}
              href="http://localhost:9090"
              target="_blank"
              rel="noreferrer"
            >
              Prometheus
            </a>
            <a
              style={styles.link}
              href="http://localhost:3100/ready"
              target="_blank"
              rel="noreferrer"
            >
              Loki
            </a>
            <span style={{ color: "#9ca3af" }}>
              {loading ? "refreshing..." : "live"}
            </span>
          </div>
        </div>

        <div style={styles.tabs}>
          <div
            onClick={() => setTab("dashboard")}
            style={styles.tab(tab === "dashboard")}
          >
            Dashboard
          </div>
          <div
            onClick={() => setTab("topology")}
            style={styles.tab(tab === "topology")}
          >
            Topology
          </div>
          <div
            onClick={() => setTab("services")}
            style={styles.tab(tab === "services")}
          >
            Services
          </div>
          <div
            onClick={() => setTab("scenarios")}
            style={styles.tab(tab === "scenarios")}
          >
            Scenarios
          </div>
          <div onClick={() => setTab("runs")} style={styles.tab(tab === "runs")}>
            Runs
          </div>
        </div>

        {tab === "dashboard" && (
          <>
            <div style={styles.row}>
              <div style={{ ...styles.card, gridColumn: "span 4" }}>
                <p style={styles.cardTitle}>CORE</p>
                <p style={styles.big}>{zones.CORE || 0} services</p>
              </div>
              <div style={{ ...styles.card, gridColumn: "span 4" }}>
                <p style={styles.cardTitle}>OT</p>
                <p style={styles.big}>{zones.OT || 0} services</p>
              </div>
              <div style={{ ...styles.card, gridColumn: "span 4" }}>
                <p style={styles.cardTitle}>TELEMETRY</p>
                <p style={styles.big}>Prom + Grafana + Loki</p>
              </div>
            </div>

            <div style={{ ...styles.card, marginTop: 12 }}>
              <p style={styles.cardTitle}>QUICK SCENARIOS</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={styles.button("good")}
                  onClick={() => runScenario("normal")}
                >
                  normal
                </button>
                <button
                  style={styles.button("warn")}
                  onClick={() => runScenario("sensor_drift")}
                >
                  sensor_drift
                </button>
                <button
                  style={styles.button("danger")}
                  onClick={() => runScenario("valve_stuck")}
                >
                  valve_stuck
                </button>
                <button
                  style={styles.button("neutral")}
                  onClick={() => runScenario("comms_jitter")}
                >
                  comms_jitter
                </button>
                <button
                  style={styles.button("neutral")}
                  onClick={() => runScenario("rogue_device")}
                >
                  rogue_device
                </button>
                <button style={styles.button("neutral")} onClick={resetScenario}>
                  reset
                </button>
              </div>
              <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 13 }}>
                Tip: open Grafana → “Lab Overview (MVP)” and watch metrics/logs
                change when scenarios run.
              </div>
            </div>
          </>
        )}

        {tab === "topology" && (
          <div style={{ marginTop: 12 }}>
            <Topology />
          </div>
        )}

        {tab === "services" && (
          <div style={{ ...styles.card, marginTop: 12 }}>
            <p style={styles.cardTitle}>SERVICES</p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Zone</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>URL</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.name}>
                    <td style={styles.td}>{s.name}</td>
                    <td style={styles.td}>{s.zone}</td>
                    <td style={styles.td}>
                      <span style={styles.pill(statusTone(s.status))}>
                        {s.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.code}>{s.url}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "scenarios" && (
          <div style={{ ...styles.card, marginTop: 12 }}>
            <p style={styles.cardTitle}>SCENARIOS & EXPECTED SIGNALS</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {SCENARIOS.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: "#0b1220",
                    border: "1px solid #1f2937",
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>{s.title}</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>{s.id}</div>
                    </div>
                    <button
                      style={styles.button(s.id === "normal" ? "good" : "warn")}
                      onClick={() => runScenario(s.id)}
                    >
                      Run
                    </button>
                  </div>
                  <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 13 }}>
                    <div
                      style={{
                        color: "#93c5fd",
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Expected signals:
                    </div>
                    <ul style={{ margin: "0 0 0 16px" }}>
                      {s.expected.map((x) => (
                        <li key={x} style={{ marginBottom: 6 }}>
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button style={styles.button("neutral")} onClick={resetScenario}>
                Reset to Normal
              </button>
            </div>
          </div>
        )}

        {tab === "runs" && (
          <div style={{ ...styles.card, marginTop: 12 }}>
            <p style={styles.cardTitle}>RECENT RUNS</p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Scenario</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Created</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.id}</td>
                    <td style={styles.td}>{r.scenario_id}</td>
                    <td style={styles.td}>{r.status}</td>
                    <td style={styles.td}>
                      <span style={styles.code}>{String(r.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16, color: "#6b7280", fontSize: 12 }}>
          Lab-only educational environment. Do not deploy on real networks.
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
