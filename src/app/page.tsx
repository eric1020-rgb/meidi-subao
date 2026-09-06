import { synthesizeMarket } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  // SSR with deterministic demo so first paint is never empty;
  // client then refreshes via /api/market (live quotes when available).
  const initial = synthesizeMarket();
  return <Dashboard initialData={initial} />;
}
