import dotenv from "dotenv";
import mongoose from "mongoose";
import { jest, beforeAll, afterAll } from "@jest/globals";

// Load test environment variables
dotenv.config({ path: ".env.test" });

process.env.NODE_ENV = "test";
process.env.DISABLE_EMAIL_SENDING = "true";
process.env.DISABLE_RATE_LIMITING = "true";

jest.setTimeout(30000);

let isConnected = false;

beforeAll(async () => {
  if (!isConnected) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      isConnected = true;
      console.log("🧪 Test MongoDB connected successfully");
    } catch (error) {
      console.error("🧪 Test MongoDB connection error:", error);
      throw error;
    }
  }
});

// Clean up once at the very end of the whole suite.
// NOTE: We intentionally do NOT clear collections in afterEach anymore.
// Most test files create a user/token once in beforeAll and reuse it across
// several `it()` blocks in the same describe. Wiping the DB after every
// single test deleted that user before the next test ran, causing spurious
// 401 "User not found" failures unrelated to what each test was actually
// checking. Each test file uses a distinct, unique test email, so cross-file
// collisions aren't a real risk — final cleanup in afterAll is sufficient.
afterAll(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
    await mongoose.disconnect();
    isConnected = false;
    console.log("🧪 Test MongoDB disconnected");
  } catch (error) {
    console.error("🧪 Error during cleanup:", error);
  }
});

// Suppress console logs in CI environment
if (process.env.CI === "true") {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}
