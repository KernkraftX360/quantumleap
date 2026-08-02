import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const metadata = { title: "Business login" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (user) redirect(user.role === "customer" ? "/account" : "/dashboard");
  return <LoginForm />;
}
