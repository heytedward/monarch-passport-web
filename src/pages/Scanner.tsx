import { useState } from 'react'
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
  useToast,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { MdNfc } from 'react-icons/md'

const Scanner = () => {
  const [isScanning, setIsScanning] = useState(false)
  const toast = useToast()

  const startScanning = async () => {
    if ('NDEFReader' in window) {
      try {
        setIsScanning(true)
        const ndef = new (window as any).NDEFReader()
        await ndef.scan()
        
        ndef.addEventListener("reading", ({ message, serialNumber }: any) => {
          console.log(serialNumber)
          toast({
            title: "Item Scanned!",
            description: `You earned 100 $WNGS`,
            status: "success",
            duration: 5000,
            isClosable: true,
          })
          setIsScanning(false)
        })
      } catch (error) {
        console.error(error)
        toast({
          title: "Scanning Failed",
          description: "Please make sure NFC is enabled on your device",
          status: "error",
          duration: 5000,
          isClosable: true,
        })
        setIsScanning(false)
      }
    } else {
      toast({
        title: "NFC Not Supported",
        description: "Your device doesn't support NFC scanning",
        status: "error",
        duration: 5000,
        isClosable: true,
      })
    }
  }

  return (
    <Container maxW="container.md">
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="xl" mb={4}>Scan Your Item</Heading>
          <Text color="gray.600" mb={8}>
            Hold your phone near the NFC tag on your Papillon item to earn $WNGS
          </Text>

          <Button
            size="lg"
            colorScheme="purple"
            isLoading={isScanning}
            loadingText="Scanning..."
            onClick={startScanning}
            leftIcon={<MdNfc size={24} />}
          >
            Start Scanning
          </Button>
        </Box>

        {isScanning && (
          <Alert status="info">
            <AlertIcon />
            Hold your phone near the NFC tag...
          </Alert>
        )}
      </VStack>
    </Container>
  )
}

export default Scanner 