import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.errors.map((e: any) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }
    // Set req.body to parsed data to strip any extra fields that were not in schema
    req.body = result.data;
    next();
  };
}
