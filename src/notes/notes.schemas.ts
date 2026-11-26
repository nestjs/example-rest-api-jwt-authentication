import { z } from 'zod';

const title = z.string().trim().min(1).max(200);
const body = z.string().max(10_000);

export const createNoteSchema = z.object({ title, body: body.default('') });
export type CreateNoteDto = z.infer<typeof createNoteSchema>;

// Every field optional, none nullable: a null title is a 400.
// Not createNoteSchema.partial(): the default would reset `body` on every update.
export const updateNoteSchema = z.object({ title, body }).partial();
export type UpdateNoteDto = z.infer<typeof updateNoteSchema>;

export const listNotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
