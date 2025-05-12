import { Box, Avatar, Heading, Text, VStack, HStack, Button, SimpleGrid } from '@chakra-ui/react'
import { FaUserCircle } from 'react-icons/fa'
import { Link as RouterLink } from 'react-router-dom'

const gold = '#F4.4019'
const purple = '#622CC6'
const dark = '#121212'
const cream = '#FFFBEF'

const Profile = () => {
  return (
    <Box bg={dark} minH="100vh" color={cream} p={0} fontFamily="Outfit, sans-serif">
      <Box textAlign="center" pt={6}>
        <Heading fontFamily="Outfit, sans-serif" fontWeight={700} fontSize="2xl" letterSpacing="0.1em" mb={1} color={cream}>PAPILLON</Heading>
      </Box>
      <VStack spacing={4} align="stretch" mt={2} px={4}>
        <Box bg="#181818" borderRadius="2xl" p={4} boxShadow="md" textAlign="center">
          <Avatar size="xl" icon={<FaUserCircle fontSize="2.5rem" />} mx="auto" mb={2} />
          <Heading size="md" color={cream} fontWeight={700} mb={1}>username</Heading>
          <Text fontSize="md" color={cream} opacity={0.8} mb={1}>Monarch Level 12</Text>
          <Text fontWeight="bold" color={gold} fontSize="2xl" mb={2}>175.00 <span style={{fontWeight:400}}>$WNGS</span></Text>
          <SimpleGrid columns={3} spacing={2} my={2}>
            <Box textAlign="center">
              <Text fontSize="xs" color={cream} opacity={0.7}>Total Scans</Text>
              <Text fontWeight="bold" fontSize="lg">24</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="xs" color={cream} opacity={0.7}>Quests</Text>
              <Text fontWeight="bold" fontSize="lg">8</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="xs" color={cream} opacity={0.7}>Stamps</Text>
              <Text fontWeight="bold" fontSize="lg">15</Text>
            </Box>
          </SimpleGrid>
        </Box>
        <VStack spacing={3} mt={2}>
          <Button as={RouterLink} to="/passport" variant="outline" borderColor={gold} color={cream} _hover={{bg: gold, color: dark}} borderRadius="xl" w="100%" fontWeight={700} fontSize="lg">View Passport</Button>
          <Button as={RouterLink} to="/rewards" variant="outline" borderColor={gold} color={cream} _hover={{bg: gold, color: dark}} borderRadius="xl" w="100%" fontWeight={700} fontSize="lg">Claim Rewards</Button>
          <Button as={RouterLink} to="/closet" variant="outline" borderColor={gold} color={cream} _hover={{bg: gold, color: dark}} borderRadius="xl" w="100%" fontWeight={700} fontSize="lg">Inventory</Button>
        </VStack>
      </VStack>
    </Box>
  )
}

export default Profile 