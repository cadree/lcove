import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { pushTapQueue } from "@/lib/pushTap";

/** Opens the route of a tapped notification. Must render inside the router. */
export function PushTapNavigator() {
  const navigate = useNavigate();
  useEffect(() => pushTapQueue.attach((path) => navigate(path)), [navigate]);
  return null;
}
