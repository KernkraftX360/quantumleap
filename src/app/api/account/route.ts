import { getCurrentUser } from "@/lib/auth";
import { getCustomerAccount } from "@/lib/customer-account";

export const dynamic = "force-dynamic";

// Authenticated customer profile data. The customer portal also reads this client-side via
// the stored token, so it works in embedded contexts where the cookie can't be stored.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getCustomerAccount(user.id);
  return Response.json(account);
}
