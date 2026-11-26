import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { z } from 'zod';
import {
  createNoteSchema,
  listNotesQuerySchema,
  updateNoteSchema,
  type CreateNoteDto,
  type ListNotesQuery,
  type UpdateNoteDto,
} from './notes.schemas.js';
import { NotesService } from './notes.service.js';

const noteId = { schema: z.uuid() };

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query({ schema: listNotesQuerySchema }) query: ListNotesQuery) {
    return this.notesService.findAll(userId, query);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id', noteId) id: string) {
    return this.notesService.findOne(userId, id);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body({ schema: createNoteSchema }) dto: CreateNoteDto) {
    return this.notesService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id', noteId) id: string,
    @Body({ schema: updateNoteSchema }) dto: UpdateNoteDto,
  ) {
    return this.notesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser('id') userId: string, @Param('id', noteId) id: string) {
    return this.notesService.remove(userId, id);
  }
}
