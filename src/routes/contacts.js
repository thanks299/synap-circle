import express from "express";

import TrustedContact from "../models/TrustedContact.js";
import CampusSecurity from "../models/CampusSecurity.js";
import { authenticate } from "../middlewares/auth.js";
import { validate, contactValidation } from "../middlewares/validator.js";
import { contactLimiter } from "../middlewares/rateLimiter.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

const findActiveContact = (userId, contactId) => {
  return TrustedContact.findOne({
    _id: contactId,
    userId,
    isActive: true,
  });
};

const ensureUniquePhoneNumber = async (userId, contactId, phoneNumber) => {
  if (!phoneNumber) return null;
  return TrustedContact.findOne({
    userId,
    phoneNumber,
    isActive: true,
    _id: { $ne: contactId },
  });
};

const syncPrimaryContactAfterUpdate = async (
  userId,
  contactId,
  contact,
  isPrimary,
) => {
  if (isPrimary && !contact.isPrimary) {
    await TrustedContact.updateMany(
      { userId, isActive: true },
      { isPrimary: false },
    );
    contact.isPrimary = true;
    return;
  }

  if (isPrimary === false && contact.isPrimary) {
    contact.isPrimary = false;
    const otherContacts = await TrustedContact.findOne({
      userId,
      isActive: true,
      _id: { $ne: contactId },
    });
    if (otherContacts) {
      otherContacts.isPrimary = true;
      await otherContacts.save();
    }
  }
};

const syncPrimaryContactAfterDelete = async (userId, contactId) => {
  const newPrimary = await TrustedContact.findOne({
    userId,
    isActive: true,
    _id: { $ne: contactId },
  });
  if (newPrimary) {
    newPrimary.isPrimary = true;
    await newPrimary.save();
  }
};

/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Get all trusted contacts
 *     description: Returns all active trusted contacts for the authenticated user
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 contacts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TrustedContact'
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 maxContacts:
 *                   type: integer
 *                   example: 3
 *                 canAddMore:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const contacts = await TrustedContact.find({
      userId: req.userId,
      isActive: true,
    })
      .select("-__v")
      .sort({ isPrimary: -1, createdAt: 1 });

    const maxContacts = Number.parseInt(process.env.MAX_TRUSTED_CONTACTS) || 3;

    res.status(200).json({
      success: true,
      contacts,
      count: contacts.length,
      maxContacts,
      canAddMore: contacts.length < maxContacts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/contacts:
 *   post:
 *     summary: Add a new trusted contact
 *     description: Adds a new trusted contact for the authenticated user (max 3 contacts)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateContactRequest'
 *     responses:
 *       201:
 *         description: Contact added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 contact:
 *                   $ref: '#/components/schemas/TrustedContact'
 *       400:
 *         description: Max contacts reached or validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Contact already exists
 */
router.post(
  "/",
  authenticate,
  contactLimiter,
  validate(contactValidation.create),
  async (req, res, next) => {
    try {
      const { name, phoneNumber, email, relationship } = req.body;
      const userId = req.userId;

      // Check max contacts limit
      const existingContacts = await TrustedContact.countDocuments({
        userId,
        isActive: true,
      });
      const maxContacts =
        Number.parseInt(process.env.MAX_TRUSTED_CONTACTS) || 3;

      if (existingContacts >= maxContacts) {
        return res.status(400).json({
          success: false,
          message: `You can only have up to ${maxContacts} trusted contacts`,
          maxContacts,
        });
      }

      // Check if contact already exists
      const existingContact = await TrustedContact.findOne({
        userId,
        phoneNumber,
        isActive: true,
      });

      if (existingContact) {
        return res.status(409).json({
          success: false,
          message: "Contact already exists",
          contact: existingContact,
        });
      }

      // If this is the first contact, make it primary
      const isPrimary = existingContacts === 0;

      const contact = await TrustedContact.create({
        userId,
        name,
        phoneNumber,
        email,
        relationship,
        isPrimary,
      });

      logger.info(
        `New trusted contact added for user ${userId}: ${phoneNumber}`,
      );

      res.status(201).json({
        success: true,
        message: "Contact added successfully",
        contact,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/contacts/{contactId}:
 *   put:
 *     summary: Update a trusted contact
 *     description: Updates an existing trusted contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               email:
 *                 type: string
 *               relationship:
 *                 type: string
 *                 enum: [parent, sibling, friend, roommate, partner, other]
 *               isPrimary:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 contact:
 *                   $ref: '#/components/schemas/TrustedContact'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contact not found
 */
router.put(
  "/:contactId",
  authenticate,
  validate(contactValidation.update),
  async (req, res, next) => {
    try {
      const { contactId } = req.params;
      const { name, phoneNumber, email, relationship, isPrimary } = req.body;
      const userId = req.userId;

      // Find contact
      const contact = await findActiveContact(userId, contactId);

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found",
        });
      }

      // Check if phone number is being changed and if it conflicts
      if (phoneNumber && phoneNumber !== contact.phoneNumber) {
        const existingContact = await ensureUniquePhoneNumber(
          userId,
          contactId,
          phoneNumber,
        );

        if (existingContact) {
          return res.status(409).json({
            success: false,
            message: "Another contact with this phone number already exists",
          });
        }
      }

      // Update contact
      if (name) contact.name = name;
      if (phoneNumber) contact.phoneNumber = phoneNumber;
      if (email) contact.email = email;
      if (relationship) contact.relationship = relationship;

      // Handle primary contact logic
      await syncPrimaryContactAfterUpdate(
        userId,
        contactId,
        contact,
        isPrimary,
      );

      await contact.save();

      logger.info(`Contact ${contactId} updated for user ${userId}`);

      res.status(200).json({
        success: true,
        message: "Contact updated successfully",
        contact,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/contacts/{contactId}:
 *   delete:
 *     summary: Delete a trusted contact
 *     description: Soft deletes a trusted contact (sets isActive to false)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *         description: Contact ID
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contact not found
 */
router.delete("/:contactId", authenticate, async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const userId = req.userId;

    // Find contact
    const contact = await TrustedContact.findOne({
      _id: contactId,
      userId,
      isActive: true,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Soft delete
    contact.isActive = false;
    await contact.save();

    // If this was the primary contact, set a new primary
    if (contact.isPrimary) {
      await syncPrimaryContactAfterDelete(userId, contactId);
    }

    logger.info(`Contact ${contactId} deleted for user ${userId}`);

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/contacts/campus-security:
 *   get:
 *     summary: Get campus security contacts
 *     description: Returns all active campus security contacts
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campus security contacts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 securityContacts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CampusSecurity'
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.get("/campus-security", authenticate, async (req, res, next) => {
  try {
    const securityContacts = await CampusSecurity.find({
      isActive: true,
    })
      .select("-__v")
      .sort({ isPrimary: -1, name: 1 });

    res.status(200).json({
      success: true,
      securityContacts,
      count: securityContacts.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
