export function generatePOIData(poi: { name: string; category: string; website?: string }): { rating: number; reviewCount: number } {
  const nameLength = poi.name.length;
  const hasWebsite = poi.website ? 1 : 0;

  const categoryData: Record<string, { baseRating: number; baseReviews: number }> = {
    museum: { baseRating: 4.2, baseReviews: 8000 },
    cathedral: { baseRating: 4.5, baseReviews: 15000 },
    castle: { baseRating: 4.1, baseReviews: 5000 },
    restaurant: { baseRating: 3.8, baseReviews: 3000 },
    tourist: { baseRating: 4.4, baseReviews: 20000 },
    viewpoint: { baseRating: 4.0, baseReviews: 2000 },
    peak: { baseRating: 4.2, baseReviews: 1500 },
    lake: { baseRating: 4.3, baseReviews: 2500 },
    hiking: { baseRating: 4.1, baseReviews: 1000 },
    bridge: { baseRating: 3.7, baseReviews: 800 },
  };

  const data = categoryData[poi.category] || { baseRating: 3.5, baseReviews: 2000 };

  const randomSeed = hashCode(poi.name + poi.category);
  const rand = Math.abs(randomSeed) / 2147483647;

  const rating = Math.round((data.baseRating + (rand - 0.5) * 1.2) * 10) / 10;
  const clampedRating = Math.max(1, Math.min(5, rating));

  const reviewMultiplier = 0.4 + rand * 1.2;
  const nameFactor = 0.7 + Math.min(nameLength / 40, 1) * 0.3;
  const reviewCount = Math.round(data.baseReviews * reviewMultiplier * nameFactor + hasWebsite * 3000);

  return {
    rating: Math.round(clampedRating),
    reviewCount: Math.max(10, reviewCount),
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}
