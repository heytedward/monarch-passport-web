import { Box, Flex, IconButton, HStack } from '@chakra-ui/react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { FaHome, FaQrcode, FaUser } from 'react-icons/fa'
import { GiClothes } from 'react-icons/gi'
import { PiButterflyFill } from 'react-icons/pi'

const navItems = [
  {
    label: 'Passport',
    to: '/passport',
    icon: PiButterflyFill,
  },
  {
    label: 'Home',
    to: '/',
    icon: FaHome,
  },
  {
    label: 'Scan',
    to: '/scan',
    icon: FaQrcode,
  },
  {
    label: 'Closet',
    to: '/closet',
    icon: GiClothes,
  },
  {
    label: 'Profile',
    to: '/profile',
    icon: FaUser,
  },
]

const Navbar = () => {
  const location = useLocation()

  return (
    <Box
      as="nav"
      position="fixed"
      bottom={0}
      left={0}
      w="100%"
      bg="white"
      boxShadow="0 -2px 12px rgba(0,0,0,0.04)"
      zIndex={1000}
      py={2}
    >
      <Flex justify="space-around" align="center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <IconButton
              key={item.to}
              as={RouterLink}
              to={item.to}
              aria-label={item.label}
              icon={<item.icon size={28} />}
              variant="ghost"
              color={isActive ? '#622CC6' : 'gray.500'}
              _hover={{ bg: 'gray.100' }}
              fontSize="2xl"
              rounded="full"
            />
          )
        })}
      </Flex>
    </Box>
  )
}

export default Navbar 