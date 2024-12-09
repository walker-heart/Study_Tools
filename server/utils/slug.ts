export function createSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generateSetUrl(firstName: string, lastName: string, setId: number): string {
  const nameSlug = createSlug(`${firstName}-${lastName}`);
  return `/flashcards/${nameSlug}/${setId}`;
}
