import { SearchRunClient } from "./search-run-client";

export default async function SearchRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SearchRunClient id={id} />;
}
