import { z } from "zod";
// Existing workspace slugs and new UUID strings share the same TEXT keys.
export const resourceIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
