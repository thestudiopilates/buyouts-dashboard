import { mockBuyouts } from "@/lib/mock-data";
import { hasDatabaseUrl } from "@/lib/prisma";
import { createInquiryInDb, listBuyoutsFromDb, updateBuyoutInDb } from "@/lib/repositories/buyouts";
import { BuyoutInquiryInput, BuyoutSummary, BuyoutUpdateInput } from "@/lib/types";

const inquiries: Array<BuyoutInquiryInput & { id: string; createdAt: string }> = [];
const localBuyoutOverrides = new Map<string, Partial<BuyoutSummary>>();

export async function listBuyouts(): Promise<BuyoutSummary[]> {
  if (hasDatabaseUrl()) {
    return listBuyoutsFromDb();
  }

  return mockBuyouts.map((buyout) => ({ ...buyout, ...(localBuyoutOverrides.get(buyout.id) ?? {}) }));
}

export async function getBuyout(id: string): Promise<BuyoutSummary | null> {
  const buyouts = await listBuyouts();
  return buyouts.find((buyout) => buyout.id === id) ?? null;
}

export async function updateBuyout(id: string, input: BuyoutUpdateInput) {
  if (hasDatabaseUrl()) {
    await updateBuyoutInDb(id, input);
    return getBuyout(id);
  }

  const current = await getBuyout(id);
  if (!current) {
    throw new Error("Buyout not found.");
  }

  const updated: BuyoutSummary = {
    ...current,
    name: input.clientName,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    eventType: input.eventType ?? current.eventType,
    eventDate: input.eventDate ?? current.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location ?? current.location,
    assignedTo: input.assignedTo ?? current.assignedTo,
    instructor: input.instructor ?? current.instructor,
    nextAction: input.nextAction ?? current.nextAction,
    notes: input.notes ?? current.notes,
    depositLink: input.depositLink,
    balanceLink: input.balanceLink,
    signupLink: input.signupLink
  };

  localBuyoutOverrides.set(id, updated);
  return updated;
}

export async function createInquiry(input: BuyoutInquiryInput) {
  if (hasDatabaseUrl()) {
    return createInquiryInDb(input);
  }

  const inquiry = {
    id: `inq_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...input
  };

  inquiries.unshift(inquiry);
  return inquiry;
}

export async function listRecentInquiries() {
  return inquiries;
}
