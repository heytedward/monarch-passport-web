import {
  Box,
  Container,
  Grid,
  Heading,
  Text,
  Button,
  Badge,
  VStack,
  HStack,
  Image,
} from '@chakra-ui/react'

const Rewards = () => {
  const rewards = [
    {
      id: 1,
      name: 'Limited Edition Tee',
      points: 5000,
      image: '/rewards/tee.png',
      available: true,
    },
    {
      id: 2,
      name: 'Exclusive Hoodie',
      points: 10000,
      image: '/rewards/hoodie.png',
      available: true,
    },
    {
      id: 3,
      name: 'VIP Event Access',
      points: 15000,
      image: '/rewards/event.png',
      available: false,
    },
  ]

  return (
    <Container maxW="container.lg">
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="xl" mb={2}>Rewards Gallery</Heading>
          <Text color="gray.600">Redeem your $WNGS for exclusive rewards</Text>
        </Box>

        <Grid templateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={6}>
          {rewards.map((reward) => (
            <Box
              key={reward.id}
              bg="white"
              p={6}
              rounded="xl"
              shadow="md"
              position="relative"
            >
              <Image
                src={reward.image}
                alt={reward.name}
                boxSize="200px"
                objectFit="cover"
                mx="auto"
                mb={4}
                fallbackSrc="https://via.placeholder.com/200"
              />
              
              <VStack align="stretch" spacing={3}>
                <Heading size="md">{reward.name}</Heading>
                
                <HStack justify="space-between">
                  <Badge colorScheme="purple" fontSize="md" px={3} py={1}>
                    {reward.points} $WNGS
                  </Badge>
                  {!reward.available && (
                    <Badge colorScheme="red">Sold Out</Badge>
                  )}
                </HStack>

                <Button
                  colorScheme="purple"
                  isDisabled={!reward.available}
                >
                  {reward.available ? 'Redeem Now' : 'Out of Stock'}
                </Button>
              </VStack>
            </Box>
          ))}
        </Grid>
      </VStack>
    </Container>
  )
}

export default Rewards 