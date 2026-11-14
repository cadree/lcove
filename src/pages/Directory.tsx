import { Navigate, useLocation } from "react-router-dom";

/** The directory lives in Explore now: one people experience with the globe, deck and list. */
export default function Directory() {
  const params = new URLSearchParams(useLocation().search);
  params.set("section", "people");
  return <Navigate to={`/explore?${params}`} replace />;
}
