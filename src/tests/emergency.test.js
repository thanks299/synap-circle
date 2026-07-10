import request from "supertest";
import app from "../../server.js";
import EmergencyDirectory from "../models/EmergencyDirectory.js";
import { getAuthToken } from "./helpers/authHelper.js";

describe("Emergency Directory API Tests", () => {
  let authToken;

  const testUser = {
    email: "emergencytest@campus.edu",
    phoneNumber: "+1234567890",
    name: "Emergency Test User",
  };

  beforeAll(async () => {
    const result = await getAuthToken(testUser);
    authToken = result.token;

    // Seed emergency directory if empty
    const count = await EmergencyDirectory.countDocuments();
    if (count === 0) {
      await EmergencyDirectory.create([
        {
          type: "security",
          name: "University Police",
          phoneNumber: "+1234567892",
          address: "Police Station, Campus",
          isVerified: true,
          isActive: true,
        },
        {
          type: "hospital",
          name: "University Health Center",
          phoneNumber: "+1234567893",
          address: "Health Center, Campus",
          isVerified: true,
          isActive: true,
        },
        {
          type: "hospital",
          name: "City General Hospital",
          phoneNumber: "+1234567894",
          address: "123 Main Street, City",
          isVerified: true,
          isActive: true,
        },
        {
          type: "police",
          name: "City Police Department",
          phoneNumber: "+1234567895",
          address: "456 Police Plaza, City",
          isVerified: true,
          isActive: true,
        },
        {
          type: "ambulance",
          name: "City Ambulance Service",
          phoneNumber: "+1234567896",
          address: "789 Emergency Lane, City",
          isVerified: true,
          isActive: true,
        },
        {
          type: "fire",
          name: "City Fire Department",
          phoneNumber: "+1234567897",
          address: "321 Fire Station Road, City",
          isVerified: true,
          isActive: true,
        },
      ]);
    }
  });

  describe("GET /api/emergency/directory", () => {
    it("should get all emergency contacts", async () => {
      const response = await request(app)
        .get("/api/emergency/directory")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("contacts");
      expect(Array.isArray(response.body.contacts)).toBe(true);
      expect(response.body.contacts.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty("grouped");
      expect(response.body.grouped).toHaveProperty("security");
      expect(response.body.grouped).toHaveProperty("hospital");
      expect(response.body.grouped).toHaveProperty("police");
      expect(response.body.grouped).toHaveProperty("ambulance");
      expect(response.body.grouped).toHaveProperty("fire");
    });

    it("should filter by type", async () => {
      const response = await request(app)
        .get("/api/emergency/directory?type=hospital")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(
        response.body.contacts.every((contact) => contact.type === "hospital"),
      ).toBe(true);
    });

    it("should search by name", async () => {
      const response = await request(app)
        .get("/api/emergency/directory?search=General")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(
        response.body.contacts.some((contact) =>
          contact.name.toLowerCase().includes("general"),
        ),
      ).toBe(true);
    });

    it("should return 401 without token", async () => {
      const response = await request(app)
        .get("/api/emergency/directory")
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Authentication required. Please log in.",
      );
    });
  });

  describe("GET /api/emergency/directory/:id", () => {
    let contactId;

    beforeAll(async () => {
      const contact = await EmergencyDirectory.findOne();
      if (contact) {
        contactId = contact._id.toString();
      }
    });

    it("should get a specific emergency contact", async () => {
      if (!contactId) {
        console.warn("Skipping test: No emergency contact found");
        return;
      }

      const response = await request(app)
        .get(`/api/emergency/directory/${contactId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("contact");
      expect(response.body.contact).toHaveProperty("_id", contactId);
    });

    it("should return 404 for non-existent contact", async () => {
      const response = await request(app)
        .get("/api/emergency/directory/507f1f77bcf86cd799439011")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Emergency contact not found",
      );
    });
  });

  describe("GET /api/emergency/nearby", () => {
    it("should return error without latitude", async () => {
      const response = await request(app)
        .get("/api/emergency/nearby?longitude=-122.4194")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Latitude and longitude are required",
      );
    });

    it("should return error without longitude", async () => {
      const response = await request(app)
        .get("/api/emergency/nearby?latitude=37.7749")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Latitude and longitude are required",
      );
    });

    it("should return nearby contacts", async () => {
      const response = await request(app)
        .get(
          "/api/emergency/nearby?latitude=37.7749&longitude=-122.4194&radius=5000",
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("contacts");
      expect(Array.isArray(response.body.contacts)).toBe(true);
    });
  });
});
