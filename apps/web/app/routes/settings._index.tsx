import { useNavigate } from "react-router";
import { useEffect } from "react";

export default function SettingsIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/settings/integrations", { replace: true });
  }, [navigate]);
  return null;
}
