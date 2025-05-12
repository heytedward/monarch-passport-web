import create from 'zustand'

interface UserState {
  points: number
  stamps: {
    id: number
    name: string
    image: string
    collected: boolean
  }[]
  addPoints: (amount: number) => void
  collectStamp: (stampId: number) => void
}

const useStore = create<UserState>((set) => ({
  points: 0,
  stamps: [
    { id: 1, name: 'Spring 2024', image: '/stamps/spring.png', collected: false },
    { id: 2, name: 'Summer 2024', image: '/stamps/summer.png', collected: false },
    { id: 3, name: 'Fall 2024', image: '/stamps/fall.png', collected: false },
    { id: 4, name: 'Winter 2024', image: '/stamps/winter.png', collected: false },
  ],
  addPoints: (amount) => 
    set((state) => ({ points: state.points + amount })),
  collectStamp: (stampId) =>
    set((state) => ({
      stamps: state.stamps.map((stamp) =>
        stamp.id === stampId ? { ...stamp, collected: true } : stamp
      ),
    })),
}))

export default useStore 