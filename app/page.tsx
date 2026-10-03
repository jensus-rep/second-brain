import { requireChatGPTUser } from "./chatgpt-auth";
import { BrainApp } from "@/components/brain/brain-app";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireChatGPTUser("/");
  return <BrainApp />;
}

