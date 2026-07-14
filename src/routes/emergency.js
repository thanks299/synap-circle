import express from "express";
import EmergencyDirectory from "../models/EmergencyDirectory.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

/**
 * @swagger
 * /api/emergency/directory:
 *   get:
 *     summary: Get emergency directory
 *     description: Returns all verified emergency contacts (security, hospital, police, etc.)
 *     tags: [Emergency Directory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [security, hospital, police, ambulance, fire]
 *         description: Filter by emergency type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or address
 *     responses:
 *       200:
 *         description: Emergency directory retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 contacts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyContact'
 *                 grouped:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/EmergencyContact'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/directory",
  authenticate,
  asyncHandler(async (req, res) => {
    const { type, search } = req.query;

    // Build query
    const query = { isActive: true };
    if (type) query.type = type;

    // Get contacts from database
    let contacts = await EmergencyDirectory.find(query)
      .select("-__v")
      .sort({ type: 1, name: 1 });

    // Apply search filter if provided
    if (search) {
      const searchRegex = new RegExp(search, "i");
      contacts = contacts.filter(
        (contact) =>
          searchRegex.test(contact.name) ||
          searchRegex.test(contact.address) ||
          searchRegex.test(contact.description),
      );
    }

    // Group contacts by type for easier frontend display
    const grouped = contacts.reduce((acc, contact) => {
      const type = contact.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(contact);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      total: contacts.length,
      contacts,
      grouped: grouped,
    });
  }),
);

/**
 * @swagger
 * /api/emergency/directory/{id}:
 *   get:
 *     summary: Get a specific emergency contact
 *     description: Returns details of a specific emergency contact
 *     tags: [Emergency Directory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency contact ID
 *     responses:
 *       200:
 *         description: Emergency contact retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 contact:
 *                   $ref: '#/components/schemas/EmergencyContact'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Emergency contact not found
 */
router.get(
  "/directory/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const contact = await EmergencyDirectory.findOne({
      _id: id,
      isActive: true,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Emergency contact not found",
      });
    }

    res.status(200).json({
      success: true,
      contact,
    });
  }),
);

/**
 * @swagger
 * /api/emergency/nearby:
 *   get:
 *     summary: Get nearby emergency contacts
 *     description: Returns emergency contacts within a radius of the user's location
 *     tags: [Emergency Directory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Current latitude
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Current longitude
 *       - in: query
 *         name: radius
 *         schema:
 *           type: integer
 *           default: 5000
 *         description: "Search radius in meters (default 5000m = 5km)"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [security, hospital, police, ambulance, fire]
 *         description: Filter by emergency type
 *     responses:
 *       200:
 *         description: Nearby emergency contacts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 contacts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyContact'
 *       400:
 *         description: Latitude and longitude are required
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/nearby",
  authenticate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 5000, type } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Build geospatial query
    const query = {
      isActive: true,
      coordinates: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [
              Number.parseFloat(longitude),
              Number.parseFloat(latitude),
            ],
          },
          $maxDistance: Number.parseInt(radius),
        },
      },
    };

    if (type) query.type = type;

    const contacts = await EmergencyDirectory.find(query)
      .select("-__v")
      .limit(20);

    res.status(200).json({
      success: true,
      total: contacts.length,
      contacts,
    });
  }),
);

export default router;
