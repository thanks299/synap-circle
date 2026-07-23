import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Check if credentials exist
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = !!(
  CLOUDINARY_CLOUD_NAME &&
  CLOUDINARY_API_KEY &&
  CLOUDINARY_API_SECRET
);

if (!isCloudinaryConfigured) {
  console.warn(
    "⚠️ Cloudinary credentials missing. Profile picture uploads will fail.",
  );
  console.warn("Add them to your .env file:");
  console.warn("  CLOUDINARY_CLOUD_NAME=your_cloud_name");
  console.warn("  CLOUDINARY_API_KEY=your_api_key");
  console.warn("  CLOUDINARY_API_SECRET=your_api_secret");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// Use memory storage instead of CloudinaryStorage (more reliable)
const memoryStorage = multer.memoryStorage();

// Multer middleware for profile pictures (stores in memory)
const uploadProfilePicture = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
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

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = async (buffer, options = {}) => {
  if (!isCloudinaryConfigured) {
    throw new Error(
      "Cloudinary is not configured. Please add CLOUDINARY_* environment variables.",
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "safewalk/profiles",
        transformation: options.transformation || [
          { width: 500, height: 500, crop: "fill" },
          { quality: "auto" },
        ],
        public_id: options.public_id || `profile_${Date.now()}`,
        resource_type: "image",
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(new Error(error.message || "Cloudinary upload failed"));
        } else {
          resolve(result);
        }
      },
    );
    uploadStream.end(buffer);
  });
};

/**
 * Delete a file from Cloudinary by public ID
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Cloudinary deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  if (!isCloudinaryConfigured) {
    throw new Error(
      "Cloudinary is not configured. Please add CLOUDINARY_* environment variables.",
    );
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(new Error(error.message || "Cloudinary deletion failed"));
      } else {
        resolve(result);
      }
    });
  });
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} Public ID
 */
const extractPublicIdFromUrl = (url) => {
  if (!url) return null;

  try {
    const parts = url.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    const afterUpload = parts.slice(uploadIndex + 1);
    if (/^v\d+$/.test(afterUpload[0])) afterUpload.shift();

    const publicIdWithExt = afterUpload.join("/");
    return publicIdWithExt.replace(/\.[^/.]+$/, "");
  } catch (error) {
    console.error("Failed to extract public ID from URL:", error);
    return null;
  }
};

export {
  cloudinary,
  uploadProfilePicture,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  isCloudinaryConfigured,
};
