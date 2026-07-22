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

    // ============================================
    // 1. Seed Campus Security
    // ============================================
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
          coordinates: [-122.4195, 37.775],
        },
        isPrimary: false,
        description: "Night Patrol Unit - 9:00 PM to 6:00 AM",
        operatingHours: "9:00 PM - 6:00 AM",
      },
    ];

    await CampusSecurity.insertMany(securityContacts);
    console.log("✅ Campus Security seeded (2 contacts)");

    // ============================================
    // 2. Seed Emergency Directory - Complete
    // ============================================
    const emergencyContacts = [
      // ---------- SECURITY ----------
      {
        type: "security",
        name: "University Police Department",
        phoneNumber: "08065706129",
        email: "fayokebg@gmail.com",
        address: "University Police Station, Campus Road",
        coordinates: {
          type: "Point",
          coordinates: [-122.4196, 37.7751],
        },
        isVerified: true,
        description: "Campus Police Department - 24/7 Emergency Response",
        operatingHours: "24/7",
      },
      {
        type: "security",
        name: "Campus Safety Escort Service",
        phoneNumber: "08066667777",
        email: "pjonyinyechi77@gmail.com",
        address: "Safety Office, Student Center",
        coordinates: {
          type: "Point",
          coordinates: [-122.418, 37.776],
        },
        isVerified: true,
        description: "Safety Escort Service - Available 24/7",
        operatingHours: "24/7",
      },

      // ---------- HOSPITALS ----------
      {
        type: "hospital",
        name: "University Health Services",
        phoneNumber: "08055551234",
        email: "thanksagbeble@gmail.com",
        address: "Health Center Building, East Campus",
        coordinates: {
          type: "Point",
          coordinates: [-122.416, 37.7765],
        },
        isVerified: true,
        description: "Campus Health Center - Emergency Medical Services",
        operatingHours: "8:00 AM - 10:00 PM",
      },
      {
        type: "hospital",
        name: "City General Hospital",
        phoneNumber: "08077778888",
        email: "info@citygeneral.gov",
        address: "123 Main Street, Downtown",
        coordinates: {
          type: "Point",
          coordinates: [-122.42, 37.773],
        },
        isVerified: true,
        description: "Full-service hospital with 24/7 Emergency Room",
        operatingHours: "24/7",
      },
      {
        type: "hospital",
        name: "St. Mary's Medical Center",
        phoneNumber: "08088889999",
        email: "emergency@stmarys.org",
        address: "456 Oak Avenue, Northside",
        coordinates: {
          type: "Point",
          coordinates: [-122.414, 37.778],
        },
        isVerified: true,
        description: "Level 1 Trauma Center - 24/7 Emergency Care",
        operatingHours: "24/7",
      },
      {
        type: "hospital",
        name: "Campus Urgent Care Clinic",
        phoneNumber: "08099990000",
        email: "urgentcare@university.edu",
        address: "789 University Drive, West Campus",
        coordinates: {
          type: "Point",
          coordinates: [-122.421, 37.774],
        },
        isVerified: true,
        description: "Walk-in Urgent Care - Non-emergency medical services",
        operatingHours: "8:00 AM - 8:00 PM",
      },

      // ---------- POLICE ----------
      {
        type: "police",
        name: "City Police Department - Main Station",
        phoneNumber: "08066668888",
        email: "police@city.gov",
        address: "456 Justice Avenue, Downtown",
        coordinates: {
          type: "Point",
          coordinates: [-122.422, 37.772],
        },
        isVerified: true,
        description: "City Police Department - 24/7 Emergency Response",
        operatingHours: "24/7",
      },
      {
        type: "police",
        name: "Campus Police Substation",
        phoneNumber: "08055556666",
        email: "campuspolice@university.edu",
        address: "Student Center, Ground Floor",
        coordinates: {
          type: "Point",
          coordinates: [-122.4185, 37.7755],
        },
        isVerified: true,
        description: "Campus Police Substation - Student Services",
        operatingHours: "8:00 AM - 6:00 PM",
      },

      // ---------- FIRE ----------
      {
        type: "fire",
        name: "City Fire Station #1 - Downtown",
        phoneNumber: "08077779999",
        email: "fire@city.gov",
        address: "789 Firehouse Road, Downtown",
        coordinates: {
          type: "Point",
          coordinates: [-122.423, 37.771],
        },
        isVerified: true,
        description: "Fire and Rescue Services - 24/7 Emergency",
        operatingHours: "24/7",
      },
      {
        type: "fire",
        name: "Campus Fire & Rescue Squad",
        phoneNumber: "08088887777",
        email: "firerescue@university.edu",
        address: "North Campus, Fire Station",
        coordinates: {
          type: "Point",
          coordinates: [-122.415, 37.7775],
        },
        isVerified: true,
        description: "Campus Fire and Rescue Services",
        operatingHours: "24/7",
      },

      // ---------- AMBULANCE ----------
      {
        type: "ambulance",
        name: "City Emergency Medical Services (EMS)",
        phoneNumber: "08099998888",
        email: "ems@city.gov",
        address: "123 EMS Headquarters, Downtown",
        coordinates: {
          type: "Point",
          coordinates: [-122.424, 37.77],
        },
        isVerified: true,
        description: "City EMS - 24/7 Ambulance Services",
        operatingHours: "24/7",
      },
      {
        type: "ambulance",
        name: "Campus Ambulance Service",
        phoneNumber: "08066665555",
        email: "ambulance@university.edu",
        address: "Health Center Building, East Campus",
        coordinates: {
          type: "Point",
          coordinates: [-122.4165, 37.7768],
        },
        isVerified: true,
        description: "Campus Ambulance - Emergency Medical Transport",
        operatingHours: "8:00 AM - 10:00 PM",
      },

      // ---------- ADDITIONAL SUPPORT ----------
      {
        type: "security",
        name: "Crisis Hotline - 24/7 Support",
        phoneNumber: "08011112222",
        email: "crisis@support.org",
        address: "Crisis Support Center, Online",
        coordinates: {
          type: "Point",
          coordinates: [-122.419, 37.7745],
        },
        isVerified: true,
        description: "24/7 Crisis Support and Mental Health Services",
        operatingHours: "24/7",
      },
      {
        type: "hospital",
        name: "Women's Health Center",
        phoneNumber: "08022223333",
        email: "womenshealth@center.org",
        address: "456 Women's Health Drive, Eastside",
        coordinates: {
          type: "Point",
          coordinates: [-122.413, 37.779],
        },
        isVerified: true,
        description: "Women's Health and Emergency Services",
        operatingHours: "24/7",
      },
    ];

    await EmergencyDirectory.insertMany(emergencyContacts);
    console.log(
      `✅ Emergency Directory seeded (${emergencyContacts.length} contacts)`,
    );

    // ============================================
    // 3. Summary
    // ============================================
    console.log("\n📊 Seeding Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const securityCount = emergencyContacts.filter(
      (c) => c.type === "security",
    ).length;
    const hospitalCount = emergencyContacts.filter(
      (c) => c.type === "hospital",
    ).length;
    const policeCount = emergencyContacts.filter(
      (c) => c.type === "police",
    ).length;
    const fireCount = emergencyContacts.filter((c) => c.type === "fire").length;
    const ambulanceCount = emergencyContacts.filter(
      (c) => c.type === "ambulance",
    ).length;

    console.log(`🔐 Campus Security: ${securityContacts.length} contacts`);
    console.log(`🛡️  Security Services: ${securityCount} contacts`);
    console.log(`🏥 Hospitals: ${hospitalCount} contacts`);
    console.log(`👮 Police: ${policeCount} contacts`);
    console.log(`🔥 Fire: ${fireCount} contacts`);
    console.log(`🚑 Ambulance: ${ambulanceCount} contacts`);
    console.log(
      `📦 Total Emergency Directory: ${emergencyContacts.length} contacts`,
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n🎉 Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

await seedData();
