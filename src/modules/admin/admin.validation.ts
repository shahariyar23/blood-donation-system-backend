import { z } from "zod";

export const adminBulkEmailSchema = z.object({
  emails: z
    .array(z.string().email("Invalid email address"))
    .min(1, "At least one email is required")
    .max(100, "You can send email to at most 100 users at a time"),
  subject: z
    .string({ required_error: "subject is required" })
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(160, "Subject must be at most 160 characters"),
  body: z
    .string({ required_error: "body is required" })
    .trim()
    .min(5, "Email body must be at least 5 characters")
    .max(20000, "Email body is too long"),
});
