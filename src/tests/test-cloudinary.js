import { cloudinary } from "./config/cloudinary.js";
import dotenv from "dotenv";

dotenv.config();

async function testCloudinary() {
  console.log("🔍 Testing Cloudinary connection...");
  console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME || "❌ Not set");
  console.log(
    "API Key:",
    process.env.CLOUDINARY_API_KEY ? "✅ Set" : "❌ Not set",
  );
  console.log(
    "API Secret:",
    process.env.CLOUDINARY_API_SECRET ? "✅ Set" : "❌ Not set",
  );

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.error("❌ Cloudinary credentials are missing!");
    console.log("Please add them to your .env file");
    return;
  }

  try {
    // Test by uploading a small test image (1x1 pixel PNG)
    const testImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    console.log("📤 Uploading test image...");

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "safewalk/test",
          public_id: "test-connection",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      uploadStream.end(testImage);
    });

    console.log("✅ Cloudinary test successful!");
    console.log("📸 Uploaded image URL:", result.secure_url);
    console.log("🆔 Public ID:", result.public_id);

    // Clean up - delete the test image
    console.log("🗑️ Deleting test image...");
    await cloudinary.uploader.destroy(result.public_id);
    console.log("✅ Test complete! Everything works!");
  } catch (error) {
    console.error("❌ Cloudinary test failed:", error.message);
    console.log("Please check your Cloudinary credentials and try again.");
  }
}

await testCloudinary();
