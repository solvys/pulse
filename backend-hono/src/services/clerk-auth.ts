import { verifyToken } from '@clerk/backend'
import { retryWithBackoff } from '../middleware/auth-retry.js'

class ClerkConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClerkConfigError'
  }
}

type VerifyTokenParams = Parameters<typeof verifyToken>[1]
type TokenPayload = Awaited<ReturnType<typeof verifyToken>>

const buildVerifyOptions = (): VerifyTokenParams => {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new ClerkConfigError('CLERK_SECRET_KEY is missing. Set it in Fly secrets.')
  }

  const options: Record<string, unknown> = {
    secretKey,
    clockSkewInMs: Number.parseInt(process.env.CLERK_CLOCK_SKEW_MS ?? '5000', 10)
  }

  if (process.env.CLERK_JWT_TEMPLATE) {
    options.template = process.env.CLERK_JWT_TEMPLATE
  }
  if (process.env.CLERK_JWT_ISSUER) {
    options.issuer = process.env.CLERK_JWT_ISSUER
  }
  if (process.env.CLERK_JWT_AUDIENCE) {
    options.audience = process.env.CLERK_JWT_AUDIENCE
  }
  if (process.env.CLERK_JWT_AUTHORIZED_PARTY) {
    options.authorizedParties = [process.env.CLERK_JWT_AUTHORIZED_PARTY]
  }

  return options as VerifyTokenParams
}

const verifyOptions = buildVerifyOptions()

const shouldRetryClerk = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error ? String(error.message) : ''
  const name = 'name' in error ? String(error.name) : ''
  const combined = `${name} ${message}`.toLowerCase()
  return (
    combined.includes('network') ||
    combined.includes('fetch') ||
    combined.includes('timeout') ||
    combined.includes('http')
  )
}

export const verifyClerkToken = async (token: string): Promise<TokenPayload> => {
  if (!token) {
    throw new Error('Missing token')
  }

  return retryWithBackoff(
    async () => verifyToken(token, verifyOptions),
    { label: 'clerk-verify', shouldRetry: shouldRetryClerk }
  )
}

export const clerkHealth = () => ({
  hasSecret: Boolean(process.env.CLERK_SECRET_KEY),
  issuer: process.env.CLERK_JWT_ISSUER ?? null,
  template: process.env.CLERK_JWT_TEMPLATE ?? null
})

export { ClerkConfigError }
