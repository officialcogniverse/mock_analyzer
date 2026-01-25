import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { AccountView } from "@/components/account/AccountView";
import { assertActiveUser } from "@/lib/users";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    redirect("/");
  }
  const user = await assertActiveUser(userId);
  if (!user || user.blocked) {
    redirect("/");
  }

  return <AccountView />;
}
