# Architecture

Browser → Portal UI (React)

Portal UI → Portal API (FastAPI)
Portal API:
- service status probing
- scenario control (calls OT-SIM)
- validation + report (pulls logs from Loki)
- stores run history in Postgres

OT-SIM:
- generates OT tags + events
- exposes /metrics for Prometheus
- emits JSON logs

Telemetry:
- Prometheus scrapes metrics (portal-api, ot-sim)
- Promtail ships logs → Loki
- Grafana visualizes Prometheus + Loki
