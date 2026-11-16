import { useQuery } from "@tanstack/react-query";

const API_BASE = "http://localhost:4000";

export default function PhotoGallery({ listingId }: { listingId: string }) {
  const photos = useQuery({
    queryKey: ["listing-photos", listingId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/listings/${encodeURIComponent(listingId)}/photos`);
      if (!res.ok) return [];
      return (await res.json()) as { id: string; url: string }[];
    },
  });

  if (!photos.data || photos.data.length === 0) return null;

  return (
    <section className="gallery">
      {photos.data.map((p) => (
        <img key={p.id} src={`${API_BASE}${p.url}`} alt="Listing photo" />
      ))}
    </section>
  );
}