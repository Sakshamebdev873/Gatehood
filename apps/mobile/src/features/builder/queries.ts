import { collection, limit, orderBy, query, type DocumentData, type Firestore, type Query } from 'firebase/firestore';

export const BUILDER_PAGE_SIZE = 15;

/** Every notice, newest first, `count` of them. Takes `db` so it runs outside the app (scripts). */
export function builderNoticesQuery(firestore: Firestore, count: number): Query<DocumentData> {
  return query(collection(firestore, 'notices'), orderBy('createdAt', 'desc'), limit(count));
}
