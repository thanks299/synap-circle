// Mock email service for testing
const mockEmailService = {
  sendOTP: jest.fn().mockResolvedValue({
    success: true,
    message: "OTP sent successfully via email",
    otpId: "mock-otp-id",
    development_otp: "123456",
  }),
  verifyOTP: jest.fn().mockImplementation(async (phoneNumber, otpCode) => {
    // Accept any OTP code for testing
    const User = (await import("../../models/User.js")).default;
    let user = await User.findOne({ phoneNumber });

    if (!user) {
      user = await User.create({
        phoneNumber,
        isVerified: true,
        email: "test@campus.edu",
      });
    }

    return {
      success: true,
      user,
      message: "OTP verified successfully",
    };
  }),
  resendOTP: jest.fn().mockResolvedValue({
    success: true,
    message: "OTP resent successfully",
    otpId: "mock-otp-id",
    development_otp: "654321",
  }),
  sendSOSAlert: jest.fn().mockResolvedValue({
    success: true,
    messageId: "mock-message-id",
    recipients: ["test@example.com"],
  }),
  sendBulkSOSAlerts: jest.fn().mockResolvedValue([
    {
      contact: { email: "test@example.com" },
      success: true,
      messageId: "mock-message-id",
    },
  ]),
};

export default mockEmailService;
