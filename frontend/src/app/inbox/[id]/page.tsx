import { InboxDetailClient } from "./inbox-detail-client";

export default async function InboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InboxDetailClient id={id} />;
}
