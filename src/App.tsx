import { ChakraProvider, Box } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Passport from './pages/Passport'
import Rewards from './pages/Rewards'
import Scanner from './pages/Scanner'
import Closet from './pages/Closet'
import Profile from './pages/Profile'

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Box minH="100vh" bg="gray.50" pb="70px">
          <Navbar />
          <Box as="main" pt="0" px={4} pb={0}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/passport" element={<Passport />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/scan" element={<Scanner />} />
              <Route path="/closet" element={<Closet />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ChakraProvider>
  )
}

export default App 