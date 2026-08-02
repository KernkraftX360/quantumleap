import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/queue";
import { ensureSeeded } from "@/lib/seed";

export const metadata = { title: "Operations dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensureSeeded();
  const sp = (await searchParams) ?? {};
  const raw = sp.session;
  const queryToken = typeof raw === "string" ? raw : null;
  const sess = await getSession(queryToken);
  const user = sess && (sess.user.role === "admin" || sess.user.role === "business") ? sess.user : null;
  if (!user) redirect("/login");
  const initialToken = sess?.token ?? null;
  // Scoping (incl. no-show analytics) happens server-side so a business only ever sees its own data.
  const initialData = user ? await getDashboardData(user.role === "business" ? user.id : undefined) : null;
  return <AdminDashboard initialData={initialData} user={user} initialToken={initialToken ?? undefined} />;
}
