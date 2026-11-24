import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Notice } from '@gatehood/shared';

import { decodeFeed, encodeFeed, feedKey, type FeedFilter, type SavedFeed } from './cacheFormat';

/** Saves one filter's first page so it shows at once next launch and while offline. */
export async function saveFeed(uid: string, filter: FeedFilter, items: Notice[], savedAt = Date.now()): Promise<void> {
  await AsyncStorage.setItem(feedKey(uid, filter), encodeFeed(items, savedAt));
}

/** The saved first page, or null if there is none (or it can't be read). */
export async function loadFeed(uid: string, filter: FeedFilter): Promise<SavedFeed | null> {
  try {
    return decodeFeed(await AsyncStorage.getItem(feedKey(uid, filter)));
  } catch {
    return null;
  }
}
