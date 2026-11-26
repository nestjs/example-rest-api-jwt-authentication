import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { notes, type Note } from '../database/schema.js';
import type { CreateNoteDto, ListNotesQuery, UpdateNoteDto } from './notes.schemas.js';

@Injectable()
export class NotesService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  findAll(ownerId: string, { limit, offset }: ListNotesQuery): Promise<Note[]> {
    return this.db
      .select()
      .from(notes)
      .where(eq(notes.ownerId, ownerId))
      .orderBy(desc(notes.createdAt), desc(notes.id))
      .limit(limit)
      .offset(offset);
  }

  async findOne(ownerId: string, id: string): Promise<Note> {
    const [note] = await this.db.select().from(notes).where(this.owned(ownerId, id));
    return note ?? notFound();
  }

  async create(ownerId: string, dto: CreateNoteDto): Promise<Note> {
    const [note] = await this.db
      .insert(notes)
      .values({ ...dto, ownerId })
      .returning();
    return note;
  }

  async update(ownerId: string, id: string, dto: UpdateNoteDto): Promise<Note> {
    // One conditional statement: no read-then-write window, and another
    // user's note is as missing as one that doesn't exist.
    const [note] = await this.db
      .update(notes)
      .set({ ...dto, updatedAt: new Date() })
      .where(this.owned(ownerId, id))
      .returning();
    return note ?? notFound();
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const deleted = await this.db.delete(notes).where(this.owned(ownerId, id)).returning({ id: notes.id });
    if (deleted.length === 0) {
      notFound();
    }
  }

  private owned(ownerId: string, id: string) {
    return and(eq(notes.id, id), eq(notes.ownerId, ownerId));
  }
}

function notFound(): never {
  throw new NotFoundException('Note not found');
}
