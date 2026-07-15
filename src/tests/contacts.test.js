import request from "supertest";
import app from "../../server.js";
import User from "../models/User.js";
import TrustedContact from "../models/TrustedContact.js";
import { getAuthToken } from "./helpers/authHelper.js";

describe("Contacts API Tests", () => {
  let authToken;
  let userId;
  let contactId;

  const testUser = {
    email: "contacttest@campus.edu",
    phoneNumber: "+1234567890",
    name: "Contact Test User",
    password: "TestPassword123",
  };

  const testContact = {
    name: "Jane Smith",
    phoneNumber: "+1234567891",
    email: "jane@example.com",
    relationship: "friend",
  };

  beforeAll(async () => {
    const result = await getAuthToken(testUser);
    authToken = result.token;
    userId = result.userId;
  });

  describe("POST /api/contacts", () => {
    it("should create a new trusted contact", async () => {
      const response = await request(app)
        .post("/api/contacts")
        .set("Authorization", `Bearer ${authToken}`)
        .send(testContact)
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "Contact added successfully",
      );
      expect(response.body).toHaveProperty("contact");
      expect(response.body.contact).toHaveProperty("name", testContact.name);
      expect(response.body.contact).toHaveProperty(
        "phoneNumber",
        testContact.phoneNumber,
      );
      expect(response.body.contact).toHaveProperty("email", testContact.email);
      expect(response.body.contact).toHaveProperty(
        "relationship",
        testContact.relationship,
      );
      expect(response.body.contact).toHaveProperty("isPrimary", true);
      expect(response.body.contact).toHaveProperty("isActive", true);

      contactId = response.body.contact.id;
    });

    it("should return error for duplicate contact", async () => {
      const response = await request(app)
        .post("/api/contacts")
        .set("Authorization", `Bearer ${authToken}`)
        .send(testContact)
        .expect(409);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "Contact already exists");
    });

    it("should create second contact with isPrimary false", async () => {
      const secondContact = {
        name: "John Doe",
        phoneNumber: "+1234567892",
        email: "john@example.com",
        relationship: "roommate",
      };

      const response = await request(app)
        .post("/api/contacts")
        .set("Authorization", `Bearer ${authToken}`)
        .send(secondContact)
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.contact).toHaveProperty("isPrimary", false);
    });

    it("should return error when max contacts reached", async () => {
      // Add third contact
      await request(app)
        .post("/api/contacts")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Bob Wilson",
          phoneNumber: "+1234567893",
          email: "bob@example.com",
          relationship: "sibling",
        })
        .expect(201);

      // Try to add fourth contact (should fail)
      const response = await request(app)
        .post("/api/contacts")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Alice Brown",
          phoneNumber: "+1234567894",
          email: "alice@example.com",
          relationship: "partner",
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        expect.stringContaining("You can only have up to"),
      );
    });

    it("should return 401 without token", async () => {
      const response = await request(app)
        .post("/api/contacts")
        .send(testContact)
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty(
        "message",
        "Authentication required. Please log in.",
      );
    });
  });

  describe("GET /api/contacts", () => {
    it("should get all trusted contacts", async () => {
      const response = await request(app)
        .get("/api/contacts")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("contacts");
      expect(Array.isArray(response.body.contacts)).toBe(true);
      expect(response.body.contacts.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty("count");
      expect(response.body).toHaveProperty("maxContacts", 3);
      expect(response.body).toHaveProperty("canAddMore");
    });
  });

  describe("PUT /api/contacts/:contactId", () => {
    it("should update a contact", async () => {
      const updatedData = {
        name: "Jane Smith Updated",
        relationship: "partner",
      };

      const response = await request(app)
        .put(`/api/contacts/${contactId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updatedData)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "Contact updated successfully",
      );
      expect(response.body.contact).toHaveProperty("name", updatedData.name);
      expect(response.body.contact).toHaveProperty(
        "relationship",
        updatedData.relationship,
      );
    });

    it("should return 404 for non-existent contact", async () => {
      const response = await request(app)
        .put("/api/contacts/507f1f77bcf86cd799439011")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Non-existent" })
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "Contact not found");
    });
  });

  describe("DELETE /api/contacts/:contactId", () => {
    it("should delete a contact", async () => {
      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "Contact deleted successfully",
      );

      // Verify contact is soft deleted
      const contact = await TrustedContact.findById(contactId);
      expect(contact.isActive).toBe(false);
    });

    it("should return 404 for already deleted contact", async () => {
      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("message", "Contact not found");
    });
  });

  describe("GET /api/contacts/campus-security", () => {
    it("should get campus security contacts", async () => {
      const response = await request(app)
        .get("/api/contacts/campus-security")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("securityContacts");
      expect(Array.isArray(response.body.securityContacts)).toBe(true);
      expect(response.body).toHaveProperty("count");
    });
  });
});
