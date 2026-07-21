import SOSAlert from "../models/SOSAlert.js";
import TrustedContact from "../models/TrustedContact.js";
import CampusSecurity from "../models/CampusSecurity.js";
import EmergencyDirectory from "../models/EmergencyDirectory.js";
import AlertRecipient from "../models/AlertRecipient.js";
import User from "../models/User.js";
import emailService from "./emailService.js";
import { logger } from "../utils/logger.js";

class SOSService {
  /**
   * Trigger an SOS alert
   */
  async triggerSOS(userId, locationData) {
    try {
      if (!userId) {
        const error = new Error("User authentication required");
        error.statusCode = 401;
        throw error;
      }
      const {
        latitude,
        longitude,
        locationAvailable = true,
        message,
      } = locationData;

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      // Get trusted contacts
      const trustedContacts = await TrustedContact.find({
        userId,
        isActive: true,
      });

      // Get campus security contacts
      const securityContacts = await CampusSecurity.find({
        isActive: true,
      });

      // Check if there are any recipients
      if (trustedContacts.length === 0 && securityContacts.length === 0) {
        const error = new Error(
          "No contacts available. Please add trusted contacts first.",
        );
        error.statusCode = 400;
        throw error;
      }

      if (message) {
        alert.message = message;
      }

      // Generate location link
      const locationLink =
        latitude && longitude
          ? `https://www.google.com/maps?q=${latitude},${longitude}`
          : null;

      // Create alert record
      const alert = await SOSAlert.create({
        userId,
        latitude: latitude || null,
        longitude: longitude || null,
        locationAvailable,
        locationLink,
        message: message || null,
        status: "sent",
        recipients: [],
        contactsNotified: [],
      });

      // Prepare recipients
      const recipients = [];

      // Add trusted contacts
      trustedContacts.forEach((contact) => {
        recipients.push({
          type: "trusted_contact",
          recipientId: contact._id,
          email: contact.email,
          phoneNumber: contact.phoneNumber,
          name: contact.name,
          relationship: contact.relationship,
        });
      });

      // Add campus security
      securityContacts.forEach((security) => {
        recipients.push({
          type: "campus_security",
          recipientId: security._id,
          email: security.email,
          phoneNumber: security.phoneNumber,
          name: security.name,
          relationship: "campus_security",
        });
      });

      emergencyContacts.forEach((emergency) => {
        recipients.push({
          type: "emergency_directory",
          recipientId: emergency._id,
          email: emergency.email,
          phoneNumber: emergency.phoneNumber,
          name: emergency.name,
          relationship: emergency.type,
        });
      });

      // Update alert with recipients
      alert.recipients = recipients;
      await alert.save();

      // Prepare email data
      const emailData = {
        userName: user.name || user.phoneNumber,
        userPhone: user.phoneNumber,
        userEmail: user.email,
        latitude,
        longitude,
        locationLink,
        alertId: alert._id.toString(),
        isCancelled: false,
        timestamp: new Date().toISOString(),
        message: message || null,
        contacts: recipients.map((r) => ({
          email: r.email,
          name: r.name,
          relationship: r.relationship,
          type: r.type,
        })),
      };

      // Send emails
      const emailResults = await emailService.sendBulkSOSAlerts(emailData);

      // Log delivery results
      const notifications = [];
      emailResults.forEach((result, index) => {
        const recipient = recipients[index];
        notifications.push({
          type: recipient.type,
          name: recipient.name,
          email: recipient.email,
          phoneNumber: recipient.phoneNumber,
          delivered: result.success,
          deliveredAt: result.success ? new Date() : null,
          error: result.success ? null : result.error,
        });
      });

      // Update alert with notification results
      alert.contactsNotified = notifications;
      alert.emailSentAt = new Date();
      await alert.save();

      // Create alert recipient records
      const recipientPromises = recipients.map((recipient, index) => {
        return AlertRecipient.create({
          alertId: alert._id,
          userId,
          recipientType: recipient.type,
          recipientId: recipient.recipientId,
          name: recipient.name,
          email: recipient.email,
          phoneNumber: recipient.phoneNumber,
          emailStatus: emailResults[index].success ? "delivered" : "failed",
          emailSentAt: new Date(),
          emailError: emailResults[index].success
            ? null
            : emailResults[index].error,
          delivered: emailResults[index].success,
        });
      });

      await Promise.all(recipientPromises);

      // Calculate delivery stats
      const deliveredCount = notifications.filter((n) => n.delivered).length;
      const totalCount = notifications.length;

      logger.info(
        `SOS alert ${alert._id} sent to ${deliveredCount}/${totalCount} recipients`,
      );

      return {
        success: true,
        alertId: alert._id,
        status: alert.status,
        contactsNotified: notifications,
        deliveredCount,
        totalCount,
        message: `Alert sent to ${deliveredCount} of ${totalCount} recipients`,
      };
    } catch (error) {
      logger.error("SOS trigger error:", error);
      throw error;
    }
  }

  /**
   * Cancel an SOS alert
   */
  async cancelSOS(alertId, userId, reason = "false_alarm") {
    try {
      const alert = await SOSAlert.findOne({ _id: alertId, userId });

      if (!alert) {
        const error = new Error("Alert not found");
        error.statusCode = 404;
        throw error;
      }

      if (alert.status !== "sent") {
        const error = new Error(
          `Alert cannot be cancelled (status: ${alert.status})`,
        );
        error.statusCode = 400;
        throw error;
      }

      // Check cancellation window
      if (!alert.canCancel()) {
        const error = new Error("Cancellation window has passed (5 minutes)");
        error.statusCode = 400;
        throw error;
      }

      // Update alert
      alert.status = "cancelled";
      alert.cancelledAt = new Date();
      alert.cancellationReason = reason;
      await alert.save();

      // Send cancellation notification
      const user = await User.findById(userId);
      const recipients = await AlertRecipient.find({ alertId });

      if (recipients.length > 0) {
        // Prepare contacts for cancellation email
        const contacts = recipients.map((r) => ({
          email: r.email,
          name: r.name,
          relationship: r.recipientType,
          type: r.recipientType,
        }));

        const emailData = {
          userName: user.name || user.phoneNumber,
          userPhone: user.phoneNumber,
          userEmail: user.email,
          latitude: alert.latitude,
          longitude: alert.longitude,
          locationLink: alert.locationLink,
          alertId: alert._id.toString(),
          isCancelled: true,
          timestamp: new Date().toISOString(),
          contacts,
        };

        await emailService.sendBulkSOSAlerts(emailData);

        // Update recipient records
        await AlertRecipient.updateMany(
          { alertId },
          {
            delivered: true,
            emailStatus: "delivered",
          },
        );
      }

      logger.info(`SOS alert ${alertId} cancelled by user ${userId}`);

      return {
        success: true,
        alertId: alert._id,
        status: alert.status,
        message: "Alert cancelled successfully",
      };
    } catch (error) {
      logger.error("SOS cancellation error:", error);
      throw error;
    }
  }

  /**
   * Get alert history for a user
   */
  async getAlertHistory(userId, options = {}) {
    try {
      const { limit = 20, offset = 0, status } = options;

      const query = { userId };
      if (status) {
        query.status = status;
      }

      const alerts = await SOSAlert.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      const total = await SOSAlert.countDocuments(query);

      return {
        alerts: alerts.map((alert) => ({
          id: alert._id,
          status: alert.status,
          timestamp: alert.createdAt,
          location: {
            latitude: alert.latitude,
            longitude: alert.longitude,
            available: alert.locationAvailable,
          },
          locationLink: alert.locationLink,
          contactsNotified: alert.contactsNotified,
          cancelledAt: alert.cancelledAt,
          cancellationReason: alert.cancellationReason,
          recipients: alert.recipients.length,
        })),
        total,
        offset,
        limit,
      };
    } catch (error) {
      logger.error("Alert history error:", error);
      throw error;
    }
  }

  /**
   * Get a specific alert by ID
   */
  async getAlertById(alertId, userId) {
    try {
      const alert = await SOSAlert.findOne({ _id: alertId, userId });

      if (!alert) {
        const error = new Error("Alert not found");
        error.statusCode = 404;
        throw error;
      }

      return {
        id: alert._id,
        status: alert.status,
        timestamp: alert.createdAt,
        location: {
          latitude: alert.latitude,
          longitude: alert.longitude,
          available: alert.locationAvailable,
        },
        locationLink: alert.locationLink,
        contactsNotified: alert.contactsNotified,
        recipients: alert.recipients,
        cancelledAt: alert.cancelledAt,
        cancellationReason: alert.cancellationReason,
        canCancel: alert.canCancel(),
        cancellationTimeRemaining: alert.getCancellationTimeRemaining(),
      };
    } catch (error) {
      logger.error("Get alert error:", error);
      throw error;
    }
  }
}

export default new SOSService();
