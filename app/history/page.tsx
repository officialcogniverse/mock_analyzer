import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { HistoryView } from "@/components/dashboard/HistoryView";
import { assertActiveUser } from "@/lib/users";

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    redirect("/");
  }
  const user = await assertActiveUser(userId);
  if (!user || user.blocked) {
    redirect("/");
  }

  return <HistoryView />;
}
