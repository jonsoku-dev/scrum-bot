import { Link, useLocation } from "react-router";
import { ROUTES } from "../lib/constants";

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, label: "Dashboard" },
  { to: ROUTES.MEETINGS, label: "Meetings" },
  { to: ROUTES.DRAFTS, label: "Drafts" },
  { to: ROUTES.APPROVALS, label: "Approvals" },
  { to: ROUTES.DECISIONS, label: "Decisions" },
  { to: ROUTES.SETTINGS, label: "Settings" },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <nav className="flex gap-4 mb-6">
          {NAV_ITEMS.map(({ to, label }) => {
            const isActive = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={
                  isActive
                    ? "text-blue-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 transition-colors"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
}
