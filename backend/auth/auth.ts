import { authHandler } from "encore.dev/auth";
import { Header, Gateway } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createClerkClient } from "@clerk/backend";

const clerkSecretKeyProd = secret("clerkSecretKeyProd");
const clerkClient = createClerkClient({ secretKey: clerkSecretKeyProd() });

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
}

/**
 * AuthHandler verifies the Clerk JWT from the Authorization header.
 */
export const handler = authHandler<AuthParams, AuthData>(async (params) => {
  const token = params.authorization.replace("Bearer ", "");

  if (!token) {
    return null;
  }

  try {
    const session = await clerkClient.authenticateRequest({
      headerToken: token,
    });

    if (session.isSignedIn && session.toAuth().userId) {
      return { userID: session.toAuth().userId! };
    }
  } catch (e) {
    console.error("Auth error:", e);
  }

  return null;
});

export const gateway = new Gateway({
  authHandler: handler,
});
