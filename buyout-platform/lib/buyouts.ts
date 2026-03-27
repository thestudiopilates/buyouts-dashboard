import { mockBuyouts } from "@/lib/mock-data";
import { hasDatabaseUrl } from "@/lib/prisma";
import { createInquiryInDb, listBuyoutsFromDb } from "@/lib/repositories/buyouts";
import { BuyoutInquiryInput, BuyoutSummary } from "@/lib/types";

const inquiries: Array<BuyoutInquiryInput & { id: string; createdAt: string }> = [];

export async function listBuyouts(): Promise<BuyoutSummary[]> {
  if (hasDatabaseUrl()) {
    return listBuyoutsFromDb();
  }

  return mockBuyouts;
}

export async function getBuyout(id: string): Promise<BuyoutSummary | null> {
  const buyouts = await listBuyouts();
  return buyouts.find((buyout) => buyout.id === id) ?? null;
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
