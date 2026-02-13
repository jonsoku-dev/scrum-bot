import { Navigate } from "react-router";
import { ROUTES } from "../lib/constants";

export function meta() {
  return [
    { title: "Scrum Bot Dashboard" },
    { name: "description", content: "AI-Augmented Scrum Bot Dashboard" },
  ];
}

export default function Home() {
  return <Navigate to={ROUTES.DASHBOARD} replace />;
}
