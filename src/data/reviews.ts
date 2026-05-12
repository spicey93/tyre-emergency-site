// Aggregate rating + headline business stats reused across the site —
// hero trust pills, JSON-LD aggregateRating, body copy, meta descriptions.
// Update the numbers here and everywhere else picks them up.
//
// The live review carousel is rendered by the Trustindex embed in
// ReviewsSection.astro; reviews themselves are no longer kept in the repo.

export const googleRating = {
  ratingValue: '5.0',
  reviewCount: 478,
};

export const businessStats = {
  // Jobs completed to date — referenced in pricing copy.
  jobCount: '3,000+',
  // Average all-in price across those jobs, in pounds (no symbol).
  averagePrice: 177,
};
