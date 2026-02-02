import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const SCENARIOS = [
  { id: "normal", title: "Normal Baseline", level: "Easy", expected: ["Stable metrics", "No anomaly logs", "Events low"] },
  { id: "sensor_drift", title: "Sensor Drift", level: "Medium", expected: ["ot_temp_c rises", "alarm logs", "ot_events_total increases"] },
  { id: "valve_stuck", title: "Valve Stuck", level: "Hard", expected: ["valve_state stays 0", "anomaly logs", "valve mismatch counter"] },
  { id: "comms_jitter", title: "Comms Jitter", level: "Easy", expected: ["timeout logs", "events increase", "metrics still scrape"] },
  { id: "rogue_device", title: "Rogue Device Join", level: "Medium", expected: ["asset logs", "new_device counter", "no major timeseries shift"] },
];
const COMPLETION_SCENARIOS = SCENARIOS.filter((s) => s.id !== "normal");

function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden border border-white/10">
      <div className="h-full bg-emerald-400/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  const map = {
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
    blue: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    neutral: "bg-slate-500/15 text-slate-200 border-slate-500/30",
    amber: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs ${map[tone]}`}>{children}</span>;
}

function Sidebar({ tab, setTab }) {
  const Item = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      className={`w-full text-left px-3 py-2 rounded-xl transition ${tab === id
        ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 glow"
        : "hover:bg-white/5 text-slate-200"
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-64 shrink-0 bg-[#0b0f14] border-r border-white/10 p-4 animate-slide-in-left">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 glow grid place-items-center">
          <span className="text-emerald-300 font-black">V2</span>
        </div>
        <div>
          <div className="text-white font-extrabold leading-tight">IT/OT LAB</div>
          <div className="text-slate-400 text-xs">Security Training Lab</div>
        </div>
      </div>

      <div className="space-y-2">
        <Item id="dashboard" label="Dashboard" />
        <Item id="topology" label="Topology" />
        <Item id="services" label="Services" />
        <Item id="scenarios" label="Scenarios" />
        <Item id="runs" label="Runs" />
      </div>

      <div className="mt-6 pt-6 border-t border-white/10 space-y-2 text-sm">
        <a className="block text-slate-300 hover:text-white" href="http://localhost:3000" target="_blank" rel="noreferrer">
          Open Grafana
        </a>
        <a className="block text-slate-300 hover:text-white" href="http://localhost:9500" target="_blank" rel="noreferrer">
          Open Prometheus
        </a>
        <a className="block text-slate-300 hover:text-white" href="http://localhost:3100/ready" target="_blank" rel="noreferrer">
          Loki Ready
        </a>
      </div>

      <div className="mt-6 text-[11px] text-slate-500">
        Lab-only educational environment. Run in isolated networks.
      </div>
    </div>
  );
}

function TopologyCard() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 animate-slide-up hover-lift">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-bold">Network Topology</div>
          <div className="text-slate-400 text-sm">IT → DMZ → OT segmentation</div>
        </div>
        <Badge tone="blue">MVP</Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 stagger">
        <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white">IT Zone</div>
            <Badge tone="neutral">future</Badge>
          </div>
          <ul className="mt-3 text-slate-300 text-sm list-disc ml-5 space-y-1">
            <li>it-web</li>
            <li>it-auth-lite</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white">DMZ</div>
            <Badge tone="neutral">future</Badge>
          </div>
          <ul className="mt-3 text-slate-300 text-sm list-disc ml-5 space-y-1">
            <li>dmz-broker</li>
            <li>jumpbox</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-4 glow">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white">OT Zone</div>
            <Badge tone="green">live</Badge>
          </div>
          <ul className="mt-3 text-slate-300 text-sm list-disc ml-5 space-y-1">
            <li>ot-sim</li>
            <li>historian (Postgres)</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 text-slate-400 text-sm">
        Roadmap: add real protocol emulators + more zone services.
      </div>
    </div>
  );
}

function MachineCard({ title, ip, difficulty, status, onStart, onStop, onRestart, tags = [] }) {
  const diffTone = difficulty === "Easy" ? "green" : difficulty === "Medium" ? "amber" : "red";
  const liveTone = status === "up" || status === "ui" ? "green" : "red";

  return (
<<<<<<< HEAD
    <div className={`rounded-2xl bg-white/5 border border-white/10 p-5 hover-lift ${status === "up" ? "glow" : ""}`}>
=======
    <div className={`rounded-2xl bg-white/5 border border-white/10 p-5 ${status === "up" ? "neon-live" : ""}`}>
>>>>>>> 6bc279efa75ffa8fe049e90853f6f5e083d8e9d6
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-white font-extrabold text-lg">{title}</div>
          <div className="text-slate-400 text-xs mt-1">
            IP: <span className="font-mono text-slate-300">{ip}</span>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            <Badge tone={diffTone}>{difficulty}</Badge>
            <Badge tone={liveTone}>{status}</Badge>
            {tags.map((t) => (
              <Badge key={t} tone="blue">
                {t}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={onStart}
            className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/20 transition text-sm"
          >
            Start
          </button>
          <button
            onClick={onStop}
            className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 hover:bg-red-500/20 transition text-sm"
          >
            Stop
          </button>
          <button
            onClick={onRestart}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm"
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [services, setServices] = useState([]);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [machineQuery, setMachineQuery] = useState("");
  const [activity, setActivity] = useState([]);
  const [activityService, setActivityService] = useState("ot-sim");

  const machines = useMemo(
    () => ([
      { id: "ot-sim", title: "OT-SIM", difficulty: "Easy", tags: ["OT", "Telemetry"], ip: "172.18.x.x" },
      { id: "grafana", title: "Telemetry Stack", difficulty: "Medium", tags: ["Grafana", "Loki", "Prometheus"], ip: "localhost" },
      { id: "portal-api", title: "Portal API", difficulty: "Easy", tags: ["Control Plane"], ip: "172.18.x.x" },
    ]),
    []
  );

  const zones = useMemo(() => {
    const z = { CORE: 0, OT: 0, DMZ: 0, IT: 0 };
    services.forEach((s) => (z[s.zone] = (z[s.zone] || 0) + 1));
    return z;
  }, [services]);

  const health = useMemo(() => {
    const up = services.filter((s) => String(s.status).startsWith("up") || s.status === "ui").length;
    return { up, total: services.length };
  }, [services]);

  async function refresh() {
    setBusy(true);
    try {
      const s = await fetch(`${API}/api/services`).then((r) => r.json());
      setServices(s);
      const rr = await fetch(`${API}/api/runs`).then((r) => r.json());
      setRuns(rr.items || []);
      const act = await fetch(`${API}/api/activity?limit=30&service=${encodeURIComponent(activityService)}`).then((r) => r.json());
      setActivity(act.items || []);
    } finally {
      setBusy(false);
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

  async function svcAction(name, action) {
    await fetch(`${API}/api/services/${name}/${action}`, { method: "POST" });
    refresh();
  }

  useEffect(() => {
    refresh();
  }, [activityService]);

  const completed = useMemo(() => {
    const set = new Set();
    for (const r of runs) {
      if (r && r.status && String(r.status).includes("started")) {
        if (r.scenario_id && r.scenario_id !== "normal") set.add(r.scenario_id);
      }
    }
    return set;
  }, [runs]);

  const progressPct = useMemo(() => {
    const total = COMPLETION_SCENARIOS.length;
    const done = completed.size;
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [completed]);

  const pwned = useMemo(() => completed.size === COMPLETION_SCENARIOS.length, [completed]);

  const filteredMachines = useMemo(() => {
    const q = machineQuery.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [machines, machineQuery]);

  const statusBadge = (status) => {
    if (status === "ui") return <Badge tone="blue">ui</Badge>;
    if (String(status).startsWith("up")) return <Badge tone="green">up</Badge>;
    if (String(status).startsWith("down")) return <Badge tone="red">{status}</Badge>;
    return <Badge tone="neutral">{status || "unknown"}</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#05070b] text-slate-200">
      <div className="flex">
        <Sidebar tab={tab} setTab={setTab} />

        <main className="flex-1 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold text-white">SOC Portal</h1>
              <p className="text-slate-400 text-sm">Control plane + telemetry for IT/OT training lab</p>
            </div>

            <div className="flex items-center gap-3">
              <Badge tone={health.up === health.total ? "green" : "amber"}>
                Health {health.up}/{health.total || 0}
              </Badge>
              <button
                onClick={refresh}
                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                {busy ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 mt-6">
            <div className="col-span-12 md:col-span-4 rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="text-slate-400 text-xs">CORE</div>
              <div className="text-white text-2xl font-black mt-1">{zones.CORE || 0}</div>
              <div className="text-slate-400 text-sm">services</div>
            </div>

            <div className="col-span-12 md:col-span-4 rounded-2xl bg-white/5 border border-white/10 p-5 glow">
              <div className="text-slate-400 text-xs">OT</div>
              <div className="text-white text-2xl font-black mt-1">{zones.OT || 0}</div>
              <div className="text-slate-400 text-sm">services</div>
            </div>

            <div className="col-span-12 md:col-span-4 rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="text-slate-400 text-xs">TELEMETRY</div>
              <div className="text-white text-xl font-black mt-1">Prom + Loki</div>
              <div className="text-slate-400 text-sm">Grafana dashboards</div>
            </div>
          </div>

          {tab === "dashboard" && (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-white font-bold">Quick Scenarios</div>
                    <div className="text-slate-400 text-sm">Trigger signals and observe in Grafana</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => runScenario("sensor_drift")}
                      className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/20 transition"
                    >
                      sensor_drift
                    </button>
                    <button
                      onClick={() => runScenario("valve_stuck")}
                      className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 hover:bg-red-500/20 transition"
                    >
                      valve_stuck
                    </button>
                    <button
                      onClick={() => runScenario("comms_jitter")}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                    >
                      comms_jitter
                    </button>
                    <button
                      onClick={() => runScenario("rogue_device")}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                    >
                      rogue_device
                    </button>
                    <button
                      onClick={resetScenario}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                    >
                      reset
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-slate-400 text-sm">
                  Open Grafana → Dashboard “Lab Overview (MVP)” → Watch metrics/logs change.
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-white font-bold">Scenario Progress</div>
                    <div className="text-slate-400 text-sm">
                      Completed {completed.size}/{COMPLETION_SCENARIOS.length} (based on run history)
                    </div>
                  </div>
                  <Badge tone={progressPct >= 80 ? "green" : "amber"}>{progressPct}%</Badge>
                </div>
                <div className="mt-3">
                  <ProgressBar value={progressPct} />
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {COMPLETION_SCENARIOS.map((s) => (
                    <Badge key={s.id} tone={completed.has(s.id) ? "green" : "neutral"}>
                      {s.id}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-white font-bold">Machine Status</div>
                  <div className="text-slate-400 text-sm">Unlocks when all scenarios are completed</div>
                </div>
                <div className="flex items-center gap-3">
                  {pwned ? <Badge tone="green">PWNED</Badge> : <Badge tone="neutral">LOCKED</Badge>}
                  <button
                    disabled={!pwned}
                    className={`px-4 py-2 rounded-xl border transition text-sm ${
                      pwned
                        ? "bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/20 glow"
                        : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => alert("✅ PWNED! All scenarios completed.")}
                  >
                    {pwned ? "Claim" : "Complete scenarios"}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold">Lab Machines</div>
                    <div className="text-slate-400 text-sm">Control lab containers safely</div>
                  </div>
                  <Badge tone="blue">MVP</Badge>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <input
                    value={machineQuery}
                    onChange={(e) => setMachineQuery(e.target.value)}
                    placeholder="Search machines (ot, grafana, telemetry...)"
                    className="w-full md:w-[420px] px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-emerald-500/30"
                  />
                  <Badge tone="blue">{filteredMachines.length} shown</Badge>
                </div>

                <div className="grid grid-cols-12 gap-4 mt-4">
                  {filteredMachines.map((m) => (
                    <div key={m.id} className="col-span-12 md:col-span-6">
                      <MachineCard
                        title={m.title}
                        ip={m.ip}
                        difficulty={m.difficulty}
                        tags={m.tags}
                        status={services.find((s) => s.name === m.id)?.status || "unknown"}
                        onStart={() => svcAction(m.id, "start")}
                        onStop={() => svcAction(m.id, "stop")}
                        onRestart={() => svcAction(m.id, "restart")}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-white font-bold">Activity Feed</div>
                    <div className="text-slate-400 text-sm">Live logs from Loki (last 10 minutes)</div>
                  </div>
                  <select
                    value={activityService}
                    onChange={(e) => setActivityService(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"
                  >
                    <option value="ot-sim">ot-sim</option>
                    <option value="portal-api">portal-api</option>
                    <option value="prometheus">prometheus</option>
                    <option value="grafana">grafana</option>
                    <option value="loki">loki</option>
                  </select>
                </div>

                <div className="mt-4 max-h-[320px] overflow-auto rounded-xl border border-white/10 bg-[#0b1220]">
                  {activity.length === 0 ? (
                    <div className="p-4 text-slate-400 text-sm">No logs yet. Run a scenario and refresh.</div>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {activity.map((a, idx) => (
                        <li key={idx} className="p-3">
                          <div className="text-slate-400 text-[11px] font-mono">{a.ts}</div>
                          <div className="text-slate-200 text-sm font-mono break-words">{a.line}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "topology" && (
            <div className="mt-6">
              <TopologyCard />
            </div>
          )}

          {tab === "services" && (
            <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-white font-bold">Services</div>
                  <div className="text-slate-400 text-sm">Health probes from portal-api</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0b1220] text-slate-400 text-xs">
                    <tr>
                      <th className="text-left px-5 py-3">Name</th>
                      <th className="text-left px-5 py-3">Zone</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">URL</th>
                      <th className="text-left px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {services.map((s) => (
                      <tr key={s.name} className="hover:bg-white/5 transition">
                        <td className="px-5 py-3 font-semibold text-white">{s.name}</td>
                        <td className="px-5 py-3">{s.zone}</td>
                        <td className="px-5 py-3">{statusBadge(s.status)}</td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs text-slate-300">{s.url}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => svcAction(s.name, "start")}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/20 transition text-xs"
                            >
                              Start
                            </button>
                            <button
                              onClick={() => svcAction(s.name, "stop")}
                              className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 hover:bg-red-500/20 transition text-xs"
                            >
                              Stop
                            </button>
                            <button
                              onClick={() => svcAction(s.name, "restart")}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-xs"
                            >
                              Restart
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "scenarios" && (
            <div className="mt-6 grid grid-cols-12 gap-4">
              {SCENARIOS.map((s) => (
                <div key={s.id} className="col-span-12 md:col-span-6 rounded-2xl bg-white/5 border border-white/10 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-white font-extrabold">{s.title}</div>
                      <div className="text-slate-400 text-sm">{s.id}</div>
                      <div className="mt-2">
                        <Badge tone={s.level === "Easy" ? "green" : s.level === "Medium" ? "amber" : "red"}>{s.level}</Badge>
                      </div>
                    </div>
                    <button
                      onClick={() => runScenario(s.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/20 transition"
                    >
                      Run
                    </button>
                  </div>

                  <div className="mt-4 text-slate-300 text-sm">
                    <div className="text-slate-400 text-xs mb-2">EXPECTED SIGNALS</div>
                    <ul className="list-disc ml-5 space-y-1">
                      {s.expected.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}

              <div className="col-span-12">
                <button
                  onClick={resetScenario}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  Reset to Normal
                </button>
              </div>
            </div>
          )}

          {tab === "runs" && (
            <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="p-5">
                <div className="text-white font-bold">Run History</div>
                <div className="text-slate-400 text-sm">Latest 50 actions stored in Postgres</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0b1220] text-slate-400 text-xs">
                    <tr>
                      <th className="text-left px-5 py-3">ID</th>
                      <th className="text-left px-5 py-3">Scenario</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {runs.map((r) => (
                      <tr key={r.id} className="hover:bg-white/5 transition">
                        <td className="px-5 py-3">{r.id}</td>
                        <td className="px-5 py-3 font-semibold text-white">{r.scenario_id}</td>
                        <td className="px-5 py-3">{r.status}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-300">{String(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
