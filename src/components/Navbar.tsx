import { Box, Flex, Text, VStack, Center, useColorModeValue } from '@chakra-ui/react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { PiHouseFill, PiCoatHangerFill, PiUserFill, PiRankingFill } from 'react-icons/pi'
import { motion, useReducedMotion } from 'framer-motion'
import { Logo } from './Logo'
import { usePrivy } from '@privy-io/react-auth'
import { SPRING_SNAPPY } from '../lib/motion'

const MotionBox = motion(Box)
const MotionCenter = motion(Center)

type NavItemDef = { label: string; to: string; icon: any }
type TapProps = { whileTap?: { scale: number }; transition?: typeof SPRING_SNAPPY }

const leftNavItems = [
  {
    label: 'HOME',
    to: '/home',
    icon: PiHouseFill,
  },
  {
    label: 'ASCEND',
    to: '/ascension',
    icon: PiRankingFill,
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
  const reduce = useReducedMotion()
  const tapProps = reduce ? {} : { whileTap: { scale: 0.86 }, transition: SPRING_SNAPPY }
  const isDev = import.meta.env.DEV;
  const devBypass = isDev && localStorage.getItem('monarch_dev_bypass') === 'true';

  const bgColor = useColorModeValue("gray.50", "black");
  const borderColor = useColorModeValue("gray.300", "white");
  const iconColor = useColorModeValue("black", "white");

  if (!devBypass && (!ready || !authenticated)) return null;

  return (
    <Box
      as="nav"
      position="fixed"
      bottom={0}
      left="50%"
      transform="translateX(-50%)"
      w="100%"
      maxW="430px"
      bg={bgColor}
      borderTop={`4px solid ${borderColor}`}
      zIndex={1000}
      pb="env(safe-area-inset-bottom)"
    >
      <Flex
        justify="space-between"
        align="center"
        w="100%"
        h="70px"
        px={4}
      >
        {/* Left Side Items */}
        <Flex flex={1} justify="space-around">
          {leftNavItems.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              isActive={location.pathname === item.to}
              iconColor={iconColor}
              tapProps={tapProps}
            />
          ))}
        </Flex>

        {/* Center Logo Button (SHOP) */}
        <Box position="relative" top="-20px">
          <VStack
            as={RouterLink}
            to="/shop"
            spacing={2}
          >
            <MotionCenter
              {...tapProps}
              w="70px"
              h="70px"
              bg={bgColor}
              borderRadius="full"
              border={`4px solid ${borderColor}`}
              position="relative"
              _after={{
                content: '""',
                position: 'absolute',
                inset: "-6px",
                borderRadius: "full",
                border: "4px solid var(--monarch-accent)",
                boxShadow: "0 0 15px var(--monarch-accent), inset 0 0 15px var(--monarch-accent)",
              }}
            >
              <Logo boxSize="35px" color={location.pathname === '/shop' ? "var(--monarch-accent)" : iconColor} />
            </MotionCenter>
          </VStack>
        </Box>

        {/* Right Side Items */}
        <Flex flex={1} justify="space-around">
          {rightNavItems.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              isActive={location.pathname === item.to}
              iconColor={iconColor}
              tapProps={tapProps}
            />
          ))}
        </Flex>
      </Flex>
    </Box>
  )
}

// A bottom-nav destination. Presses with a spring bounce (tapProps), and the
// active tab carries a shared-layout accent bar that slides between tabs as
// the route changes (layoutId "nav-active" is animated by framer across items).
const NavItem = ({
  item,
  isActive,
  iconColor,
  tapProps,
}: {
  item: NavItemDef
  isActive: boolean
  iconColor: string
  tapProps: TapProps
}) => (
  <Box
    as={RouterLink}
    to={item.to}
    position="relative"
    opacity={isActive ? 1 : 0.4}
    transition="opacity 0.2s"
    _hover={{ opacity: 1 }}
  >
    <MotionBox
      {...tapProps}
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="4px"
      px={2}
      pt={1}
    >
      <IconBox icon={item.icon} isActive={isActive} iconColor={iconColor} />
      <Text
        fontSize="8px"
        fontWeight="900"
        color={isActive ? 'var(--monarch-accent)' : iconColor}
        fontFamily="monospace"
        letterSpacing="0.05em"
      >
        {item.label}
      </Text>
    </MotionBox>
    {isActive && (
      <MotionBox
        layoutId="nav-active"
        position="absolute"
        bottom="-6px"
        left="50%"
        w="18px"
        h="3px"
        bg="var(--monarch-accent)"
        style={{ x: '-50%' }}
        transition={SPRING_SNAPPY}
      />
    )}
  </Box>
)

const IconBox = ({ icon: Icon, isActive, iconColor }: { icon: any, isActive: boolean, iconColor: string }) => (
  <Center
    w="32px"
    h="32px"
    color={isActive ? "var(--monarch-accent)" : iconColor}
  >
    <Icon size={24} />
  </Center>
)

export default Navbar
