// Business contact details reused across the site. Update here and
// every page picks the changes up automatically.

// The default phone number — used on the home page, service pages,
// the emergency landing, locker-removal landing and in the header/footer.
export const defaultPhone = '0330 133 9311';

// tel: href version of the default phone, with whitespace stripped.
export const defaultTelHref = `tel:${defaultPhone.replace(/\s+/g, '')}`;

// E.164 international form of the default phone — used in schema.org
// JSON-LD `telephone` fields. Derived from defaultPhone.
export const defaultPhoneIntl = '+44' + defaultPhone.replace(/\s+/g, '').replace(/^0/, '');

// Local landline numbers shown on each area page. All three ring through
// to the same line as the 0330 number — customers in each catchment see
// the local code they recognise.
export const areaPhones: Record<string, string> = {
  // 01623 — Mansfield catchment
  mansfield: '01623 325123',
  chesterfield: '01623 325123',
  southwell: '01623 325123',
  nottingham: '01623 325123',
  bilsthorpe: '01623 325123',
  edwinstowe: '01623 325123',
  ollerton: '01623 325123',
  farnsfield: '01623 325123',
  rainworth: '01623 325123',
  // 01909 — Worksop catchment
  worksop: '01909 251051',
  retford: '01909 251051',
  blyth: '01909 251051',
  doncaster: '01909 251051',
  tuxford: '01909 251051',
  // 01636 — Newark catchment
  newark: '01636 330044',
  grantham: '01636 330044',
  lincoln: '01636 330044',
};

// Build a tel: href for any phone number (e.g. areaPhones.mansfield).
export function telHrefFor(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`;
}
