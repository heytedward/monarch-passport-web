import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
  useToast,
  Alert,
  Input,
  HStack,
  Center,
  Spinner,
} from '@chakra-ui/react'
import { MdNfc } from 'react-icons/md'
import { usePrivy } from '@privy-io/react-auth'

const Scanner = () => {
  const { authenticated } = usePrivy()
  const navigate = useNavigate()
  const [isScanning, setIsScanning] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [debugToken, setDebugToken] = useState('')
  const [showDebug, setShowDebug] = useState(false)
  const toast = useToast()

  const isDev = import.meta.env.DEV;
  const devBypass = isDev && localStorage.getItem('monarch_dev_bypass') === 'true';

  // Hands off to the real verification/claim flow (src/pages/Verify.tsx ->
  // src/pages/Claim.tsx) instead of an old standalone NFC claim endpoint
  // that no longer exists.
  const handleClaim = (token: string) => {
    if (!authenticated && !devBypass) {
      toast({
        title: "AUTH_REQUIRED",
        description: "Please login to claim rewards",
        status: "warning",
      })
      return
    }

    setIsClaiming(true)

    let tagId = token
    try {
      const url = new URL(token)
      tagId = url.pathname.split('/').filter(Boolean).pop() || token
    } catch {
      // token wasn't a URL, treat it as a raw tag ID
    }

    navigate(`/v/${tagId}`)
  }

  const startScanning = async () => {
    if ('NDEFReader' in window) {
      try {
        setIsScanning(true)
        const ndef = new (window as any).NDEFReader()
        await ndef.scan()
        
        ndef.addEventListener("reading", ({ message, serialNumber }: any) => {
          let token = serialNumber
          if (message.records.length > 0) {
            const decoder = new TextDecoder()
            token = decoder.decode(message.records[0].data)
          }
          
          handleClaim(token)
        })
      } catch (error) {
        console.error(error)
        toast({
          title: "Scanning Failed",
          description: "Ensure NFC is enabled and permission granted",
          status: "error",
        })
        setIsScanning(false)
      }
    } else {
      toast({
        title: "NFC Not Supported",
        description: "This browser/device does not support Web NFC. Use Android Chrome or simulate below.",
        status: "info",
      })
      setShowDebug(true)
    }
  }

  return (
    <Box bg="white" minH="100vh" pt="100px" pb="100px">
      <Container maxW="container.md">
        <VStack spacing={12} align="stretch">
          <Box borderBottom="8px solid black" pb={8}>
            <Heading className="de-stijl-heading" size="2xl" fontStyle="italic">
              WNGS_LINK
            </Heading>
            <Text className="de-stijl-body" fontWeight="bold" fontSize="xs" opacity={0.6} mt={2}>
              PHYGITAL_HANDSHAKE_V1.0 // NEARFIELD_POLLING
            </Text>
          </Box>

          <Center p={10} border="8px solid black" bg={isScanning ? "black" : "white"} transition="all 0.3s">
            <VStack spacing={6}>
              {isScanning ? (
                <Spinner size="xl" color="#FFB000" thickness="4px" />
              ) : (
                <Box p={8} bg="black" color="white">
                  <MdNfc size={60} />
                </Box>
              )}
              
              <VStack spacing={2} textAlign="center">
                <Heading className="de-stijl-heading" size="md" color={isScanning ? "white" : "black"}>
                  {isScanning ? "POLLING_FOR_HARDWARE..." : "READY_FOR_PROTOCOL"}
                </Heading>
                <Text className="de-stijl-body" fontSize="xs" color={isScanning ? "whiteAlpha.800" : "black"}>
                  {isScanning ? "HOLD_ARTIFACT_NEAR_DEVICE" : "INITIATE_HANDSHAKE_TO_PROCEED"}
                </Text>
              </VStack>
            </VStack>
          </Center>

          <Button
            size="lg"
            bg="black"
            color="white"
            _hover={{ bg: "#FFB000", color: "black" }}
            borderRadius="0"
            height="70px"
            isLoading={isScanning || isClaiming}
            loadingText="SYNCING..."
            onClick={startScanning}
            leftIcon={<MdNfc size={24} />}
            className="de-stijl-heading"
            fontSize="xl"
          >
            EXECUTE_WNGS_LINK
          </Button>

          {showDebug && (
            <Box border="4px solid black" p={6} bg="gray.50">
              <Text className="de-stijl-heading" fontSize="xs" mb={4}>DEBUG_SIMULATION_MODE</Text>
              <HStack>
                <Input 
                  placeholder="INPUT_HARDWARE_UID_OR_URL" 
                  borderRadius="0" 
                  borderColor="black" 
                  borderWidth="2px"
                  bg="white"
                  value={debugToken}
                  onChange={(e) => setDebugToken(e.target.value)}
                  className="de-stijl-body"
                  fontSize="xs"
                />
                <Button 
                  bg="black" 
                  color="white" 
                  borderRadius="0" 
                  onClick={() => handleClaim(debugToken)}
                  isLoading={isClaiming}
                  className="de-stijl-heading"
                  fontSize="xs"
                  px={8}
                >
                  SIMULATE
                </Button>
              </HStack>
            </Box>
          )}

          <Alert status="info" variant="solid" bg="black" color="white" borderRadius="0" borderLeft="8px solid #FFD700">
            <Box>
              <Text className="de-stijl-heading" fontSize="xs">SYSTEM_DIRECTIVE:</Text>
              <Text className="de-stijl-body" fontSize="10px">
                Each artifact contains a unique WNGS sequence. Handshake only possible once per identity.
              </Text>
            </Box>
          </Alert>
        </VStack>
      </Container>
    </Box>
  )
}

export default Scanner 
