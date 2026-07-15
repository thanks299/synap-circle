import request from "supertest";
import app from "../../../server.js";

// Cache tokens per user email
const tokenCache = new Map();

export const getAuthToken = async (testUser) => {
  const cacheKey = testUser.email;

  // If we already have a cached token for this user and  return it
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey);
  }

  const userWithPassword = {
    ...testUser,
    password: testUser.password || "TestPassword123",
  };

  // Create user and get token
  const signupResponse = await request(app)
    .post("/api/auth/signup")
    .send(userWithPassword)
    .expect(200);

  const otpCode = signupResponse.body.development_otp;

  const verifyResponse = await request(app)
    .post("/api/auth/verify-otp")
    .send({
      email: testUser.email,
      otpCode: otpCode,
    })
    .expect(200);

  const result = {
    token: verifyResponse.body.token,
    userId: verifyResponse.body.user.id,
  };

  tokenCache.set(cacheKey, result);
  return result;
};

export const clearAuthCache = () => {
  tokenCache.clear();
};

export const clearAuthCacheForUser = (email) => {
  tokenCache.delete(email);
};
