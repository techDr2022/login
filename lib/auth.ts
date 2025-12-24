import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.isActive) {
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // Verify user still exists in database and is active
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, role: true, isActive: true },
          })
          
          // If user doesn't exist or is inactive, clear the user id to invalidate session
          if (!dbUser || !dbUser.isActive) {
            // Clear user id to invalidate session (will fail validation in server actions)
            session.user.id = ''
            session.user.role = ''
            return session
          }
          
          // Use fresh data from database
          session.user.id = dbUser.id
          session.user.role = dbUser.role
        } catch (error) {
          console.error('Error verifying user in session callback:', error)
          // Clear user id on error
          session.user.id = ''
          session.user.role = ''
          return session
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

