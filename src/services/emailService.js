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

      // Create the OTP record
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
      sendSmtpEmail.subject =
        "[Action Required] SafeWalk Campus Security Verification Code";
      sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: #f4f6f5;
            padding: 20px;
            margin: 0;
          }
          .container {
            max-width: 500px;
            width: 100%;
            box-sizing: border-box;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.06);
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 18px;
            font-weight: 700;
            color: #0d7377;
          }
          .brand .icon {
            width: 22px;
            height: 28px;
            vertical-align: middle;
          }
          .eyebrow {
            color: #9aa1a0;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 1.5px;
            text-transform: uppercase;
          }
          .greeting {
            color: #444;
            font-size: 16px;
            margin-bottom: 15px;
          }
          .instruction {
            color: #666;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 25px;
          }
          .otp-box {
            background-color: #f2f7f6;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 25px 0;
            border: 1px solid #e3ede9;
          }
          .otp-code {
            font-size: 40px;
            font-weight: bold;
            letter-spacing: 12px;
            color: #1a1a1a;
            font-family: 'Courier New', monospace;
          }
          .expiry-text {
            color: #0d7377;
            font-size: 13px;
            font-weight: 600;
            margin-top: 14px;
          }
          .warning-text {
            color: #888;
            font-size: 14px;
            text-align: left;
            margin: 25px 0 10px 0;
          }
          .support {
            color: #666;
            font-size: 14px;
            text-align: left;
            margin: 5px 0 5px 0;
          }
          .support a {
            color: #0d7377;
            text-decoration: none;
          }
          .support a:hover {
            text-decoration: underline;
          }
          .footer {
            text-align: left;
            color: #999;
            font-size: 12px;
            margin-top: 30px;
            border-top: 1px solid #eef1f0;
            padding-top: 20px;
          }
          .footer a {
            color: #999;
            text-decoration: none;
            margin: 0 8px 0 0;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          .footer .team {
            color: #666;
            font-size: 13px;
            margin-bottom: 8px;
          }
          .footer .auto-message {
            color: #aaa;
            font-size: 11px;
          }

          @media only screen and (max-width: 480px) {
            body { padding: 12px; }
            .container { padding: 24px 20px; border-radius: 8px; }
            .header { flex-wrap: wrap; row-gap: 8px; }
            .brand { font-size: 16px; }
            .eyebrow { font-size: 10px; }
            .greeting, .instruction, .support, .warning-text { font-size: 14px; }
            .otp-box { padding: 20px 12px; }
            .otp-code { font-size: 30px; letter-spacing: 6px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand"><img src="data:image/png;base64,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" alt="SafeWalk Campus" class="icon" /> SafeWalk Campus</div>
            <div class="eyebrow">Security Verification</div>
          </div>

          <div class="greeting">
            <strong>Hi there,</strong>
          </div>

          <div class="instruction">
            Welcome to SafeWalk Campus! To complete your account registration and secure your profile, please verify your email address by using the 6-digit verification code below:
          </div>

          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
            <div class="expiry-text">This verification code will expire in ${config.otpExpiryMinutes} minutes.</div>
          </div>

          <div class="warning-text">
            If you did not request this, you can safely ignore this email. No changes have been made to your account.
          </div>

          <div class="support">
            Need help? Contact our support desk at <a href="mailto:support@safewalkcampus.edu">support@safewalkcampus.edu</a>
          </div>

          <div class="footer">
            <div class="team"><strong>The SafeWalk Campus Team</strong></div>
            <div class="auto-message">Automated system messages. Please do not reply directly to this email.</div>
            <div style="margin-top: 10px;">
              <span>© 2026 SafeWalk Campus Inc.</span>
              <a href="#">Privacy Policy</a>
              <span>|</span>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

      sendSmtpEmail.textContent = `
      SafeWalk Campus Security Verification

      Hi there,

      Welcome to SafeWalk Campus! To complete your account registration and secure your profile, please verify your email address using the 6-digit verification code below:

      Verification Code: ${otpCode}

      This verification code will expire in ${config.otpExpiryMinutes} minutes.

      If you did not request this, you can safely ignore this email. No changes have been made to your account.

      Need help? Contact our support desk at support@safewalkcampus.edu

      The SafeWalk Campus Team
      Automated system messages. Please do not reply directly to this email.

      © 2026 SafeWalk Campus Inc.
      Privacy Policy | Terms of Service
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
          .container { max-width: 600px; width: 100%; box-sizing: border-box; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
          .content { padding: 30px 20px; }

          @media only screen and (max-width: 480px) {
            body { padding: 10px; }
            .container { border-radius: 8px; }
            .content { padding: 20px 15px; }
            h1 { font-size: 22px !important; }
            .actions { flex-direction: column; }
            .action-button { min-width: 100% !important; }
          }
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
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f6f5; padding: 20px; margin: 0; }
            .container { max-width: 500px; width: 100%; box-sizing: border-box; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
            .brand { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: #0d7377; }
            .brand .icon { width: 22px; height: 28px; vertical-align: middle; }
            .eyebrow { color: #9aa1a0; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; }
            .otp-box { background-color: #f2f7f6; border: 1px solid #e3ede9; padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; }
            .otp-code { font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1a1a1a; font-family: 'Courier New', monospace; }
            .expiry-text { color: #0d7377; font-size: 13px; font-weight: 600; margin-top: 14px; }
            .info { background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .info p { margin: 5px 0; color: #555; }
            .warning { color: #b45309; font-size: 14px; margin-top: 20px; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eef1f0; padding-top: 20px; }
            .user-name { color: #333; font-weight: 600; }

            @media only screen and (max-width: 480px) {
              body { padding: 12px; }
              .container { padding: 24px 20px; border-radius: 8px; }
              .header { flex-wrap: wrap; row-gap: 8px; }
              .brand { font-size: 16px; }
              .eyebrow { font-size: 10px; }
              .otp-box { padding: 20px 12px; }
              .otp-code { font-size: 30px; letter-spacing: 6px; }
              .info { padding: 12px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="brand"><img src="data:image/png;base64,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" alt="SafeWalk Campus" class="icon" /> SafeWalk Campus</div>
              <div class="eyebrow">Password Reset</div>
            </div>

            ${userName ? `<p style="color: #666; margin-bottom: 20px;">Hello <span class="user-name">${userName}</span>,</p>` : ""}
            <p style="color: #666; margin-bottom: 20px;">We received a request to reset your password. Use the following OTP to verify your identity:</p>

            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
              <div class="expiry-text">This code will expire in 10 minutes.</div>
            </div>

            <div class="info">
              <p><strong>📱 Phone:</strong> ${phoneNumber}</p>
              <p><strong>🔐 Purpose:</strong> Password Reset</p>
            </div>

            <p style="color: #666;">If you didn't request a password reset, please ignore this email or contact support.</p>
            <div class="warning">⚠️ Never share this OTP with anyone</div>

            <div class="footer">
              <p style="margin: 0;">SafeWalk Campus - Emergency Alert System</p>
              <p style="margin: 5px 0 0;">This is an automated message. Please do not reply.</p>
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
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f6f5; padding: 20px; margin: 0; }
          .container { max-width: 600px; width: 100%; box-sizing: border-box; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
          .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
          .brand { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: #0d7377; }
          .brand .icon { width: 22px; height: 28px; vertical-align: middle; }
          .eyebrow { color: #9aa1a0; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; }
          .welcome-box { background-color: #f2f7f6; border: 1px solid #e3ede9; padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; }
          .welcome-box h2 { margin: 0; font-size: 22px; color: #0d7377; }
          .welcome-box p { color: #555; }
          .features { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .feature-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .feature-item:last-child { border-bottom: none; }
          .feature-icon { font-size: 24px; margin-right: 15px; width: 40px; text-align: center; }
          .feature-text { flex: 1; }
          .feature-text h4 { margin: 0; color: #333; }
          .feature-text p { margin: 5px 0 0; color: #666; font-size: 14px; }
          .cta-button { display: inline-block; background-color: #0d7377; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eef1f0; padding-top: 20px; }

          @media only screen and (max-width: 480px) {
            body { padding: 12px; }
            .container { padding: 24px 20px; border-radius: 8px; }
            .header { flex-wrap: wrap; row-gap: 8px; }
            .brand { font-size: 16px; }
            .eyebrow { font-size: 10px; }
            .welcome-box { padding: 20px 15px; }
            .welcome-box h2 { font-size: 19px; }
            .features { padding: 14px; }
            .feature-icon { font-size: 20px; width: 32px; margin-right: 10px; }
            .feature-text h4 { font-size: 15px; }
            .feature-text p { font-size: 13px; }
            .cta-button { display: block; width: 100%; box-sizing: border-box; padding: 14px 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand"><img src="data:image/png;base64,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" alt="SafeWalk Campus" class="icon" /> SafeWalk Campus</div>
            <div class="eyebrow">Welcome</div>
          </div>

          <div class="welcome-box">
            <h2>👋 Welcome ${user.name || user.phoneNumber}!</h2>
            <p style="margin: 10px 0 0;">Your campus safety journey begins now</p>
          </div>
          
          <h3 style="color: #333;">Here's what you can do:</h3>
          
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
          
          <div style="margin: 25px 0;">
            <p style="color: #666;"><strong>Next Steps:</strong></p>
            <ol style="color: #555; padding-left: 20px;">
              <li>Complete your profile</li>
              <li>Add your trusted contacts</li>
              <li>Set up your university campus</li>
              <li>Enable location sharing</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://safewalk-campus.com/app" class="cta-button">🚀 Go to App</a>
          </div>
          
          <div style="background: #f2f7f6; border-left: 4px solid #0d7377; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #0d7377;">
              <strong>💡 Tip:</strong> Keep your app updated and ensure location services are enabled for the best experience.
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">SafeWalk Campus - Emergency Alert System</p>
            <p style="margin: 5px 0 0;">This is an automated message. Please do not reply.</p>
            <p style="margin-top: 10px; color: #999;">Need help? Contact support: support@safewalk-campus.com</p>
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
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f6f5; padding: 20px; margin: 0; }
          .container { max-width: 600px; width: 100%; box-sizing: border-box; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
          .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
          .brand { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: #0d7377; }
          .brand .icon { width: 22px; height: 28px; vertical-align: middle; }
          .eyebrow { color: #9aa1a0; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; }
          .complete-box { background-color: #f2f7f6; border: 1px solid #e3ede9; padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; }
          .complete-box h2 { margin: 0; font-size: 22px; color: #0d7377; }
          .complete-box p { color: #555; }
          .features { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .feature-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .feature-item:last-child { border-bottom: none; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eef1f0; padding-top: 20px; }

          @media only screen and (max-width: 480px) {
            body { padding: 12px; }
            .container { padding: 24px 20px; border-radius: 8px; }
            .header { flex-wrap: wrap; row-gap: 8px; }
            .brand { font-size: 16px; }
            .eyebrow { font-size: 10px; }
            .complete-box { padding: 20px 15px; }
            .complete-box h2 { font-size: 19px; }
            .features { padding: 14px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand"><img src="data:image/png;base64,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" alt="SafeWalk Campus" class="icon" /> SafeWalk Campus</div>
            <div class="eyebrow">Setup Complete</div>
          </div>

          <div class="complete-box">
            <h2>🎉 Setup Complete!</h2>
            <p style="margin: 10px 0 0;">You're all set to use SafeWalk Campus</p>
          </div>
          
          <h3 style="color: #333;">You can now:</h3>
          
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
          
          <div style="margin: 25px 0;">
            <p style="color: #666;">Stay safe! The SafeWalk Campus team is here for you.</p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">SafeWalk Campus - Emergency Alert System</p>
            <p style="margin: 5px 0 0;">This is an automated message. Please do not reply.</p>
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
