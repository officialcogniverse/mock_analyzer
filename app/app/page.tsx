import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { AppDashboard } from "@/components/dashboard/AppDashboard";
import { assertActiveUser } from "@/lib/users";

export default async function AppPage() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    redirect("/");
  }
  const user = await assertActiveUser(userId);
  if (!user || user.blocked) {
    redirect("/");
  }

  return <AppDashboard />;
}
