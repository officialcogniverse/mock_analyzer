import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { HistoryView } from "@/components/dashboard/HistoryView";
import { assertActiveUser } from "@/lib/users";

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }
  const user = await assertActiveUser(session.user.id);
  if (!user || user.blocked) {
    redirect("/");
  }

  return <HistoryView />;
}
