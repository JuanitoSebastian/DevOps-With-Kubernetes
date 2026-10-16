import { z } from "zod";

export const todoIdSchema = z.uuid();

export const createTodoSchema = z.object({
  text: z.string().trim().min(1).max(140),
});

export const updateTodoSchema = z.object({
  completed: z.boolean(),
});

export const todoSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  completed: z.boolean(),
});

export type TodoId = z.infer<typeof todoIdSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type Todo = z.infer<typeof todoSchema>;
