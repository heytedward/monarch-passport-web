import { Box, Container, Heading, Text, VStack, Stat, StatLabel, StatNumber, StatHelpText } from '@chakra-ui/react'

const Home = () => {
  return (
    <Container maxW="container.md">
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="2xl" mb={4}>Welcome to Monarch Passport</Heading>
          <Text fontSize="lg" color="gray.600">
            Scan your Papillon Brand apparel to earn $WNGS and collect rewards
          </Text>
        </Box>

        <Box bg="white" p={6} rounded="xl" shadow="md">
          <Stat>
            <StatLabel fontSize="lg">Your $WNGS Balance</StatLabel>
            <StatNumber fontSize="4xl" color="purple.600">1,250</StatNumber>
            <StatHelpText>Last earned: 2 days ago</StatHelpText>
          </Stat>
        </Box>
      </VStack>
    </Container>
  )
}

export default Home 