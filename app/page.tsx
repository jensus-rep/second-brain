import { requireUser } from "@/lib/server/auth";
import { BrainApp } from "@/components/brain/brain-app";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireUser("/");
  return <BrainApp />;
}
