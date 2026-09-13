import { JoinForm } from "@/components/join-form";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <JoinForm token={token} />;
}
