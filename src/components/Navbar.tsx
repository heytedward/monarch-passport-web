import { Box, Flex, IconButton, Text, VStack, Center } from '@chakra-ui/react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { PiHouseFill, PiWalletFill, PiCoatHangerFill, PiUserFill } from 'react-icons/pi'
import { Logo } from './Logo'
import { usePrivy } from '@privy-io/react-auth'

const leftNavItems = [
  {
    label: 'HOME',
    to: '/home',
    icon: PiHouseFill,
  },
  {
    label: 'WALLET',
    to: '/wallet',
    icon: PiWalletFill,
  },
]

const rightNavItems = [
  {
    label: 'CLOSET',
    to: '/closet',
    icon: PiCoatHangerFill,
  },
  {
    label: 'PROFILE',
    to: '/profile',
    icon: PiUserFill,
  },
]

const Navbar = () => {
  const location = useLocation()
  const { authenticated, ready } = usePrivy()
  const isDev = import.meta.env.DEV;
  const devBypass = isDev && localStorage.getItem('monarch_dev_bypass') === 'true';

  if (!devBypass && (!ready || !authenticated)) return null;

  return (
    <Box
      as="nav"
      position="fixed"
      bottom={0}
      left={0}
      w="100%"
      bg="black"
      borderTop="4px solid white"
      zIndex={1000}
      pb="env(safe-area-inset-bottom)"
    >
      <Flex 
        justify="space-between" 
        align="center" 
        maxW="container.md" 
        mx="auto" 
        h="70px"
        px={4}
      >
        {/* Left Side Items */}
        <Flex flex={1} justify="space-around">
          {leftNavItems.map((item) => {
            const isActive = location.pathname === item.to
            return (
              <VStack 
                key={item.to} 
                as={RouterLink}
                to={item.to}
                spacing={1} 
                opacity={isActive ? 1 : 0.4}
                transition="opacity 0.2s"
                _hover={{ opacity: 1 }}
              >
                <IconBox icon={item.icon} isActive={isActive} />
                <Text 
                  fontSize="8px" 
                  fontWeight="900" 
                  color={isActive ? "#FFB000" : "white"} 
                  fontFamily="monospace"
                  letterSpacing="0.05em"
                >
                  {item.label}
                </Text>
              </VStack>
            )
          })}
        </Flex>

        {/* Center Logo Button (SHOP) */}
        <Box position="relative" top="-20px">
          <VStack 
            as={RouterLink}
            to="/shop"
            spacing={2}
          >
            <Center
              w="70px"
              h="70px"
              bg="black"
              borderRadius="full"
              border="4px solid white"
              position="relative"
              transition="all 0.2s"
              _hover={{ transform: 'scale(1.05)' }}
              _after={{
                content: '""',
                position: 'absolute',
                inset: "-6px",
                borderRadius: "full",
                border: "4px solid #FFB000",
                boxShadow: "0 0 15px #FFB000, inset 0 0 15px #FFB000",
              }}
            >
              <Logo boxSize="35px" color={location.pathname === '/shop' ? "#FFB000" : "white"} />
            </Center>
          </VStack>
        </Box>

        {/* Right Side Items */}
        <Flex flex={1} justify="space-around">
          {rightNavItems.map((item) => {
            const isActive = location.pathname === item.to
            return (
              <VStack 
                key={item.to} 
                as={RouterLink}
                to={item.to}
                spacing={1}
                opacity={isActive ? 1 : 0.4}
                transition="opacity 0.2s"
                _hover={{ opacity: 1 }}
              >
                <IconBox icon={item.icon} isActive={isActive} />
                <Text 
                  fontSize="8px" 
                  fontWeight="900" 
                  color={isActive ? "#FFB000" : "white"} 
                  fontFamily="monospace"
                  letterSpacing="0.05em"
                >
                  {item.label}
                </Text>
              </VStack>
            )
          })}
        </Flex>
      </Flex>
    </Box>
  )
}

const IconBox = ({ icon: Icon, isActive }: { icon: any, isActive: boolean }) => (
  <Center 
    w="32px" 
    h="32px" 
    color={isActive ? "#FFB000" : "white"}
  >
    <Icon size={24} />
  </Center>
)

export default Navbar
