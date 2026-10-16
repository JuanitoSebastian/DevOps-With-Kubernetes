import { z } from "zod";

export const todoSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  completed: z.boolean(),
  completed_at: z.string().nullable(),
});

export const createTodoSchema = z.object({
  text: z.string().trim().min(1).max(140),
});

export const updateTodoSchema = z.object({
  completed: z.boolean(),
});

export type Todo = z.infer<typeof todoSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
