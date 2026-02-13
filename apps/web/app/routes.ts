import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("meetings", "routes/meetings.tsx"),
  route("drafts", "routes/drafts.tsx"),
  route("drafts/:id", "routes/drafts.$id.tsx"),
  route("approvals", "routes/approvals.tsx"),
  route("decisions", "routes/decisions.tsx"),
  route("decisions/:id", "routes/decisions.$id.tsx"),
  route("runs", "routes/runs.tsx"),
  route("runs/:runId", "routes/runs.$runId.tsx"),
  route("settings", "routes/settings.tsx", [
    index("routes/settings._index.tsx"),
    route("general", "routes/settings.general.tsx"),
    route("integrations", "routes/settings.integrations.tsx"),
    route("policies", "routes/settings.policies.tsx"),
    route("prompts", "routes/settings.prompts.tsx"),
  ]),
] satisfies RouteConfig;
