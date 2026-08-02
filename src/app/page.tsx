import { CustomerHome } from "@/components/customer-home";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  return <CustomerHome user={user ? { name: user.name, role: user.role } : null} />;
}
