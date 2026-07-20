import request from "supertest";
import app from "../../server.js";
import User from "../models/User.js";
import TrustedContact from "../models/TrustedContact.js";
import {
  getAuthToken,
  clearAuthCache,
  clearAuthCacheForUser,
} from "./helpers/authHelper.js";

describe("Onboarding API Tests", () => {
  let authToken;
  let userId;

  const testUser = {
    email: "onboardingtest@campus.edu",
    phoneNumber: "+1234567890",
    name: "Onboarding Test User",
    password: "TestPassword123",
  };

  beforeAll(async () => {
    const result = await getAuthToken(testUser);
    authToken = result.token;
    userId = result.userId;
  });

  beforeEach(() => {
    clearAuthCache();
  });

  describe("GET /api/auth/onboarding-status", () => {
    it("should return current onboarding status", async () => {
      const response = await request(app)
        .get("/api/auth/onboarding-status")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("currentStep", "welcome");
      expect(response.body).toHaveProperty("progress", 20); // 1/5 * 100
      expect(response.body).toHaveProperty("isComplete", false);
      expect(response.body).toHaveProperty("canGoForward", true);
      expect(response.body).toHaveProperty("canGoBack", false);
      expect(response.body).toHaveProperty("nextStep", "location");
      expect(response.body).toHaveProperty("previousStep", null);
      expect(response.body).toHaveProperty("steps");
      expect(Array.isArray(response.body.steps)).toBe(true);
      expect(response.body.steps).toHaveLength(5);
      expect(response.body).toHaveProperty("contactsCount", 0);
      expect(response.body).toHaveProperty("maxContacts", 3);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id", userId);
      expect(response.body.user).toHaveProperty("email", testUser.email);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/auth/onboarding-status")
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Authentication required. Please log in.",
      );
    });

    it("should handle user not found", async () => {
      // Use a disposable user/token for this test instead of deleting the
      // shared fixture user - deleting the shared user would leave every
      // later test in this file authenticated with a token whose user no
      // longer exists, causing the auth middleware to reject them with 401
      // before the route's own "user not found" handling ever runs.
      const disposableUser = {
        email: "onboarding-status-notfound@campus.edu",
        phoneNumber: "+1234567801",
        name: "Disposable Status User",
        password: "TestPassword123",
      };
      const { token: disposableToken, userId: disposableUserId } =
        await getAuthToken(disposableUser);

      await User.findByIdAndDelete(disposableUserId);
      clearAuthCacheForUser(disposableUser.email);

      const response = await request(app)
        .get("/api/auth/onboarding-status")
        .set("Authorization", `Bearer ${disposableToken}`)
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "User not found");
    });
  });

  describe("PATCH /api/auth/onboarding-step", () => {
    it("should update onboarding step to location", async () => {
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "location" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "Onboarding step updated to: location",
      );
      expect(response.body).toHaveProperty("step", "location");
      expect(response.body).toHaveProperty("isComplete", false);
      expect(response.body).toHaveProperty("progress", 40); // 2/5 * 100
      expect(response.body).toHaveProperty("canGoForward", true);
      expect(response.body).toHaveProperty("canGoBack", true);
      expect(response.body).toHaveProperty("previousStep", "welcome");
      expect(response.body).toHaveProperty("nextStep", "university");

      // Verify user was updated
      const user = await User.findById(userId);
      expect(user.onboardingStep).toBe("location");
    });

    it("should update onboarding step to university", async () => {
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "university" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("step", "university");
      expect(response.body).toHaveProperty("progress", 60); // 3/5 * 100
      expect(response.body).toHaveProperty("canGoForward", true);
      expect(response.body).toHaveProperty("canGoBack", true);
      expect(response.body).toHaveProperty("previousStep", "location");
      expect(response.body).toHaveProperty("nextStep", "contacts");
    });

    it("should update onboarding step to contacts", async () => {
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "contacts" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("step", "contacts");
      expect(response.body).toHaveProperty("progress", 80); // 4/5 * 100
      expect(response.body).toHaveProperty("canGoForward", true);
      expect(response.body).toHaveProperty("canGoBack", true);
      expect(response.body).toHaveProperty("previousStep", "university");
      expect(response.body).toHaveProperty("nextStep", "complete");

      // Should include contact info
      expect(response.body).toHaveProperty("contacts");
      expect(response.body.contacts).toHaveProperty("count", 0);
      expect(response.body.contacts).toHaveProperty("maxContacts", 3);
    });

    it("should allow going backward freely", async () => {
      // Move forward first
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "location" });

      // Go backward
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "welcome" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("step", "welcome");
      expect(response.body).toHaveProperty("progress", 20);
      expect(response.body).toHaveProperty("canGoForward", true);
      expect(response.body).toHaveProperty("canGoBack", false);
      expect(response.body).toHaveProperty("previousStep", null);
      expect(response.body).toHaveProperty("nextStep", "location");
    });

    it("should prevent jumping forward more than 1 step", async () => {
      // Reset to welcome
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "welcome" });

      // Try to skip to contacts
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "contacts" })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        expect.stringContaining("Please complete steps in order"),
      );
      expect(response.body).toHaveProperty("currentStep", "welcome");
      expect(response.body).toHaveProperty("nextStep", "location");
    });

    it("should prevent completing onboarding without contacts", async () => {
      // Move to location
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "location" })
        .expect(200);

      // Move to university
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "university" })
        .expect(200);

      // Move to contacts
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "contacts" })
        .expect(200);

      // Try to complete without contacts (should fail with the contacts validation)
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "complete" })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        expect.stringContaining("Please add at least one trusted contact"),
      );
      expect(response.body).toHaveProperty("requiredStep", "contacts");
      expect(response.body).toHaveProperty("contactCount", 0);
    });

    it("should allow completing onboarding with contacts", async () => {
      // Reset onboarding
      await User.findByIdAndUpdate(userId, { onboardingStep: "welcome" });

      // Move through steps
      const steps = ["location", "university", "contacts"];
      for (const step of steps) {
        await request(app)
          .patch("/api/auth/onboarding-step")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ step });
      }

      // Add a contact
      await TrustedContact.create({
        userId: userId,
        name: "Test Contact",
        phoneNumber: "+1234567899",
        email: "testcontact@example.com",
        relationship: "friend",
        isActive: true,
      });

      // Complete onboarding
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "complete" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("step", "complete");
      expect(response.body).toHaveProperty("isComplete", true);
      expect(response.body).toHaveProperty("progress", 100);
      expect(response.body).toHaveProperty("canGoForward", false);
      expect(response.body).toHaveProperty("canGoBack", true);
      expect(response.body).toHaveProperty("previousStep", "contacts");
      expect(response.body).toHaveProperty("nextStep", null);

      // Verify user was verified
      const user = await User.findById(userId);
      expect(user.isVerified).toBe(true);
      expect(user.lastLogin).toBeTruthy();
      expect(user.onboardingStep).toBe("complete");

      // Should include contact info
      expect(response.body).toHaveProperty("contacts");
      expect(response.body.contacts).toHaveProperty("count", 1);
      expect(response.body.contacts).toHaveProperty("maxContacts", 3);
    });

    it("should process university data correctly", async () => {
      // Reset onboarding
      await User.findByIdAndUpdate(userId, { onboardingStep: "welcome" });

      // First move to location
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "location" })
        .expect(200);

      const universityId = "507f1f77bcf86cd799439011";
      const universityName = "Test University";

      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          step: "university",
          data: {
            universityId: universityId,
            selectedUniversity: universityName,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("step", "university");
      if (response.body.user.universityId) {
        expect(response.body.user).toHaveProperty("universityId", universityId);
      }
      expect(response.body.user).toHaveProperty(
        "selectedUniversity",
        universityName,
      );

      // Verify in database
      const user = await User.findById(userId);
      if (user.universityId) {
        expect(user.universityId.toString()).toBe(universityId);
      }
      expect(user.selectedUniversity).toBe(universityName);
    });

    it("should process location data correctly", async () => {
      await User.findByIdAndUpdate(userId, { onboardingStep: "welcome" });

      const locationData = {
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          step: "location",
          data: {
            location: locationData,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("step", "location");

      // Verify location was saved - reload user from database
      const user = await User.findById(userId);
      expect(user.preferences).toBeDefined();
      expect(user.preferences.onboardingLocation).toBeDefined();
      expect(user.preferences.onboardingLocation.latitude).toBe(
        locationData.latitude,
      );
      expect(user.preferences.onboardingLocation.longitude).toBe(
        locationData.longitude,
      );
      expect(user.preferences.onboardingLocation.updatedAt).toBeTruthy();
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .send({ step: "location" })
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Authentication required. Please log in.",
      );
    });

    it("should validate step input", async () => {
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "invalid-step" })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        expect.stringContaining("Invalid onboarding step"),
      );
    });

    it("should handle user not found", async () => {
      const disposableUser = {
        email: "onboarding-step-notfound@campus.edu",
        phoneNumber: "+1234567802",
        name: "Disposable Step User",
        password: "TestPassword123",
      };
      const { token: disposableToken, userId: disposableUserId } =
        await getAuthToken(disposableUser);

      await User.findByIdAndDelete(disposableUserId);
      clearAuthCacheForUser(disposableUser.email);

      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${disposableToken}`)
        .send({ step: "location" })
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "User not found");
    });

    it("should return contact count when on contacts step", async () => {
      await User.findByIdAndUpdate(userId, { onboardingStep: "welcome" });

      // Delete any existing contacts for this user to ensure clean state
      await TrustedContact.deleteMany({ userId: userId });

      // Move through steps to get to contacts
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "location" })
        .expect(200);

      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "university" })
        .expect(200);

      // Add a single contact
      await TrustedContact.create({
        userId: userId,
        name: "Another Contact",
        phoneNumber: "+1234567898",
        email: "another@example.com",
        relationship: "sibling",
        isActive: true,
      });

      // Move to contacts - this should show 1 contact
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "contacts" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("step", "contacts");
      expect(response.body).toHaveProperty("contacts");
      expect(response.body.contacts).toHaveProperty("count", 1);
      expect(response.body.contacts).toHaveProperty("maxContacts", 3);
    });

    it("should handle data validation for invalid data type", async () => {
      const response = await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          step: "university",
          data: "invalid-data-type",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        expect.stringContaining("Data must be an object"),
      );
    });
  });

  describe("Onboarding Step Statuses", () => {
    it("should show correct step statuses after moving forward", async () => {
      // Reset onboarding
      await User.findByIdAndUpdate(userId, { onboardingStep: "welcome" });

      // Move to location
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "location" });

      const response = await request(app)
        .get("/api/auth/onboarding-status")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const steps = response.body.steps;

      // Welcome should be completed
      expect(steps[0].step).toBe("welcome");
      expect(steps[0].isCompleted).toBe(true);
      expect(steps[0].isActive).toBe(false);

      // Location should be active
      expect(steps[1].step).toBe("location");
      expect(steps[1].isCompleted).toBe(false);
      expect(steps[1].isActive).toBe(true);

      // Other steps should be upcoming
      expect(steps[2].isCompleted).toBe(false);
      expect(steps[2].isActive).toBe(false);
      expect(steps[3].isCompleted).toBe(false);
      expect(steps[3].isActive).toBe(false);
      expect(steps[4].isCompleted).toBe(false);
      expect(steps[4].isActive).toBe(false);
    });

    it("should show all steps as completed when onboarding is complete", async () => {
      // Complete onboarding
      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "location" });

      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "university" });

      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "contacts" });

      // Add a contact
      await TrustedContact.create({
        userId: userId,
        name: "Final Contact",
        phoneNumber: "+1234567897",
        email: "final@example.com",
        relationship: "parent",
        isActive: true,
      });

      await request(app)
        .patch("/api/auth/onboarding-step")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ step: "complete" });

      const response = await request(app)
        .get("/api/auth/onboarding-status")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isComplete).toBe(true);
      expect(response.body.progress).toBe(100);

      const steps = response.body.steps;
      steps.forEach((step) => {
        expect(step.isCompleted).toBe(true);
        expect(step.isActive).toBe(false);
        expect(step.isLocked).toBe(false);
      });
    });
  });
});
