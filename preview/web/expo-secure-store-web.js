// Web-only stand-in for expo-secure-store (UI review via `npx expo start --web`).
// expo-secure-store has no web implementation, so saving a provider key threw
// and the Chat screen could never be opened in the browser preview. This keeps
// values in localStorage — preview only; Android/iOS use the real Keystore.
const PREFIX = 'kissa_secure_';
const store = () => (typeof localStorage !== 'undefined' ? localStorage : null);

export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
export async function isAvailableAsync() {
  return !!store();
}
export async function setItemAsync(key, value) {
  store()?.setItem(PREFIX + key, String(value));
}
export async function getItemAsync(key) {
  return store()?.getItem(PREFIX + key) ?? null;
}
export async function deleteItemAsync(key) {
  store()?.removeItem(PREFIX + key);
}
