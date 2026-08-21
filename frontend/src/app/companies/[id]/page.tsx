import { CompanyDetailClient } from "./company-detail-client";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyDetailClient id={id} />;
}
