import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: "admin" | "teacher" | "parent";
    teacherId: number | null;
  }
}
