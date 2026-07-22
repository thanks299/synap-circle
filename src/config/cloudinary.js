import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let CloudinaryStorage;
try {
  const module = require("multer-storage-cloudinary");
  CloudinaryStorage = module.default || module.CloudinaryStorage || module;
} catch (error) {
  console.error("❌ Failed to load multer-storage-cloudinary:", error.message);
  throw error;
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Check if Cloudinary is configured
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.warn(
    "⚠️ Cloudinary credentials not configured. Profile picture upload will fail.",
  );
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "safewalk/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 500, height: 500, crop: "fill" },
      { quality: "auto" },
    ],
    public_id: (req, file) => {
      const userId = req.userId || "anonymous";
      return `profile_${userId}_${Date.now()}`;
    },
  },
});

// Multer middleware for profile pictures
const uploadProfilePicture = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
        ),
      );
    }
  },
}).single("profilePicture");

export { cloudinary, uploadProfilePicture };
