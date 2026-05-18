import { HomeView } from "@/components/home/HomeView";
import { countDistinctThreatsOnLaunchStacks, listLaunchStacksFromDb } from "@/lib/catalog-from-db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const launchStacks = await listLaunchStacksFromDb().catch(() => []);
  let verifiedThreatCount: number | null = null;
  try {
    verifiedThreatCount = await countDistinctThreatsOnLaunchStacks();
  } catch {
    verifiedThreatCount = null;
  }

  return <HomeView launchStacks={launchStacks} verifiedThreatCount={verifiedThreatCount} />;
}
