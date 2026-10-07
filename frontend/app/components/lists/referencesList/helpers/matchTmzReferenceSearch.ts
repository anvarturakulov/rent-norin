import { RefValues } from '@/app/interfaces/reference.interface';

export type TmzSearchableItem = {
  name: string;
  article?: string;
  comment?: string;
  refValues?: RefValues;
};

export type SearchMode = 'single' | 'and' | 'or';

export type TmzSearchScope = 'article' | 'name' | 'all';

export type ParsedTerm = {
  value: string;
  exclude: boolean;
};

export type ParsedQuery = {
  mode: SearchMode;
  terms: ParsedTerm[];
};

function parseTerm(raw: string): ParsedTerm | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('!')) {
    const value = trimmed.slice(1).trim().toLowerCase();
    if (!value) return null;
    return { value, exclude: true };
  }

  return { value: trimmed.toLowerCase(), exclude: false };
}

export function parseTmzSearchQuery(query: string): ParsedQuery {
  const trimmed = query.trim();
  if (!trimmed) {
    return { mode: 'single', terms: [] };
  }

  let mode: SearchMode = 'single';
  let parts: string[];

  if (trimmed.includes('+')) {
    mode = 'and';
    parts = trimmed.split('+');
  } else if (trimmed.includes('-')) {
    mode = 'or';
    parts = trimmed.split('-');
  } else {
    mode = 'single';
    parts = [trimmed];
  }

  const terms = parts
    .map(parseTerm)
    .filter((term): term is ParsedTerm => term !== null);

  return { mode, terms };
}

function fieldIncludesTerm(field: string | undefined | null, term: string): boolean {
  if (!field || !term) return false;
  return field.toLowerCase().includes(term);
}

export function matchTermInScope(
  item: TmzSearchableItem,
  term: string,
  scope: TmzSearchScope,
): boolean {
  if (!term) return false;

  switch (scope) {
    case 'article':
      return fieldIncludesTerm(item.article, term);
    case 'name':
      return fieldIncludesTerm(item.name, term);
    case 'all':
    default:
      return (
        fieldIncludesTerm(item.name, term)
        || fieldIncludesTerm(item.article, term)
        || fieldIncludesTerm(item.refValues?.shortName, term)
        || fieldIncludesTerm(item.comment, term)
        || fieldIncludesTerm(item.refValues?.comment, term)
        || fieldIncludesTerm(item.refValues?.size, term)
        || fieldIncludesTerm(item.refValues?.color, term)
        || fieldIncludesTerm(item.refValues?.texture, term)
        || fieldIncludesTerm(item.refValues?.manufacture, term)
      );
  }
}

export function matchTmzReferenceSearchTerm(item: TmzSearchableItem, term: string): boolean {
  return matchTermInScope(item, term, 'all');
}

function matchTmzReferenceSearchInScope(
  item: TmzSearchableItem,
  query: string,
  scope: TmzSearchScope,
): boolean {
  const { mode, terms } = parseTmzSearchQuery(query);
  if (terms.length === 0) return true;

  const positive = terms.filter((t) => !t.exclude);
  const negative = terms.filter((t) => t.exclude);

  const matchesTerm = (term: ParsedTerm) => matchTermInScope(item, term.value, scope);

  let positivesOk: boolean;
  if (mode === 'and') {
    positivesOk = positive.length === 0 || positive.every(matchesTerm);
  } else if (mode === 'or') {
    positivesOk = positive.length === 0 || positive.some(matchesTerm);
  } else {
    const term = terms[0];
    positivesOk = term.exclude ? true : matchesTerm(term);
  }

  const negativesOk = negative.every((t) => !matchesTerm(t));

  return positivesOk && negativesOk;
}

export function matchTmzArticleSearch(item: TmzSearchableItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (item.article ?? '').toLowerCase().includes(q);
}

export function matchTmzNameSearch(item: TmzSearchableItem, query: string): boolean {
  return matchTmzReferenceSearchInScope(item, query, 'name');
}

export function matchTmzCombinedSearch(
  item: TmzSearchableItem,
  articleQuery: string,
  nameQuery: string,
): boolean {
  const articleActive = articleQuery.trim().length > 0;
  const nameActive = nameQuery.trim().length > 0;

  if (!articleActive && !nameActive) return true;

  if (articleActive && !matchTmzArticleSearch(item, articleQuery)) return false;
  if (nameActive && !matchTmzNameSearch(item, nameQuery)) return false;

  return true;
}

export function matchTmzReferenceSearch(item: TmzSearchableItem, query: string): boolean {
  return matchTmzReferenceSearchInScope(item, query, 'all');
}
