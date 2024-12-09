export function createSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/(^-|-$)/g, '');
}

export function generateUserSlug(firstName: string | undefined | null, lastName: string | undefined | null): string {
  if (!firstName && !lastName) return 'user';
  const name = `${firstName || ''}${lastName || ''}`;
  return createSlug(name);
}

export function generateSetUrl(firstName: string | undefined | null, lastName: string | undefined | null, setId: number): string {
  const userSlug = generateUserSlug(firstName, lastName);
  return `/flashcards/${userSlug}/${setId}`;
}
