// Customer reviews shown across the site. Edit/add here and every page
// that uses ReviewsSection.astro will pick the changes up automatically.
//
// All reviews are real, taken from the public Google profile. Locations
// reflect where the customer was when they called us — keep them honest.

export interface Review {
  name: string;
  location: string;
  rating: number;
  text: string;
}

export const reviews: Review[] = [
  {
    name: 'Joe Rowe',
    location: 'Nottinghamshire',
    rating: 5,
    text: 'Noticed a gouge out of my side wall while 250 miles from home on a Saturday with garages all shut by 1pm. Dean was out within 15 minutes and the tyre was refitted almost immediately. Fair and up front pricing and all agreed in advance. Absolutely perfect service. If you are unlucky enough to need an emergency tyre, and you\'re within range of Dean, you\'re in luck!',
  },
  {
    name: 'Nick Panton',
    location: 'A1, Nottinghamshire',
    rating: 5,
    text: 'Can\'t praise the service from Dean at Tyre Emergency enough. Had a puncture on the A1 at approx 7.30am, call to Tyre Emergency answered straight away and within 10 minutes had a quote. Just over an hour later new tyre was fitted and I was on my way.',
  },
  {
    name: 'Chantelle W',
    location: 'Newark',
    rating: 5,
    text: 'Hitting a pothole and getting a flat tyre after a 12 hour shift was a nightmare. Especially when RAC was going to be 4 hours, so decided to try elsewhere instead. Dean came, had it fixed and I was on my way within half an hour of calling. Friendly & efficient. Highly recommended!',
  },
  {
    name: 'Lesley Park',
    location: 'Newark',
    rating: 5,
    text: 'Travelled home late Friday night from work and had a burst tyre. I initially booked a refit with a company who said they could do next day — however the job was still waiting to be farmed out early the next morning. I checked Google again and found Dean. I called him and he was with me within the hour, all sorted and road worthy again. I would absolutely recommend this young man, who is a complete professional in his field, mannerly and genuine.',
  },
];

// Aggregate rating shown alongside the cards. Update when the public
// Google profile crosses a meaningful threshold.
export const googleRating = {
  ratingValue: '5.0',
  reviewCount: 478,
};
