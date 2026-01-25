import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export default async function DebugSessionPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-lg font-semibold">Server Session Debug</h1>
      <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm">
        {JSON.stringify(session, null, 2)}
      </pre>
    </main>
  );
}
