import { mockBuyouts } from "@/lib/mock-data";
import { BuyoutInquiryInput, BuyoutSummary } from "@/lib/types";

const inquiries: Array<BuyoutInquiryInput & { id: string; createdAt: string }> = [];

export async function listBuyouts(): Promise<BuyoutSummary[]> {
  return mockBuyouts;
}

export async function getBuyout(id: string): Promise<BuyoutSummary | null> {
  return mockBuyouts.find((buyout) => buyout.id === id) ?? null;
}

export async function createInquiry(input: BuyoutInquiryInput) {
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
