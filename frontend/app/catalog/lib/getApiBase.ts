export function getPublicCatalogApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_DOMAIN ||
    (process.env.NODE_ENV === 'production'
      ? 'https://mebers.kord.uz'
      : 'http://localhost:5009')
  ).replace(/\/$/, '');
}
