/**
 * Secure on-device storage for sensitive credentials (user-provided API keys).
 * Uses expo-secure-store (Android Keystore / iOS Keychain).
 * Keys NEVER leave the device except inside the user's own AI API requests.
 */
import * as SecureStore from 'expo-secure-store';

function keyFor(providerId: string): string {
  return `kissa_provider_key_${providerId}`;
}

/** Save (or replace) the API key for a provider. */
export async function saveApiKey(providerId: string, apiKey: string): Promise<void> {
  const value = apiKey.trim();
  if (!value) {
    await deleteApiKey(providerId);
    return;
  }
  await SecureStore.setItemAsync(keyFor(providerId), value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

/** Read the API key for a provider. Returns null when not set. */
export async function getApiKey(providerId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(keyFor(providerId));
  } catch {
    return null;
  }
}

/** True when a key is stored (used for "configured" badges — never shows the key). */
export async function hasApiKey(providerId: string): Promise<boolean> {
  const v = await getApiKey(providerId);
  return !!v;
}

export async function deleteApiKey(providerId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(keyFor(providerId));
  } catch {
    // Already gone — fine.
  }
}
