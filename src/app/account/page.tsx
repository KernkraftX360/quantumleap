import { redirect } from "next/navigation";
import { CustomerAccount } from "@/components/customer-account";
import { getCurrentUser } from "@/lib/auth";
import { getCustomerAccount } from "@/lib/customer-account";

export const metadata = { title: "My queue · Quantum Leap" };
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.session;
  const queryToken = typeof raw === "string" ? raw : null;
  const user = await getCurrentUser(queryToken);
  if (user && user.role !== "customer") redirect(user.role === "admin" || user.role === "business" ? "/dashboard" : "/");
  const isCustomer = user?.role === "customer";
  const initial = isCustomer ? await getCustomerAccount(user!.id) : null;
  return <CustomerAccount initialUser={isCustomer ? { id: user!.id, name: user!.name, email: user!.email } : null} initial={initial} initialToken={queryToken ?? undefined} />;
}
