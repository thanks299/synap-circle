import request from "supertest";
import app from "../../server.js";
import User from "../models/User.js";
import OTP from "../models/OTP.js";
import { getAuthToken, clearAuthCache } from "./helpers/authHelper.js";

describe("Authentication API Tests", () => {
  const testUser = {
    email: "test@campus.edu",
    phoneNumber: "+1234567890",
    name: "Test User",
    password: "TestPassword123",
  };

  // Clear auth cache before each test to ensure fresh state
  beforeEach(() => {
    clearAuthCache();
  });

  describe("POST /api/auth/signup", () => {
    it("should send OTP to email for signup", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "OTP sent successfully to your email",
      );
      expect(response.body).toHaveProperty("development_otp");

      // Verify OTP was saved in database
      const otp = await OTP.findOne({ email: testUser.email });
      expect(otp).toBeTruthy();
      expect(otp.email).toBe(testUser.email);
      expect(otp.phoneNumber).toBe(testUser.phoneNumber);
    });

    it("should return error for missing email", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({
          phoneNumber: "+1234567890",
          password: "TestPassword123",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        expect.stringContaining("Email is required"),
      );
    });

    it("should return error for invalid email format", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({
          email: "invalid-email",
          phoneNumber: "+1234567890",
          password: "TestPassword123",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("errors");
      expect(response.body.errors[0].field).toBe("email");
    });

    it("should return error for duplicate email", async () => {
      await request(app).post("/api/auth/signup").send(testUser);

      // Second signup with same email
      const response = await request(app)
        .post("/api/auth/signup")
        .send({
          email: testUser.email,
          phoneNumber: "+1987654321",
          name: "Another User",
          password: "TestPassword123",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Email already registered. Please use a different email.",
      );
    });

    it("should return error for duplicate phone number", async () => {
      // First signup
      await request(app).post("/api/auth/signup").send(testUser);

      // Second signup with same phone number
      const response = await request(app)
        .post("/api/auth/signup")
        .send({
          email: "another@campus.edu",
          phoneNumber: testUser.phoneNumber,
          name: "Another User",
          password: "TestPassword123",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Phone number already registered. Please log in.",
      );
    });
  });

  describe("POST /api/auth/verify-otp", () => {
    beforeEach(() => {
      clearAuthCache();
    });

    it("should verify OTP and return JWT token", async () => {
      // First signup to get OTP
      const signupResponse = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(200);

      const otpCode = signupResponse.body.development_otp;

      // Verify OTP using email
      const response = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: testUser.email,
          otpCode: otpCode,
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "OTP verified successfully",
      );
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty(
        "phoneNumber",
        testUser.phoneNumber,
      );
      expect(response.body.user).toHaveProperty("email", testUser.email);
      expect(response.body.user).toHaveProperty("isVerified", true);

      // Verify user was created in database
      const user = await User.findOne({ email: testUser.email });
      expect(user).toBeTruthy();
      expect(user.isVerified).toBe(true);
    });

    it("should return error for invalid OTP", async () => {
      // First signup
      await request(app).post("/api/auth/signup").send(testUser);

      // Verify with wrong OTP
      const response = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: testUser.email,
          otpCode: "999999",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "Invalid or expired OTP");
    });

    it("should return error for expired OTP", async () => {
      // First signup
      await request(app).post("/api/auth/signup").send(testUser);

      // Manually expire the OTP
      await OTP.updateOne(
        { email: testUser.email },
        { expiresAt: new Date(Date.now() - 10000) },
      );

      // Verify with expired OTP
      const response = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: testUser.email,
          otpCode: "123456",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "Invalid or expired OTP");
    });

    it("should return error for user not found", async () => {
      const response = await request(app)
        .post("/api/auth/verify-otp")
        .send({
          email: "nonexistent@campus.edu",
          otpCode: "123456",
        })
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "User not found. Please sign up first.",
      );
    });
  });

  describe("POST /api/auth/resend-otp", () => {
    beforeEach(() => {
      clearAuthCache();
    });

    it("should resend OTP to email", async () => {
      // First signup
      await request(app).post("/api/auth/signup").send(testUser);

      // Resend OTP using email
      const response = await request(app)
        .post("/api/auth/resend-otp")
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "OTP resent successfully to your email",
      );
      expect(response.body).toHaveProperty("development_otp");
    });

    it("should return error for non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/resend-otp")
        .send({ email: "nonexistent@campus.edu" })
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Email not found. Please sign up first.",
      );
    });
  });

  describe("Protected Routes", () => {
    let authToken;
    let userId;

    const protectedRoutesUser = {
      email: "protected-routes@campus.edu",
      phoneNumber: "+1234567899",
      name: "Protected Routes User",
      password: "TestPassword123",
    };

    beforeAll(async () => {
      const result = await getAuthToken(protectedRoutesUser);
      authToken = result.token;
      userId = result.userId;
    });

    describe("GET /api/auth/me", () => {
      it("should return user profile with valid token", async () => {
        const response = await request(app)
          .get("/api/auth/me")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("user");
        expect(response.body.user).toHaveProperty(
          "phoneNumber",
          protectedRoutesUser.phoneNumber,
        );
        expect(response.body.user).toHaveProperty(
          "email",
          protectedRoutesUser.email,
        );
        expect(response.body.user).toHaveProperty("trustedContactsCount", 0);
        expect(response.body.user).toHaveProperty("maxContacts", 3);
      });

      it("should return 401 without token", async () => {
        const response = await request(app).get("/api/auth/me").expect(401);

        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty(
          "message",
          "Authentication required. Please log in.",
        );
      });

      it("should return 401 with invalid token", async () => {
        const response = await request(app)
          .get("/api/auth/me")
          .set("Authorization", "Bearer invalid_token")
          .expect(401);

        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty(
          "message",
          "Invalid token. Please log in again.",
        );
      });
    });

    describe("POST /api/auth/logout", () => {
      it("should logout successfully", async () => {
        const response = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty(
          "message",
          "Logged out successfully",
        );
      });
    });
  });
});
