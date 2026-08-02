import { notFound } from "next/navigation";
import { LiveTicket } from "@/components/live-ticket";
import { getTicketDetails } from "@/lib/queue";
import { ensureSeeded } from "@/lib/seed";

export const metadata = { title: "Your place in line" };
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ publicId: string }> }) {
  await ensureSeeded();
  const { publicId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) notFound();
  const ticket = await getTicketDetails(publicId);
  if (!ticket) notFound();
  return <LiveTicket initialTicket={ticket} />;
}
