import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";

// Mocking @workspace/db to prevent real DB queries
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => Promise.resolve([])),
    orderBy: vi.fn().mockReturnThis(),
  };
  return {
    ...actual,
    db: mockDb,
  };
});

describe("Auth Integration Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/auth/login - rejects empty fields with validation errors", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({}); // Empty payload

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/auth/login - rejects malformed emails", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "not-an-email",
        password: "securepassword",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
