import { z } from "zod";

const todoCreatedEventSchema = z.object({
  event: z.literal("created"),
  id: z.uuid(),
  text: z.string().trim().min(1).max(140),
});

const todoUpdatedEventSchema = z.object({
  event: z.literal("updated"),
  id: z.uuid(),
  text: z.string().trim().min(1).max(140),
  completed: z.boolean(),
});

export const todoEventSchema = z.discriminatedUnion("event", [
  todoCreatedEventSchema,
  todoUpdatedEventSchema,
]);

export type TodoEvent = z.infer<typeof todoEventSchema>;
