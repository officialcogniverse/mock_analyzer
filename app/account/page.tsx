import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { AccountView } from "@/components/account/AccountView";
import { assertActiveUser } from "@/lib/users";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }
  const user = await assertActiveUser(session.user.id);
  if (!user || user.blocked) {
    redirect("/");
  }

  return <AccountView />;
}
