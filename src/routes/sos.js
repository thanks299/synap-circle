import express from "express";
import sosService from "../services/sosService.js";
import { authenticate } from "../middlewares/auth.js";
import { validate, sosValidation } from "../middlewares/validator.js";
import { sosLimiter } from "../middlewares/rateLimiter.js";
import SOSAlert from "../models/SOSAlert.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

/**
 * @swagger
 * /api/sos/trigger:
 *   post:
 *     summary: Trigger an SOS alert
 *     description: Sends an SOS alert with location to all trusted contacts and campus security
 *     tags: [SOS Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TriggerSOSRequest'
 *     responses:
 *       200:
 *         description: SOS alert triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SOSResponse'
 *       400:
 *         description: No contacts available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many SOS triggers (max 3 per 5 minutes)
 */
router.post(
  "/trigger",
  authenticate,
  sosLimiter,
  validate(sosValidation.trigger),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, locationAvailable = true, message } = req.body;
    const userId = req.userId;

    const result = await sosService.triggerSOS(userId, {
      latitude,
      longitude,
      locationAvailable,
      message,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  }),
);

/**
 * @swagger
 * /api/sos/cancel/{alertId}:
 *   post:
 *     summary: Cancel an SOS alert
 *     description: Cancels a previously sent SOS alert (within 5 minutes window)
 *     tags: [SOS Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID to cancel
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [false_alarm, resolved, user_error]
 *                 default: false_alarm
 *     responses:
 *       200:
 *         description: Alert cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 alertId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: cancelled
 *                 message:
 *                   type: string
 *       400:
 *         description: Cancellation window passed or alert cannot be cancelled
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 */
router.post(
  "/cancel/:alertId",
  authenticate,
  validate(sosValidation.cancel),
  asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const { reason = "false_alarm" } = req.body;
    const userId = req.userId;

    const result = await sosService.cancelSOS(alertId, userId, reason);

    res.status(200).json({
      success: true,
      ...result,
    });
  }),
);

/**
 * @swagger
 * /api/sos/history:
 *   get:
 *     summary: Get alert history
 *     description: Returns paginated list of all SOS alerts for the authenticated user
 *     tags: [SOS Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of alerts to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of alerts to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [sent, cancelled, failed, resolved]
 *         description: Filter by alert status
 *     responses:
 *       200:
 *         description: Alert history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlertHistory'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/history",
  authenticate,
  asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0, status } = req.query;
    const userId = req.userId;

    const result = await sosService.getAlertHistory(userId, {
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      status,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  }),
);

/**
 * @swagger
 * /api/sos/history/{alertId}:
 *   get:
 *     summary: Get a specific alert
 *     description: Returns detailed information about a specific SOS alert
 *     tags: [SOS Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 alert:
 *                   $ref: '#/components/schemas/SOSAlert'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 */
router.get(
  "/history/:alertId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const userId = req.userId;

    const alert = await sosService.getAlertById(alertId, userId);

    res.status(200).json({
      success: true,
      alert,
    });
  }),
);

/**
 * @swagger
 * /api/sos/status/{alertId}:
 *   get:
 *     summary: Get alert status
 *     description: Returns the current status of an SOS alert (for polling)
 *     tags: [SOS Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   enum: [sent, cancelled, failed, resolved]
 *                 canCancel:
 *                   type: boolean
 *                 cancellationTimeRemaining:
 *                   type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 */
router.get(
  "/status/:alertId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const userId = req.userId;

    const alert = await SOSAlert.findOne({ _id: alertId, userId }).select(
      "status createdAt updatedAt",
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    res.status(200).json({
      success: true,
      status: alert.status,
      canCancel: alert.canCancel(),
      cancellationTimeRemaining: alert.getCancellationTimeRemaining(),
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    });
  }),
);

export default router;
