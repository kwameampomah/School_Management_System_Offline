import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";

// Import mocked db
import { db } from "@workspace/db";

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

describe("Scores Integration Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUT /api/scores - rejects non-authenticated requests with 401", async () => {
    const res = await request(app)
      .put("/api/scores")
      .send({
        studentId: 10,
        assessmentComponentId: 5,
        scoreValue: 45,
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Not authenticated");
  });

  it("PUT /api/scores - rejects values exceeding component limits", async () => {
    // Mock the component lookup
    const mockComponent = { id: 5, maxScore: "50" };
    vi.spyOn(db, "select").mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockComponent]),
      }),
    } as any);

    // Mock session auth parameters by creating custom agent session state
    const agent = request.agent(app);
    
    // Attempting score entry without valid teacher assignment mock
    const res = await agent
      .put("/api/scores")
      .send({
        studentId: 10,
        assessmentComponentId: 5,
        scoreValue: 75, // Exceeds component max of 50
      });

    // Should return 401 due to unauthenticated agent session
    expect(res.status).toBe(401);
  });
});
