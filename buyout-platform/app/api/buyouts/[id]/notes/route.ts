import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getBuyout } from "@/lib/buyouts";

type NoteRecord = {
  id: string;
  createdAt: string;
  text: string;
  author: string;
};

function parseNotes(raw: string | null | undefined): NoteRecord[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as NoteRecord[];
  } catch {
    // Legacy free-text note — wrap as single entry
    if (raw.trim()) {
      return [{ id: "legacy", createdAt: new Date().toISOString(), text: raw.trim(), author: "Imported" }];
    }
  }

  return [];
}

function serializeNotes(notes: NoteRecord[]): string {
  return JSON.stringify(notes);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const buyout = await getBuyout(id);
    if (!buyout) {
      return NextResponse.json({ error: "Buyout not found." }, { status: 404 });
    }

    const notes = parseNotes(buyout.notes);
    return NextResponse.json({ notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    text?: string;
    author?: string;
  };

  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Note text is required." }, { status: 400 });
  }

  try {
    const buyout = await getBuyout(id);
    if (!buyout) {
      return NextResponse.json({ error: "Buyout not found." }, { status: 404 });
    }

    const existing = parseNotes(buyout.notes);
    const newNote: NoteRecord = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      text: body.text.trim(),
      author: body.author?.trim() || "Team"
    };

    const updated = [newNote, ...existing];
    const serialized = serializeNotes(updated);

    if (hasDatabaseUrl()) {
      await prisma.buyout.update({
        where: { id },
        data: { notesInternal: serialized }
      });

      await ensureEmailInfrastructure();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id", "buyoutId", "eventType", "summary", "detail", "createdBy")
         VALUES ($1, $2, 'NOTE_ADDED', $3, $4::jsonb, $5)`,
        randomUUID(),
        id,
        `Note added: ${body.text.trim().slice(0, 80)}`,
        JSON.stringify({ noteId: newNote.id, text: newNote.text }),
        newNote.author
      );
    }

    return NextResponse.json({ notes: updated, buyout: await getBuyout(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add note.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
