import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions, Session } from "next-auth";
import { ensureIndexes, COLLECTIONS } from "@/lib/db";
import { getDb } from "@/lib/mongodb";

export function normalizeUserId(email: string) {
  return email.trim().toLowerCase();
}

export function getSessionUserId(session: Session | null) {
  if (!session?.user) return null;
  const userId = (session.user as { id?: string }).id;
  if (userId) return String(userId);
  if (session.user.email) return normalizeUserId(session.user.email);
  return null;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      // Allow OAuth to succeed as long as Google verified the email
      if (!user?.email) return false;

      const userId = normalizeUserId(user.email);
      const db = await getDb();
      await ensureIndexes(db);

      const users = db.collection(COLLECTIONS.users);
      const now = new Date();
      const existing = await users.findOne({ userId });

      if (!existing) {
        await users.insertOne({
          userId,
          displayName: user.name ?? null,
          email: user.email,
          provider: "google",
          onboardingCompleted: false,
          preferences: { theme: "system" },
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          blocked: false,
        });
      } else {
        await users.updateOne({ userId }, { $set: { updatedAt: now } });
      }

      return true;
    },

    async jwt({ token, user }) {
      // user is only present on first sign-in; afterwards rely on token.email
      const email = user?.email ?? token.email;
      if (email) {
        (token as any).userId = normalizeUserId(String(email));
        token.email = String(email);
      }
      return token;
    },

    async session({ session, token }) {
      // Ensure session.user.id ALWAYS exists for server-side route protection
      if (session.user) {
        const uid =
          (token as any).userId ||
          (session.user.email ? normalizeUserId(session.user.email) : undefined);

        if (uid) (session.user as any).id = String(uid);
      }
      return session;
    },
  },
};
