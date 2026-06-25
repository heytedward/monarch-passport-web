import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export interface CartItem {
  id: string
  name: string
  price: number
  image?: string
}

interface UserState {
  user: { id: string } | null
  wngsBalance: number
  isLoading: boolean
  identityType: 'AGENT' | 'HUMAN' | null
  activeTheme: string | null
  activeAvatar: string | null
  totalTaps: number
  stamps: {
    id: number
    name: string
    image: string
    collected: boolean
  }[]
  cart: CartItem[]
  activeAvatarColors: string[] | null
  activeThemeAccent: string | null
  setUser: (user: { id: string } | null) => void
  setWngsBalance: (balance: number) => void
  setIsLoading: (loading: boolean) => void
  fetchUserProfile: (userId: string, accessToken?: string | null) => Promise<void>
  addPoints: (amount: number) => void
  collectStamp: (stampId: number) => void
  setIdentityType: (type: 'AGENT' | 'HUMAN' | null) => void
  addToCart: (item: CartItem) => void
  removeFromCart: (itemId: string) => void
  clearCart: () => void
  executeHandshake: (tagId: string) => void
  setActiveAvatarColors: (colors: string[] | null) => void
  setActiveTheme: (theme: string | null) => void
  setActiveAvatar: (avatar: string | null) => void
  setActiveThemeAccent: (accent: string | null) => void
}

// The 3 built-in themes ship free and aren't looked up by product id; their
// accents are fixed. Custom themes carry their accent in products.accent_color.
const DEFAULT_THEME_ACCENTS: Record<string, string> = {
  SYSTEM_LIGHT: '#FFB000',
  SYSTEM_DARK: '#FFB000',
  CRIMSON_OVERRIDE: '#DC143C',
};

const useStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      wngsBalance: 0,
      isLoading: false,
      identityType: null,
      activeTheme: 'SYSTEM_DARK',
      activeAvatar: null,
      totalTaps: 0,
      stamps: [
        { id: 1, name: 'Spring 2024', image: '/stamps/spring.png', collected: false },
        { id: 2, name: 'Summer 2024', image: '/stamps/summer.png', collected: false },
        { id: 3, name: 'Fall 2024', image: '/stamps/fall.png', collected: false },
        { id: 4, name: 'Winter 2024', image: '/stamps/winter.png', collected: false },
      ],
      cart: [],
      activeAvatarColors: null,
      activeThemeAccent: null,
      setUser: (user) => set({ user }),
      setWngsBalance: (balance) => set({ wngsBalance: balance }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      fetchUserProfile: async (userId, accessToken) => {
        set({ isLoading: true });
        // profiles RLS blocks the bare anon client, so build an authed client
        // when we have the caller's Privy token (mirrors the server userClient).
        const client = accessToken
          ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
              global: { headers: { Authorization: `Bearer ${accessToken}` } },
            })
          : supabase;
        try {
          const { data, error } = await client
            .from('profiles')
            .select('wngs_balance, active_theme, active_avatar, total_taps')
            .eq('id', userId)
            .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully

          if (error) {
            console.error('Error fetching profile:', error);
            return;
          }

          if (data) {
            const activeTheme = data.active_theme || 'SYSTEM_DARK';

            // Resolve the equipped theme's accent. Defaults are fixed; a custom
            // theme (its id is a product UUID) carries accent_color in products.
            let activeThemeAccent: string | null = DEFAULT_THEME_ACCENTS[activeTheme] ?? null;
            if (activeThemeAccent === null && activeTheme) {
              const { data: themeRow } = await supabase
                .from('products')
                .select('accent_color')
                .eq('id', activeTheme)
                .maybeSingle();
              activeThemeAccent = themeRow?.accent_color || null;
            }

            set({
              wngsBalance: data.wngs_balance || 0,
              activeTheme,
              activeAvatar: data.active_avatar,
              totalTaps: data.total_taps || 0,
              activeThemeAccent,
              // `products` has no avatar_colors column in the live schema --
              // there's no per-user/per-avatar color data to restore here.
              // DeStijlAvatar falls back to its own procedural palette
              // whenever this is null, which is the real current behavior.
              activeAvatarColors: null
            });
          } else {
            // Handle case where profile doesn't exist yet
            console.warn(`[System] No profile found for ID: ${userId}.`);
          }
        } catch (err) {
          console.error('Unexpected error fetching profile:', err);
        } finally {
          set({ isLoading: false });
        }
      },
      addPoints: (amount) => 
        set((state) => ({ wngsBalance: state.wngsBalance + amount })),
      collectStamp: (stampId) =>
        set((state) => ({
          stamps: state.stamps.map((stamp) =>
            stamp.id === stampId ? { ...stamp, collected: true } : stamp
          ),
        })),
      setIdentityType: (type) => set({ identityType: type }),
      addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
      removeFromCart: (itemId) => set((state) => ({ cart: state.cart.filter((i) => i.id !== itemId) })),
      clearCart: () => set({ cart: [] }),
      executeHandshake: (tagId) => {
        console.log(`Executing handshake for tag: ${tagId}`);
      },
      setActiveAvatarColors: (colors) => set({ activeAvatarColors: colors }),
      setActiveTheme: (theme) => set({ activeTheme: theme }),
      setActiveAvatar: (avatar) => set({ activeAvatar: avatar }),
      setActiveThemeAccent: (accent) => set({ activeThemeAccent: accent }),
    }),
    {
      name: 'monarch-passport-storage',
    }
  )
)

export default useStore 
