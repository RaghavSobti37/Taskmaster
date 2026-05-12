import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const cookieStore = await cookies();
  const user = cookieStore.get("crm_user");
  if (user) redirect("/dashboard");
  redirect("/login");
}
