import { Outlet, NavLink } from "react-router";
import { AppLayout } from "../components/app-layout";

export default function SettingsLayout() {
  return (
    <AppLayout>
      <header className="border-b border-gray-800 pb-0 mb-6">
        <div className="pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-gray-400 mt-2">
            Manage system configuration, integrations, and policies
          </p>
        </div>

        <nav className="flex gap-6">
          <NavLink
            to="/settings/general"
            className={({ isActive }) =>
              `pb-2 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`
            }
          >
            General
          </NavLink>
          <NavLink
            to="/settings/integrations"
            className={({ isActive }) =>
              `pb-2 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`
            }
          >
            Integrations
          </NavLink>
          <NavLink
            to="/settings/policies"
            className={({ isActive }) =>
              `pb-2 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`
            }
          >
            Policies
          </NavLink>
          <NavLink
            to="/settings/prompts"
            className={({ isActive }) =>
              `pb-2 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`
            }
          >
            Prompts
          </NavLink>
        </nav>
      </header>

      <Outlet />
    </AppLayout>
  );
}
