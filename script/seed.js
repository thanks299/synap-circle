// scripts/seed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import CampusSecurity from "../src/models/CampusSecurity.js";
import EmergencyDirectory from "../src/models/EmergencyDirectory.js";

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await CampusSecurity.deleteMany({});
    await EmergencyDirectory.deleteMany({});
    console.log("🧹 Cleared existing data");

    // Seed Campus Security
    const securityContacts = [
      {
        name: "Campus Security Main Desk",
        phoneNumber: "08134490997",
        email: "thanksayo@gmail.com",
        location: "Main Building, Ground Floor",
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
        isPrimary: true,
        description: "24/7 Campus Security Main Desk",
        operatingHours: "24/7",
      },
      {
        name: "Campus Security Night Patrol",
        phoneNumber: "07070749664",
        email: "thanksagbebble@gmail.com",
        location: "Security Booth, Gate A",
        coordinates: { latitude: 37.775, longitude: -122.4195 },
        isPrimary: false,
        description: "Night Patrol Unit",
        operatingHours: "9:00 PM - 6:00 AM",
      },
    ];

    await CampusSecurity.insertMany(securityContacts);
    console.log("✅ Campus Security seeded");

    // Seed Emergency Directory
    const emergencyContacts = [
      {
        type: "security",
        name: "University Police Department",
        phoneNumber: "",
        email: "thanksayo@gmail.com",
        address: "University Police Station, Campus Road",
        coordinates: { latitude: 37.7751, longitude: -122.4196 },
        isVerified: true,
        description: "Campus Police Department",
        operatingHours: "24/7",
      },
    ];

    await EmergencyDirectory.insertMany(emergencyContacts);
    console.log("✅ Emergency Directory seeded");

    console.log("🎉 Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

await seedData();
