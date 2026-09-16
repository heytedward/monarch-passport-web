import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  name: string
  price: number
  image?: string
}

// Server payload returned by `ensure_profile` (api/v2/purchase.js).
export interface ProfilePayload {
  success?: boolean
  profile?: {
    wngs_balance?: number
    active_theme?: string | null
    active_avatar?: string | null
    total_taps?: number
    current_stamina?: number
    max_stamina?: number
    last_stamina_regen?: string | null
  } | null
  avatarColors?: string[] | null
  themeAccent?: string | null
  granted?: string[]
  grantedWngs?: number
}

interface UserState {
  user: { id: string } | null
  wngsBalance: number
  // False until a real balance has been read back from the server on this
  // device. Without it there is no way to tell "this account has 0 WNGS" from
  // "we have not fetched yet", and the UI renders the placeholder 0 as fact.
  balanceSynced: boolean
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
  fetchUserProfile: (userId: string, accessToken?: string | null) => Promise<ProfilePayload | null>
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
      balanceSynced: false,
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
      // Every setter here carries a server-confirmed balance (bootstrap, tap,
      // claim, purchase, discount), so writing one also means the balance is
      // no longer the un-fetched placeholder.
      setWngsBalance: (balance) => set({ wngsBalance: balance, balanceSynced: true }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      // The single read path for this user's profile. It goes through the API
      // on the service role, NOT through the browser's Supabase client: this
      // app authenticates with Privy, Supabase cannot validate a Privy token,
      // so `auth.jwt()` is null in the browser and every per-user RLS policy on
      // `profiles` denies (see db/rls_policies.sql). Reading it client-side
      // returned nothing no matter what Authorization header was attached.
      //
      // Returns the server payload so callers can act on the extras (pending
      // storefront grants); balance, theme and avatar are applied here.
      fetchUserProfile: async (userId, accessToken) => {
        if (!userId || !accessToken) return null;
        set({ isLoading: true });
        try {
          const res = await fetch('/api/v2/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ userId, action: 'ensure_profile' }),
          });
          const data: ProfilePayload | null = await res.json().catch(() => null);

          if (!res.ok || !data?.profile) {
            // Leave the last known values in place rather than overwriting a
            // real balance with a placeholder 0 on a failed fetch.
            console.warn(`[System] No profile returned for ID: ${userId}.`);
            return data;
          }

          const profile = data.profile;
          const activeTheme = profile.active_theme || 'SYSTEM_DARK';
          // Resolve the equipped theme's accent. Built-in themes have fixed
          // accents; a custom theme (its id is a product UUID) carries
          // accent_color in `products`, which the server resolves for us.
          const activeThemeAccent =
            data.themeAccent ?? DEFAULT_THEME_ACCENTS[activeTheme] ?? null;

          set({
            wngsBalance: profile.wngs_balance || 0,
            balanceSynced: true,
            activeTheme,
            activeAvatar: profile.active_avatar || null,
            totalTaps: profile.total_taps || 0,
            activeThemeAccent,
            activeAvatarColors: data.avatarColors || null,
          });
          return data;
        } catch (err) {
          console.error('Unexpected error fetching profile:', err);
          return null;
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
