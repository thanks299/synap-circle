import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SafeWalk Campus API",
      version: "1.0.0",
      description: [
        "SafeWalk Campus - One-tap Panic Button Application API.",
        "A platform that lets students and campus residents alert their trusted contacts and campus security with their live location the moment they feel unsafe.",
      ].join(" "),
      license: {
        name: "MIT",
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and OTP verification via email",
      },
      {
        name: "Contacts",
        description: "Trusted contacts management (max 3 contacts)",
      },
      {
        name: "SOS Alerts",
        description: "SOS alert triggering, cancellation, and history",
      },
      {
        name: "Emergency Directory",
        description: "Emergency contacts and campus security directory",
      },
      {
        name: "Health",
        description: "API health check and status",
      },
    ],
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local Development Server",
      },
      {
        url: "https://synap-circle.onrender.com",
        description: "Production Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token to authenticate",
        },
      },
      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
            },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Validation failed",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: {
                    type: "string",
                  },
                  message: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
            },
            phoneNumber: {
              type: "string",
              example: "+1234567890",
            },
            email: {
              type: "string",
              format: "email",
              example: "student@campus.edu",
            },
            name: {
              type: "string",
              example: "John Doe",
            },
            isVerified: {
              type: "boolean",
              example: true,
            },
            trustedContactsCount: {
              type: "integer",
              example: 2,
            },
            maxContacts: {
              type: "integer",
              example: 3,
            },
          },
        },
        SignupRequest: {
          type: "object",
          required: ["email", "phoneNumber"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "student@campus.edu",
            },
            phoneNumber: {
              type: "string",
              pattern: String.raw`^\+?[1-9]\d{1,14}$`,
              example: "+1234567890",
            },
            name: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              example: "John Doe",
            },
          },
        },
        VerifyOTPRequest: {
          type: "object",
          required: ["phoneNumber", "otpCode"],
          properties: {
            phoneNumber: {
              type: "string",
              example: "+1234567890",
            },
            otpCode: {
              type: "string",
              minLength: 6,
              maxLength: 6,
              pattern: String.raw`^\d{6}$`,
              example: "123456",
            },
          },
        },
        ResendOTPRequest: {
          type: "object",
          required: ["phoneNumber"],
          properties: {
            phoneNumber: {
              type: "string",
              example: "+1234567890",
            },
          },
        },
        ForgotPasswordRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "student@campus.edu",
            },
          },
        },
        VerifyResetOTPRequest: {
          type: "object",
          required: ["email", "otpCode"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "student@campus.edu",
            },
            otpCode: {
              type: "string",
              example: "123456",
            },
          },
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["resetToken", "newPassword", "confirmPassword"],
          properties: {
            resetToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIs...",
            },
            newPassword: {
              type: "string",
              minLength: 8,
              example: "NewPassword123",
            },
            confirmPassword: {
              type: "string",
              example: "NewPassword123",
            },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword", "confirmPassword"],
          properties: {
            currentPassword: {
              type: "string",
              example: "OldPassword123",
            },
            newPassword: {
              type: "string",
              minLength: 8,
              example: "NewPassword456",
            },
            confirmPassword: {
              type: "string",
              example: "NewPassword456",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "OTP verified successfully",
            },
            development_otp: {
              type: "string",
              example: "123456",
              description:
                "⚠️ ONLY AVAILABLE IN DEVELOPMENT/TEST ENVIRONMENTS. Never exposed in production.",
            },
            token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIs...",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
        },

        // Contact Schemas
        TrustedContact: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
            },
            name: {
              type: "string",
              example: "Jane Smith",
            },
            phoneNumber: {
              type: "string",
              example: "+1234567891",
            },
            email: {
              type: "string",
              format: "email",
              example: "jane@example.com",
            },
            relationship: {
              type: "string",
              enum: [
                "parent",
                "sibling",
                "friend",
                "roommate",
                "partner",
                "other",
              ],
              example: "friend",
            },
            isPrimary: {
              type: "boolean",
              example: false,
            },
            isActive: {
              type: "boolean",
              example: true,
            },
          },
        },
        CreateContactRequest: {
          type: "object",
          required: ["name", "phoneNumber", "email", "relationship"],
          properties: {
            name: {
              type: "string",
              example: "Jane Smith",
            },
            phoneNumber: {
              type: "string",
              pattern: String.raw`^\+?[1-9]\d{1,14}$`,
              example: "+1234567891",
            },
            email: {
              type: "string",
              format: "email",
              example: "jane@example.com",
            },
            relationship: {
              type: "string",
              enum: [
                "parent",
                "sibling",
                "friend",
                "roommate",
                "partner",
                "other",
              ],
              example: "friend",
            },
          },
        },
        ContactsResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            contacts: {
              type: "array",
              items: {
                $ref: "#/components/schemas/TrustedContact",
              },
            },
            count: {
              type: "integer",
              example: 2,
            },
            maxContacts: {
              type: "integer",
              example: 3,
            },
            canAddMore: {
              type: "boolean",
              example: true,
            },
          },
        },

        // Campus Security
        CampusSecurity: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            name: {
              type: "string",
              example: "Campus Security Main Desk",
            },
            phoneNumber: {
              type: "string",
              example: "+1234567890",
            },
            email: {
              type: "string",
              example: "security@campus.edu",
            },
            location: {
              type: "string",
              example: "Main Building, Ground Floor",
            },
            isPrimary: {
              type: "boolean",
              example: true,
            },
            operatingHours: {
              type: "string",
              example: "24/7",
            },
          },
        },

        // Emergency Directory
        EmergencyContact: {
          type: "object",
          properties: {
            id: {
              type: "string",
            },
            type: {
              type: "string",
              enum: ["security", "hospital", "police", "ambulance", "fire"],
              example: "hospital",
            },
            name: {
              type: "string",
              example: "University Health Center",
            },
            phoneNumber: {
              type: "string",
              example: "+1234567893",
            },
            address: {
              type: "string",
              example: "Health Center Building, Campus",
            },
            isVerified: {
              type: "boolean",
              example: true,
            },
            description: {
              type: "string",
              example: "Campus Health Services",
            },
            operatingHours: {
              type: "string",
              example: "8:00 AM - 8:00 PM",
            },
          },
        },
        EmergencyDirectoryResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            total: {
              type: "integer",
              example: 6,
            },
            contacts: {
              type: "array",
              items: {
                $ref: "#/components/schemas/EmergencyContact",
              },
            },
            grouped: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/EmergencyContact",
                },
              },
            },
          },
        },

        // SOS Alert Schemas
        TriggerSOSRequest: {
          type: "object",
          properties: {
            latitude: {
              type: "number",
              example: 37.7749,
              description: "Current latitude of the user",
            },
            longitude: {
              type: "number",
              example: -122.4194,
              description: "Current longitude of the user",
            },
            locationAvailable: {
              type: "boolean",
              example: true,
              description: "Whether location was successfully captured",
            },
          },
        },
        SOSAlert: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
            },
            status: {
              type: "string",
              enum: ["sent", "cancelled", "failed", "resolved"],
              example: "sent",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-15T10:30:00Z",
            },
            location: {
              type: "object",
              properties: {
                latitude: {
                  type: "number",
                  example: 37.7749,
                },
                longitude: {
                  type: "number",
                  example: -122.4194,
                },
                available: {
                  type: "boolean",
                  example: true,
                },
              },
            },
            locationLink: {
              type: "string",
              example: "https://www.google.com/maps?q=37.7749,-122.4194",
            },
            contactsNotified: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                  },
                  email: {
                    type: "string",
                  },
                  delivered: {
                    type: "boolean",
                  },
                },
              },
            },
            canCancel: {
              type: "boolean",
              example: true,
            },
            cancellationTimeRemaining: {
              type: "number",
              example: 3.5,
              description: "Minutes remaining to cancel the alert",
            },
          },
        },
        SOSResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            alertId: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
            },
            status: {
              type: "string",
              example: "sent",
            },
            contactsNotified: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["trusted_contact", "campus_security"],
                  },
                  name: {
                    type: "string",
                  },
                  email: {
                    type: "string",
                  },
                  delivered: {
                    type: "boolean",
                  },
                },
              },
            },
            deliveredCount: {
              type: "integer",
              example: 3,
            },
            totalCount: {
              type: "integer",
              example: 4,
            },
            message: {
              type: "string",
              example: "Alert sent to 3 of 4 recipients",
            },
          },
        },
        CancelSOSRequest: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              enum: ["false_alarm", "resolved", "user_error"],
              default: "false_alarm",
            },
          },
        },
        SOSStatusResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            status: {
              type: "string",
              enum: ["sent", "cancelled", "failed", "resolved"],
              example: "sent",
            },
            canCancel: {
              type: "boolean",
              example: true,
            },
            cancellationTimeRemaining: {
              type: "number",
              example: 3.5,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },

        // History Schemas
        AlertHistory: {
          type: "object",
          properties: {
            alerts: {
              type: "array",
              items: {
                $ref: "#/components/schemas/SOSAlert",
              },
            },
            total: {
              type: "integer",
              example: 10,
            },
            offset: {
              type: "integer",
              example: 0,
            },
            limit: {
              type: "integer",
              example: 20,
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js", "./src/models/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);
export { swaggerSpec };
