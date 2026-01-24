import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { ensureIndexes, COLLECTIONS } from "@/lib/db";
import { getDb } from "@/lib/mongodb";

function normalizeUserId(email: string) {
  return email.trim().toLowerCase();
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
      if (!user.email) return false;
      const userId = normalizeUserId(user.email);
      const db = await getDb();
      await ensureIndexes(db);
      const users = db.collection(COLLECTIONS.users);
      const existing = await users.findOne({ userId });
      if (existing?.deletedAt) return false;

      const now = new Date();
      if (!existing) {
        await users.insertOne({
          userId,
          displayName: user.name ?? null,
          email: user.email,
          provider: "google",
          examGoal: null,
          targetDate: null,
          weeklyHours: null,
          baselineLevel: null,
          preferences: { theme: "system" },
          onboardingCompleted: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await users.updateOne(
          { userId },
          {
            $set: {
              displayName: existing.displayName ?? user.name ?? null,
              updatedAt: now,
            },
          }
        );
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.userId = normalizeUserId(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = String(token.userId);
      }
      return session;
    },
  },
};
