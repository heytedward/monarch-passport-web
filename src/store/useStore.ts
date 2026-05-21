import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  name: string
  price: number
  image?: string
}

interface UserState {
  user: { id: string } | null
  points: number
  identityType: 'AGENT' | 'HUMAN' | null
  stamps: {
    id: number
    name: string
    image: string
    collected: boolean
  }[]
  cart: CartItem[]
  setUser: (user: { id: string } | null) => void
  addPoints: (amount: number) => void
  collectStamp: (stampId: number) => void
  setIdentityType: (type: 'AGENT' | 'HUMAN' | null) => void
  addToCart: (item: CartItem) => void
  removeFromCart: (itemId: string) => void
  clearCart: () => void
  executeHandshake: (tagId: string) => void
}

const useStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      points: 0,
      identityType: null,
      stamps: [
        { id: 1, name: 'Spring 2024', image: '/stamps/spring.png', collected: false },
        { id: 2, name: 'Summer 2024', image: '/stamps/summer.png', collected: false },
        { id: 3, name: 'Fall 2024', image: '/stamps/fall.png', collected: false },
        { id: 4, name: 'Winter 2024', image: '/stamps/winter.png', collected: false },
      ],
      cart: [],
      setUser: (user) => set({ user }),
      addPoints: (amount) => 
        set((state) => ({ points: state.points + amount })),
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
    }),
    {
      name: 'monarch-passport-storage',
    }
  )
)

export default useStore 
