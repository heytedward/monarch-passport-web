import { Box, Heading, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import useStore from '../store/useStore'

const events = [
  {
    name: 'London Pop-Up ’25',
    label: 'BRONZE',
    borderColor: '#C97A3A',
    labelColor: '#C97A3A',
  },
  {
    name: 'Summer Festival ’24',
    label: 'SILVER',
    borderColor: '#E0E0E0',
    labelColor: '#E0E0E0',
  },
  {
    name: 'Store Opening ’24',
    label: 'GOLD',
    borderColor: '#FFB000',
    labelColor: '#FFB000',
  },
  {
    name: 'Paris Show ’24',
    label: 'BLACK',
    borderColor: '#622CC6',
    labelColor: '#622CC6',
  },
]

const dark = '#121212'
const cream = '#FFFBEF'

const Passport = () => {
  const { wngsBalance } = useStore();

  return (
    <Box bg={dark} minH="100vh" color={cream} p={0} fontFamily="Outfit, sans-serif">
      <Box textAlign="center" pt={6} pb={4}>
        <Heading fontFamily="Outfit, sans-serif" fontWeight={700} fontSize="2xl" letterSpacing="0.1em" mb={1} color={cream}>PAPILLON</Heading>
        <Text fontSize="2xl" fontWeight={600} mb={2} color={cream}>Digital Passport</Text>
        <VStack spacing={0} opacity={0.8}>
           <Text fontSize="sm" fontWeight="bold">Balance: {wngsBalance.toLocaleString()} $WNGS</Text>
           <Text fontSize="xs">Clearance Level: AUTHORIZED</Text>
        </VStack>
      </Box>
      
      <SimpleGrid columns={2} spacing={4} px={4} pb={10}>
        {events.map((event, idx) => (
          <Box
            key={idx}
            border={`2.5px solid ${event.borderColor}`}
            borderRadius="20px"
            bg="#181818"
            p={4}
            textAlign="center"
            boxShadow="md"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
          >
            <Text fontSize="lg" fontWeight={700} mb={3} lineHeight="1.2">{event.name}</Text>
            <Box 
              border={`2px solid ${event.labelColor}`} 
              color={event.labelColor} 
              borderRadius="10px" 
              px={3} 
              py={1} 
              display="inline-block" 
              fontWeight={700} 
              fontSize="sm"
            >
              {event.label}
            </Box>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  )
}

export default Passport 
