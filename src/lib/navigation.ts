import { router, type Href } from 'expo-router';

/** Goes back when there is history (e.g. a modal), otherwise replaces with `fallback` (web deep links). */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
