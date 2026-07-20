import mongoose from "mongoose";
import dotenv from "dotenv";
import CampusSecurity from "../src/models/CampusSecurity.js";
import EmergencyDirectory from "../src/models/EmergencyDirectory.js";

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
    console.log(
      "🔎 DB:",
      mongoose.connection.name,
      "| host:",
      mongoose.connection.host,
    );

    // Clear existing data
    await CampusSecurity.deleteMany({});
    await EmergencyDirectory.deleteMany({});
    console.log("🧹 Cleared existing data");

    // Seed Campus Security
    const securityContacts = [
      {
        name: "Campus Security Main Desk",
        phoneNumber: "08134490997",
        email: "acientguru@gmail.com",
        location: "Main Building, Ground Floor",
        coordinates: {
          type: "Point",
          coordinates: [-122.4194, 37.7749],
        },
        isPrimary: true,
        description: "24/7 Campus Security Main Desk",
        operatingHours: "24/7",
      },
      {
        name: "Campus Security Night Patrol",
        phoneNumber: "07070749664",
        email: "ephraimnyikwagh@gmail.com",
        location: "Security Booth, Gate A",
        coordinates: {
          type: "Point",
          coordinates: [-122.4195, 37.775], // [longitude, latitude]
        },
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
        phoneNumber: "08065706129",
        email: "fayokebg@gmail.com",
        address: "University Police Station, Campus Road",
        coordinates: {
          type: "Point",
          coordinates: [-122.4196, 37.7751], // [longitude, latitude]
        },
        isVerified: true,
        description: "Campus Police Department",
        operatingHours: "24/7",
      },
      {
        type: "security",
        name: "University Police Department",
        phoneNumber: "08065706129",
        email: "pjonyinyechi@gmail.com",
        address: "University Police Station, Campus Road",
        coordinates: {
          type: "Point",
          coordinates: [-122.4196, 37.7751], // [longitude, latitude]
        },
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
