import { getCurrentUser } from "@/lib/auth";
import { DashboardView } from "@/components/dashboard-view";
import { LandingView } from "@/components/landing-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    return <DashboardView user={user} />;
  }

  return <LandingView />;
}
