import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

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
  stamps: {
    id: number
    name: string
    image: string
    collected: boolean
  }[]
  cart: CartItem[]
  activeAvatarColors: string[] | null
  setUser: (user: { id: string } | null) => void
  setWngsBalance: (balance: number) => void
  setIsLoading: (loading: boolean) => void
  fetchWngsBalance: (userId: string) => Promise<void>
  addPoints: (amount: number) => void
  collectStamp: (stampId: number) => void
  setIdentityType: (type: 'AGENT' | 'HUMAN' | null) => void
  addToCart: (item: CartItem) => void
  removeFromCart: (itemId: string) => void
  clearCart: () => void
  executeHandshake: (tagId: string) => void
  setActiveAvatarColors: (colors: string[] | null) => void
}

const useStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      wngsBalance: 0,
      isLoading: false,
      identityType: null,
      stamps: [
        { id: 1, name: 'Spring 2024', image: '/stamps/spring.png', collected: false },
        { id: 2, name: 'Summer 2024', image: '/stamps/summer.png', collected: false },
        { id: 3, name: 'Fall 2024', image: '/stamps/fall.png', collected: false },
        { id: 4, name: 'Winter 2024', image: '/stamps/winter.png', collected: false },
      ],
      cart: [],
      activeAvatarColors: null,
      setUser: (user) => set({ user }),
      setWngsBalance: (balance) => set({ wngsBalance: balance }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      fetchWngsBalance: async (userId) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('wngs_balance')
            .eq('id', userId)
            .single();

          if (error) {
            console.error('Error fetching wngs balance:', error);
            return;
          }

          if (data) {
            set({ wngsBalance: data.wngs_balance || 0 });
          }
        } catch (err) {
          console.error('Unexpected error fetching wngs balance:', err);
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
    }),
    {
      name: 'monarch-passport-storage',
    }
  )
)

export default useStore 
