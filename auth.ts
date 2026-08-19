import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

/**
 * Google sign-in only. Backend session (JWT + refresh cookie) is established
 * client-side via POST /auth/oauth-login after NextAuth returns the Google profile.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  trustHost: true,
})
