export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Taifa Ebenezer Prep School Management System API",
    version: "1.0.0",
    description: "API endpoints for students, teachers, classes, grading, report cards generation, and audit logging.",
  },
  servers: [
    {
      url: "/api",
      description: "Base API route",
    },
  ],
  paths: {
    "/auth/login": {
      post: {
        summary: "User authentication login",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Successful login",
          },
          400: {
            description: "Validation error",
          },
          401: {
            description: "Invalid credentials",
          },
        },
      },
    },
    "/scores": {
      put: {
        summary: "Upsert student assessment score",
        tags: ["Scores"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  studentId: { type: "integer" },
                  assessmentComponentId: { type: "integer" },
                  scoreValue: { type: "number" },
                },
                required: ["studentId", "assessmentComponentId", "scoreValue"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Score saved successfully",
          },
          400: {
            description: "Score bounds limit exceeded",
          },
          401: {
            description: "Not authenticated",
          },
        },
      },
    },
    "/report-cards/{studentId}/{termId}": {
      get: {
        summary: "Get terminal report card details",
        tags: ["Reports"],
        parameters: [
          { name: "studentId", in: "path", required: true, schema: { type: "integer" } },
          { name: "termId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Report card object returned successfully" },
          403: { description: "Teacher or Parent access blocked by scopes" },
        },
      },
    },
    "/report-cards/{studentId}/{termId}/export": {
      get: {
        summary: "Export report card as PDF binary document",
        tags: ["Reports"],
        parameters: [
          { name: "studentId", in: "path", required: true, schema: { type: "integer" } },
          { name: "termId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "PDF document streamed successfully" },
        },
      },
    },
  },
};
