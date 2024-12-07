import { z } from "zod";

export const userSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  theme: z.string().optional()
});

export type User = z.infer<typeof userSchema>;

export type UpdateUserData = Pick<User, "id" | "firstName" | "lastName" | "email" | "isAdmin">;
