/**
 * Global app state: profile, settings, providers, story catalog, favorites.
 * Everything is loaded from the LOCAL database. No network, no accounts.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  AIProvider,
  AppSettings,
  LocalProfile,
  Playthrough,
  StoryMeta,
} from '../types';
import {
  addFavorite as dbAddFavorite,
  getProfile,
  getSettings,
  isFavorite as dbIsFavorite,
  listFavorites,
  listProviders,
  listRecentPlaythroughs,
  removeFavorite as dbRemoveFavorite,
  saveProfile as dbSaveProfile,
  updateSettings as dbUpdateSettings,
} from '../lib/db';
import { listStories } from '../content/loader';
import { hasApiKey } from '../lib/secureKeys';
import { nowIso } from '../lib/utils';
import { COLORS, Theme, ThemeName } from '../theme';
import { BootSplash } from '../components/BootSplash';

interface AppState {
  ready: boolean;
  /** Null until onboarding completes. */
  profile: LocalProfile | null;
  settings: AppSettings;
  theme: Theme;
  themeName: ThemeName;
  providers: AIProvider[];
  /** Provider ids that have a key stored in SecureStore. */
  providersWithKeys: Set<string>;
  activeProvider: AIProvider | null;
  stories: StoryMeta[];
  favoriteIds: Set<string>;
  recentPlaythroughs: Playthrough[];
  updateAvailable: boolean;

  saveProfile: (p: LocalProfile) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshStories: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  refreshRecent: () => Promise<void>;
  toggleFavorite: (storyId: string) => Promise<boolean>;
  setUpdateAvailable: (v: boolean) => void;
  reloadAll: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [providersWithKeys, setProvidersWithKeys] = useState<Set<string>>(new Set());
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentPlaythroughs, setRecentPlaythroughs] = useState<Playthrough[]>([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const refreshProviders = useCallback(async () => {
    const list = await listProviders();
    setProviders(list);
    const withKeys = new Set<string>();
    for (const p of list) {
      if (await hasApiKey(p.id)) withKeys.add(p.id);
    }
    setProvidersWithKeys(withKeys);
  }, []);

  const refreshStories = useCallback(async () => {
    const p = await getProfile();
    if (!p) {
      setStories([]);
      return;
    }
    try {
      setStories(await listStories(p.ageGroup));
    } catch {
      setStories([]);
    }
  }, []);

  const refreshFavorites = useCallback(async () => {
    const favs = await listFavorites();
    setFavoriteIds(new Set(favs.map((f) => f.storyId)));
  }, []);

  const refreshRecent = useCallback(async () => {
    setRecentPlaythroughs(await listRecentPlaythroughs(12));
  }, []);

  const reloadAll = useCallback(async () => {
    const [p, s] = await Promise.all([getProfile(), getSettings()]);
    setProfile(p);
    setSettings(s);
    await Promise.all([
      refreshProviders(),
      (async () => {
        if (p) {
          try {
            setStories(await listStories(p.ageGroup));
          } catch {
            setStories([]);
          }
        }
      })(),
      refreshFavorites(),
      refreshRecent(),
    ]);
  }, [refreshProviders, refreshFavorites, refreshRecent]);

  useEffect(() => {
    (async () => {
      try {
        await reloadAll();
      } finally {
        setReady(true);
      }
    })();
  }, [reloadAll]);

  const saveProfile = useCallback(
    async (p: LocalProfile) => {
      await dbSaveProfile(p);
      setProfile(p);
      await refreshStories();
    },
    [refreshStories],
  );

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await dbUpdateSettings(patch);
    setSettings(next);
  }, []);

  const toggleFavorite = useCallback(async (storyId: string): Promise<boolean> => {
    const isFav = await dbIsFavorite(storyId);
    if (isFav) {
      await dbRemoveFavorite(storyId);
      setFavoriteIds((prev) => {
        const n = new Set(prev);
        n.delete(storyId);
        return n;
      });
      return false;
    }
    await dbAddFavorite(storyId, nowIso());
    setFavoriteIds((prev) => new Set(prev).add(storyId));
    return true;
  }, []);

  const value = useMemo<AppState>(() => {
    const themeName: ThemeName = settings?.theme ?? 'midnight';
    const activeProvider =
      providers.find((p) => p.id === settings?.activeProviderId && p.enabled) ?? null;
    return {
      ready,
      profile,
      settings: settings as AppSettings,
      theme: COLORS[themeName],
      themeName,
      providers,
      providersWithKeys,
      activeProvider,
      stories,
      favoriteIds,
      recentPlaythroughs,
      updateAvailable,
      saveProfile,
      updateSettings,
      refreshProviders,
      refreshStories,
      refreshRecent,
      refreshFavorites,
      toggleFavorite,
      setUpdateAvailable,
      reloadAll,
    };
  }, [
    ready,
    profile,
    settings,
    providers,
    providersWithKeys,
    stories,
    favoriteIds,
    recentPlaythroughs,
    updateAvailable,
    saveProfile,
    updateSettings,
    refreshProviders,
    refreshStories,
    refreshRecent,
    refreshFavorites,
    toggleFavorite,
    reloadAll,
  ]);

  // Branded splash until the local database is ready.
  if (!ready || !settings) return <BootSplash />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
