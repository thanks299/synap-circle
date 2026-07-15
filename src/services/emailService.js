import brevo from "@getbrevo/brevo";
import crypto from "node:crypto";
import OTP from "../models/OTP.js";
import User from "../models/User.js";
import { logger } from "../utils/logger.js";
import config from "../utils/config.js";

class EmailService {
  constructor() {
    // Initialize Brevo
    this.apiInstance = new brevo.TransactionalEmailsApi();
    this.apiKey = brevo.ApiClient.instance.authentications["api-key"];
    this.apiKey.apiKey = config.brevo.apiKey;

    this.senderName = config.brevo.fromName;
    this.fromEmail = config.brevo.fromEmail;
  }

  /**
   * Generate a random 6-digit OTP using crypto for better security
   */
  generateOTP() {
    const otp = crypto.randomInt(100000, 999999);
    return otp.toString();
  }

  /**
   * Send OTP via Email
   */
  async sendOTP(email, phoneNumber, purpose = "signup") {
    try {
      const otpCode = this.generateOTP();
      const expiresAt = new Date(
        Date.now() + config.otpExpiryMinutes * 60 * 1000,
      );

      /**
       * Create the OTP record up-front, before branching on test vs. live
       *  sending. Previously this only happened inside the test branch,
       * which meant the live (Brevo) branch referenced an `otp` variable
       * that was never defined — a guaranteed ReferenceError the first time
       *  a real email was sent in production.
       */
      await OTP.create({
        phoneNumber,
        email,
        otpCode,
        expiresAt,
        purpose,
        isUsed: false,
      });

      if (config.isTest && config.disableEmailSending === true) {
        if (config.isDevelopment) {
          console.log(`📧 [TEST] OTP for ${email}: ${otpCode}`);
        }

        return {
          success: true,
          message: "OTP sent successfully to your email",
          development_otp: otpCode,
        };
      }

      // Send email via Brevo
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = "SafeWalk Campus - Your OTP Code";
      sendSmtpEmail.htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0; }
            .container { max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #ff4444; }
            .subtitle { color: #666; font-size: 16px; margin-top: 5px; }
            .otp-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; }
            .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', monospace; }
            .info { background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .info p { margin: 5px 0; color: #555; }
            .warning { color: #ff9800; font-size: 14px; text-align: center; margin-top: 20px; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ SafeWalk Campus</div>
              <div class="subtitle">Your Security is Our Priority</div>
            </div>
            
            <h2 style="text-align: center; color: #333; margin-bottom: 10px;">Verification Code</h2>
            <p style="text-align: center; color: #666; margin-bottom: 20px;">Use the following OTP to verify your account:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
            </div>
            
            <div class="info">
              <p><strong>📱 Phone:</strong> ${phoneNumber}</p>
              <p><strong>⏰ Expires in:</strong> ${config.otpExpiryMinutes} minutes</p>
            </div>
            
            <p style="text-align: center; color: #666;">If you didn't request this code, please ignore this email.</p>
            <div class="warning">⚠️ Never share this OTP with anyone</div>
            
            <div class="footer">
              <p>SafeWalk Campus - Emergency Alert System</p>
              <p>This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      sendSmtpEmail.textContent = `
        SafeWalk Campus - Verification Code
        
        Your OTP code is: ${otpCode}
        
        Phone: ${phoneNumber}
        Expires in: ${config.otpExpiryMinutes} minutes
        
        If you didn't request this, please ignore this email.
        Never share this OTP with anyone.
        
        SafeWalk Campus - Emergency Alert System
        This is an automated message. Please do not reply.
      `;
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.fromEmail,
      };
      sendSmtpEmail.to = [{ email, name: phoneNumber }];
      sendSmtpEmail.replyTo = {
        email: this.fromEmail,
        name: "SafeWalk Campus Support",
      };

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      logger.info(`OTP email sent to ${email}: ${result.messageId}`);
      if (config.isDevelopment) {
        console.log(`📧 OTP for ${email}: ${otpCode}`);
      }

      return {
        success: true,
        message: "OTP sent successfully via email",
        ...(config.isDevelopment && { development_otp: otpCode }),
      };
    } catch (error) {
      logger.error("OTP email send error:", error);
      throw new Error("Failed to send OTP via email. Please try again.");
    }
  }

  /**
   * Verify OTP using email
   */
  async verifyOTP(email, otpCode) {
    try {
      /**
       * Check the user exists FIRST. Previously this checked the OTP record
       *  first, so a nonexistent email (no OTP record either) always threw
       * "Invalid or expired OTP" and the route's 404 "User not found" branch was never reached.
       */
      const user = await User.findOne({ email });

      if (!user) {
        throw new Error("User not found");
      }

      // Find valid OTP by email
      const otp = await OTP.findOne({
        email,
        otpCode,
        isUsed: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otp) {
        throw new Error("Invalid or expired OTP");
      }

      // Mark OTP as used
      otp.isUsed = true;
      await otp.save();

      // Mark user as verified
      user.isVerified = true;
      user.lastLogin = new Date();
      await user.save();

      return {
        success: true,
        user,
        message: "OTP verified successfully",
      };
    } catch (error) {
      logger.error("OTP verification error:", error);
      throw error;
    }
  }

  /**
   * Resend OTP via Email
   */
  async resendOTP(email, phoneNumber, purpose = "signup") {
    await OTP.updateMany({ phoneNumber, isUsed: false }, { isUsed: true });
    return this.sendOTP(email, phoneNumber, purpose);
  }

  /**
   * Generate location URL
   */
  _generateLocationUrl(latitude, longitude, locationLink) {
    return (
      locationLink ||
      (latitude && longitude
        ? `https://www.google.com/maps?q=${latitude},${longitude}`
        : "Location not available")
    );
  }

  /**
   * Generate Google Maps link HTML
   */
  _generateMapsLink(latitude, longitude, locationUrl) {
    if (latitude && longitude) {
      return `<a href="${locationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0;">📍 View on Google Maps</a>`;
    }
    return '<p style="color: #ff9800;">⚠️ Location could not be determined</p>';
  }

  /**
   * Generate email subject
   */
  _generateSubject(userName, userPhone, isCancelled) {
    const displayName = userName || userPhone;
    if (isCancelled) {
      return `🚨 SOS Alert from ${displayName} - CANCELLED`;
    }
    return `🚨 SOS Alert from ${displayName}`;
  }

  /**
   * Generate email header section
   */
  _generateHeader(isCancelled) {
    return `
      <div class="header" style="background: ${isCancelled ? "#ff9800" : "#ff4444"}; color: white; padding: 30px 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">${isCancelled ? "✅ ALERT CANCELLED" : "🚨 SOS EMERGENCY ALERT"}</h1>
        <div class="sub" style="font-size: 16px; opacity: 0.9; margin-top: 8px;">${isCancelled ? "This alert has been cancelled by the user" : "Immediate attention required"}</div>
      </div>
    `;
  }

  /**
   * Generate user info section
   */
  _generateUserInfo(userName, userPhone, userEmail) {
    let html = `
      <div class="info-box" style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #ff4444;">
        <label style="font-weight: bold; color: #555; display: block; margin-bottom: 4px; font-size: 14px;">👤 User</label>
        <div class="value" style="font-size: 16px; color: #222;"><strong>${userName || "Unknown User"}</strong></div>
    `;

    if (userPhone) {
      html += `<div class="value" style="font-size: 16px; color: #222; margin-top: 4px;">📞 ${userPhone}</div>`;
    }
    if (userEmail) {
      html += `<div class="value" style="font-size: 16px; color: #222; margin-top: 4px;">✉️ ${userEmail}</div>`;
    }

    html += `</div>`;
    return html;
  }

  /**
   * Generate alert status section
   */
  _generateStatusSection(isCancelled) {
    const statusColor = isCancelled ? "#ff9800" : "#ff4444";
    let html = `
      <div class="info-box" style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid ${statusColor};">
        <label style="font-weight: bold; color: #555; display: block; margin-bottom: 4px; font-size: 14px;">⚠️ Alert Status</label>
        <div class="value" style="font-size: 16px; color: #222;">
          <span class="status-badge" style="display: inline-block; background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold;">${isCancelled ? "CANCELLED" : "ACTIVE"}</span>
        </div>
    `;

    if (!isCancelled) {
      html += `<p style="color: #d32f2f; margin-top: 8px;"><strong>⚠️ If this is a false alarm, the user can cancel it from the app.</strong></p>`;
    }

    html += `</div>`;
    return html;
  }

  /**
   * Generate location section
   */
  _generateLocationSection(latitude, longitude, mapsLink) {
    let html = `
      <div class="alert-box" style="background: #ffebee; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #c62828;">📍 Location Information</h3>
        ${mapsLink}
    `;

    if (latitude && longitude) {
      html += `
        <p style="margin-top: 8px; font-size: 14px; color: #666;">
          Coordinates: ${latitude}, ${longitude}
        </p>
      `;
    } else {
      html +=
        '<p style="color: #ff9800;">⚠️ Location could not be determined</p>';
    }

    html += `</div>`;
    return html;
  }

  /**
   * Generate recipients section
   */
  _generateRecipientsSection(contacts) {
    const recipientItems = contacts
      .map(
        (c) => `
        <div class="recipient" style="padding: 5px 0; border-bottom: 1px solid #e0e0e0;">
          <strong>${c.name || "Unknown"}</strong>
          <span style="color: #666; font-size: 14px;">(${c.relationship || c.type || "Contact"})</span>
        </div>
      `,
      )
      .join("");

    return `
      <div class="recipients" style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <h4 style="margin-top: 0;">📨 This alert was sent to:</h4>
        ${recipientItems}
      </div>
    `;
  }

  /**
   * Generate action buttons
   */
  _generateActions(isCancelled, userPhone, locationUrl) {
    let html = `<div class="actions" style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">`;

    if (!isCancelled && userPhone) {
      html += `
        <a href="tel:${userPhone}" class="action-button action-call" style="flex: 1; min-width: 120px; padding: 10px 20px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; text-align: center; text-decoration: none; display: inline-block; background: #4CAF50; color: white;">📞 Call User</a>
      `;
    }

    html += `
      <a href="${locationUrl}" target="_blank" class="action-button action-sms" style="flex: 1; min-width: 120px; padding: 10px 20px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; text-align: center; text-decoration: none; display: inline-block; background: #2196F3; color: white;">📍 View Location</a>
    </div>`;

    return html;
  }

  /**
   * Generate footer
   */
  _generateFooter(alertId) {
    return `
      <div class="footer" style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0;">SafeWalk Campus - Emergency Alert System</p>
        <p style="margin: 5px 0 0; font-size: 12px;">Alert ID: ${alertId || "N/A"}</p>
        <p style="margin: 5px 0 0; font-size: 12px;">This is an automated message from SafeWalk Campus. Please do not reply.</p>
      </div>
    `;
  }

  /**
   * Build complete HTML email
   */
  _buildAlertEmailHTML(alertData) {
    const {
      userName,
      userPhone,
      userEmail,
      latitude,
      longitude,
      locationLink,
      contacts,
      alertId,
      isCancelled = false,
      timestamp,
    } = alertData;

    const locationUrl = this._generateLocationUrl(
      latitude,
      longitude,
      locationLink,
    );
    const mapsLink = this._generateMapsLink(latitude, longitude, locationUrl);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
          .content { padding: 30px 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          ${this._generateHeader(isCancelled)}
          <div class="content">
            ${this._generateStatusSection(isCancelled)}
            ${this._generateUserInfo(userName, userPhone, userEmail)}
            <div class="info-box" style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #ff4444;">
              <label style="font-weight: bold; color: #555; display: block; margin-bottom: 4px; font-size: 14px;">🕐 Time</label>
              <div class="value" style="font-size: 16px; color: #222;">${timestamp || new Date().toLocaleString()}</div>
            </div>
            ${this._generateLocationSection(latitude, longitude, mapsLink)}
            ${this._generateRecipientsSection(contacts)}
            ${this._generateActions(isCancelled, userPhone, locationUrl)}
          </div>
          ${this._generateFooter(alertId)}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build plain text alert email
   */
  _buildAlertPlainText(alertData) {
    const {
      userName,
      userPhone,
      userEmail,
      latitude,
      longitude,
      locationLink,
      contacts,
      alertId,
      isCancelled = false,
      timestamp,
    } = alertData;

    const locationUrl = this._generateLocationUrl(
      latitude,
      longitude,
      locationLink,
    );
    const statusText = isCancelled
      ? "✅ ALERT CANCELLED"
      : "🚨 SOS EMERGENCY ALERT";
    const statusMsg = isCancelled
      ? "This alert has been cancelled by the user"
      : "Immediate attention required";

    return `
      ${statusText}
      ${statusMsg}
      
      ${userName ? `User: ${userName}` : ""}
      ${userPhone ? `Phone: ${userPhone}` : ""}
      ${userEmail ? `Email: ${userEmail}` : ""}
      Time: ${timestamp || new Date().toLocaleString()}
      
      Location: ${locationUrl}
      ${latitude && longitude ? `Coordinates: ${latitude}, ${longitude}` : "Location not available"}
      
      This alert was sent to:
      ${contacts.map((c) => `- ${c.name} (${c.relationship || "Contact"})`).join("\n")}
      
      ${isCancelled ? "" : "⚠️ If this is a false alarm, the user can cancel it from the app."}
      
      ---
      SafeWalk Campus - Emergency Alert System
      Alert ID: ${alertId || "N/A"}
      This is an automated message. Please do not reply.
    `.trim();
  }

  /**
   * Send SOS alert email to a single recipient
   */
  async sendSOSAlert(alertData) {
    if (config.isTest && config.disableEmailSending) {
      const { contacts } = alertData;
      return {
        success: true,
        messageId: "test-message-id",
        recipients: contacts.map((c) => c.email),
      };
    }
    try {
      const { contacts, isCancelled = false, userName, userPhone } = alertData;

      const recipients = contacts.map((contact) => ({
        email: contact.email,
        name: contact.name || contact.email,
      }));

      const subject = this._generateSubject(userName, userPhone, isCancelled);
      const htmlContent = this._buildAlertEmailHTML(alertData);
      const textContent = this._buildAlertPlainText(alertData);

      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.textContent = textContent;
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.fromEmail,
      };
      sendSmtpEmail.to = recipients;
      sendSmtpEmail.replyTo = {
        email: this.fromEmail,
        name: "SafeWalk Campus Support",
      };

      const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      logger.info(`Alert email sent successfully: ${response.messageId}`);

      return {
        success: true,
        messageId: response.messageId,
        recipients: recipients.map((r) => r.email),
      };
    } catch (error) {
      logger.error("Alert email send error:", error);
      throw new Error(`Failed to send alert email: ${error.message}`);
    }
  }

  /**
   * Send bulk SOS alerts to multiple recipients
   */
  async sendBulkSOSAlerts(alertData) {
    try {
      const { contacts, ...baseData } = alertData;

      const results = [];
      for (const contact of contacts) {
        try {
          const result = await this.sendSOSAlert({
            ...baseData,
            contacts: [contact],
          });
          results.push({
            contact,
            success: true,
            messageId: result.messageId,
          });
        } catch (error) {
          results.push({
            contact,
            success: false,
            error: error.message,
          });
        }
      }
      return results;
    } catch (error) {
      logger.error("Bulk alert email send error:", error);
      throw error;
    }
  }

  /**
   * Send password reset OTP via Email
   */
  async sendPasswordResetOTP(email, phoneNumber, userName) {
    try {
      const otpCode = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Create OTP record for password reset
      const otp = await OTP.create({
        phoneNumber,
        email,
        otpCode,
        expiresAt,
        purpose: "reset_password",
        isPasswordReset: true,
        isUsed: false,
      });

      if (config.isTest && config.disableEmailSending) {
        console.log(`📧 [TEST] Password Reset OTP for ${email}: ${otpCode}`);
        return {
          success: true,
          message: "Password reset OTP sent successfully",
          development_otp: otpCode,
          resetId: otp._id,
        };
      }

      // Send email via Brevo
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = "SafeWalk Campus - Password Reset";
      sendSmtpEmail.htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0; }
            .container { max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #ff4444; }
            .subtitle { color: #666; font-size: 16px; margin-top: 5px; }
            .otp-box { background: linear-gradient(135deg, #ff6b6b 0%, #c0392b 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; }
            .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', monospace; }
            .info { background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .info p { margin: 5px 0; color: #555; }
            .warning { color: #ff9800; font-size: 14px; text-align: center; margin-top: 20px; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px; }
            .user-name { color: #333; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ SafeWalk Campus</div>
              <div class="subtitle">Password Reset</div>
            </div>
            
            <h2 style="text-align: center; color: #333; margin-bottom: 10px;">Reset Your Password</h2>
            ${userName ? `<p style="text-align: center; color: #666; margin-bottom: 20px;">Hello <span class="user-name">${userName}</span>,</p>` : ""}
            <p style="text-align: center; color: #666; margin-bottom: 20px;">We received a request to reset your password. Use the following OTP to verify your identity:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
            </div>
            
            <div class="info">
              <p><strong>📱 Phone:</strong> ${phoneNumber}</p>
              <p><strong>⏰ Expires in:</strong> 10 minutes</p>
              <p><strong>🔐 Purpose:</strong> Password Reset</p>
            </div>
            
            <p style="text-align: center; color: #666;">If you didn't request a password reset, please ignore this email or contact support.</p>
            <div class="warning">⚠️ Never share this OTP with anyone</div>
            
            <div class="footer">
              <p>SafeWalk Campus - Emergency Alert System</p>
              <p>This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      sendSmtpEmail.textContent = `
        SafeWalk Campus - Password Reset

        ${userName ? `Hello ${userName},` : ""}

        We received a request to reset your password. Your OTP code is: ${otpCode}

        Phone: ${phoneNumber}
        Expires in: 10 minutes
        Purpose: Password Reset

        If you didn't request a password reset, please ignore this email.
        Never share this OTP with anyone.

        SafeWalk Campus - Emergency Alert System
        This is an automated message. Please do not reply.
      `;
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.fromEmail,
      };
      sendSmtpEmail.to = [{ email, name: userName || phoneNumber }];
      sendSmtpEmail.replyTo = {
        email: this.fromEmail,
        name: "SafeWalk Campus Support",
      };

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      logger.info(`Password reset OTP sent to ${email}: ${result.messageId}`);
      console.log(`📧 Password Reset OTP for ${email}: ${otpCode}`);

      return {
        success: true,
        message: "Password reset OTP sent successfully",
        development_otp: otpCode,
        resetId: otp._id,
      };
    } catch (error) {
      logger.error("Password reset OTP send error:", error);
      throw new Error("Failed to send password reset OTP. Please try again.");
    }
  }

  /**
   * Verify password reset OTP
   */
  async verifyPasswordResetOTP(email, otpCode) {
    try {
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error("User not found");
      }

      // Find valid reset OTP
      const otp = await OTP.findOne({
        email,
        otpCode,
        purpose: "reset_password",
        isUsed: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otp) {
        // Check if OTP exists but is expired
        const expiredOTP = await OTP.findOne({
          email,
          otpCode,
          purpose: "reset_password",
          isUsed: false,
        });

        if (expiredOTP && expiredOTP.expiresAt <= new Date()) {
          throw new Error("OTP has expired. Please request a new one.");
        }

        throw new Error("Invalid or expired OTP");
      }

      // Mark OTP as used
      otp.isUsed = true;
      await otp.save();

      // Invalidate any other reset OTPs for this user
      await OTP.updateMany(
        {
          email,
          purpose: "reset_password",
          isUsed: false,
          _id: { $ne: otp._id },
        },
        { isUsed: true },
      );

      return {
        success: true,
        user,
        resetId: otp._id,
        message: "OTP verified successfully",
      };
    } catch (error) {
      logger.error("Password reset OTP verification error:", error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user) {
    try {
      if (config.isTest && config.disableEmailSending) {
        console.log(`📧 [TEST] Welcome email to ${user.email}`);
        return {
          success: true,
          message: "Welcome email sent (test mode)",
        };
      }

      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = "🎉 Welcome to SafeWalk Campus!";
      sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #ff4444; }
          .subtitle { color: #666; font-size: 16px; margin-top: 5px; }
          .welcome-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; color: white; }
          .welcome-box h2 { margin: 0; font-size: 24px; }
          .features { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .feature-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .feature-item:last-child { border-bottom: none; }
          .feature-icon { font-size: 24px; margin-right: 15px; width: 40px; text-align: center; }
          .feature-text { flex: 1; }
          .feature-text h4 { margin: 0; color: #333; }
          .feature-text p { margin: 5px 0 0; color: #666; font-size: 14px; }
          .cta-button { display: inline-block; background-color: #ff4444; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px; }
          .highlight { color: #ff4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🛡️ SafeWalk Campus</div>
            <div class="subtitle">Your Security is Our Priority</div>
          </div>
          
          <div class="welcome-box">
            <h2>👋 Welcome ${user.name || user.phoneNumber}!</h2>
            <p style="margin: 10px 0 0; opacity: 0.9;">Your campus safety journey begins now</p>
          </div>
          
          <h3 style="color: #333; text-align: center;">Here's what you can do:</h3>
          
          <div class="features">
            <div class="feature-item">
              <div class="feature-icon">🚨</div>
              <div class="feature-text">
                <h4>SOS Panic Button</h4>
                <p>Instantly alert your trusted contacts and campus security with your live location</p>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">👥</div>
              <div class="feature-text">
                <h4>Trusted Contacts</h4>
                <p>Add up to ${config.maxTrustedContacts} trusted contacts to receive your SOS alerts</p>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📍</div>
              <div class="feature-text">
                <h4>Live Location Sharing</h4>
                <p>Share your real-time location during emergencies</p>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🏥</div>
              <div class="feature-text">
                <h4>Emergency Directory</h4>
                <p>Access campus security, hospitals, police, and other emergency contacts</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <p style="color: #666;"><strong>Next Steps:</strong></p>
            <ol style="text-align: left; display: inline-block; color: #555; padding-left: 20px;">
              <li>Complete your profile</li>
              <li>Add your trusted contacts</li>
              <li>Set up your university campus</li>
              <li>Enable location sharing</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://safewalk-campus.com/app" class="cta-button">🚀 Go to App</a>
          </div>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>💡 Tip:</strong> Keep your app updated and ensure location services are enabled for the best experience.
            </p>
          </div>
          
          <div class="footer">
            <p>SafeWalk Campus - Emergency Alert System</p>
            <p>This is an automated message. Please do not reply.</p>
            <p style="margin-top: 10px;">
              <span style="color: #999;">Need help? Contact support: support@safewalk-campus.com</span>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
      sendSmtpEmail.textContent = `
      Welcome to SafeWalk Campus!

      Hello ${user.name || user.phoneNumber},

      Your campus safety journey begins now! Here's what you can do:

      1. SOS Panic Button - Instantly alert your trusted contacts and campus security with your live location
      2. Trusted Contacts - Add up to ${config.maxTrustedContacts} trusted contacts to receive your SOS alerts
      3. Live Location Sharing - Share your real-time location during emergencies
      4. Emergency Directory - Access campus security, hospitals, police, and other emergency contacts

      Next Steps:
      - Complete your profile
      - Add your trusted contacts
      - Set up your university campus
      - Enable location sharing

      💡 Tip: Keep your app updated and ensure location services are enabled for the best experience.

      ---
      SafeWalk Campus - Emergency Alert System
      This is an automated message. Please do not reply.
      Need help? Contact support: support@safewalk-campus.com
    `;
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.fromEmail,
      };
      sendSmtpEmail.to = [
        { email: user.email, name: user.name || user.phoneNumber },
      ];
      sendSmtpEmail.replyTo = {
        email: this.fromEmail,
        name: "SafeWalk Campus Support",
      };

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      logger.info(`Welcome email sent to ${user.email}: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
        message: "Welcome email sent successfully",
      };
    } catch (error) {
      logger.error("Welcome email send error:", error);
      // Don't throw - welcome email failure shouldn't block signup
      return {
        success: false,
        message: "Failed to send welcome email",
        error: error.message,
      };
    }
  }

  /**
   * Send onboarding completion email
   */
  async sendOnboardingCompleteEmail(user) {
    try {
      if (config.isTest && config.disableEmailSending) {
        console.log(`📧 [TEST] Onboarding complete email to ${user.email}`);
        return {
          success: true,
          message: "Onboarding complete email sent (test mode)",
        };
      }

      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = "🎉 You're Ready to Go! - SafeWalk Campus";
      sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #4CAF50; }
          .subtitle { color: #666; font-size: 16px; margin-top: 5px; }
          .complete-box { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; color: white; }
          .complete-box h2 { margin: 0; font-size: 24px; }
          .features { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .feature-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .feature-item:last-child { border-bottom: none; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">✅ SafeWalk Campus</div>
            <div class="subtitle">Your Account is Ready for Action</div>
          </div>
          
          <div class="complete-box">
            <h2>🎉 Setup Complete!</h2>
            <p style="margin: 10px 0 0; opacity: 0.9;">You're all set to use SafeWalk Campus</p>
          </div>
          
          <h3 style="color: #333; text-align: center;">You can now:</h3>
          
          <div class="features">
            <div class="feature-item">
              <span style="font-size: 24px; margin-right: 15px;">🚨</span>
              <div>
                <h4 style="margin: 0; color: #333;">Trigger SOS Alerts</h4>
                <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Instantly alert your trusted contacts and campus security</p>
              </div>
            </div>
            <div class="feature-item">
              <span style="font-size: 24px; margin-right: 15px;">📍</span>
              <div>
                <h4 style="margin: 0; color: #333;">Share Live Location</h4>
                <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Your location is shared automatically during emergencies</p>
              </div>
            </div>
            <div class="feature-item">
              <span style="font-size: 24px; margin-right: 15px;">🏥</span>
              <div>
                <h4 style="margin: 0; color: #333;">Access Emergency Directory</h4>
                <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Quick access to campus security, hospitals, and police</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #666;">Stay safe! The SafeWalk Campus team is here for you.</p>
          </div>
          
          <div class="footer">
            <p>SafeWalk Campus - Emergency Alert System</p>
            <p>This is an automated message. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
      sendSmtpEmail.textContent = `
      ✅ Setup Complete!

      You're all set to use SafeWalk Campus!

      You can now:
      1. Trigger SOS Alerts - Instantly alert your trusted contacts and campus security
      2. Share Live Location - Your location is shared automatically during emergencies
      3. Access Emergency Directory - Quick access to campus security, hospitals, and police

      Stay safe! The SafeWalk Campus team is here for you.

      ---
      SafeWalk Campus - Emergency Alert System
      This is an automated message. Please do not reply.
    `;
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.fromEmail,
      };
      sendSmtpEmail.to = [
        { email: user.email, name: user.name || user.phoneNumber },
      ];
      sendSmtpEmail.replyTo = {
        email: this.fromEmail,
        name: "SafeWalk Campus Support",
      };

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      logger.info(
        `Onboarding complete email sent to ${user.email}: ${result.messageId}`,
      );

      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error("Onboarding complete email error:", error);
      return {
        success: false,
        message: "Failed to send onboarding complete email",
      };
    }
  }
}

export default new EmailService();
