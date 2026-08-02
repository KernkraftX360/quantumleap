import { redirect } from "next/navigation";
import { SignupForm } from "@/components/signup-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Create your business dashboard" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user && (user.role === "admin" || user.role === "business")) redirect("/dashboard");
  return <SignupForm />;
}
