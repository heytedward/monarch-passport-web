import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Heading, Text, VStack, Center, Spinner, Button, Icon, useColorModeValue } from '@chakra-ui/react'
import { MdErrorOutline, MdCheckCircleOutline } from 'react-icons/md'
import { usePrivy } from '@privy-io/react-auth'
import useStore from '../store/useStore'

const Claim = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, authenticated, ready, login, getAccessToken } = usePrivy()
  const { fetchUserProfile } = useStore()

  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING')
  const [errorMessage, setErrorMessage] = useState('ESTABLISHING SECURE CONNECTION...')
  const [rawError, setRawError] = useState<string | null>(null)
  const [rewardAmount, setRewardAmount] = useState<number>(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const bg = useColorModeValue("black", "black") // High contrast terminal style
  const yellow = "#FFB000"

  useEffect(() => {
    if (!ready) return

    if (!authenticated) {
      setErrorMessage("IDENTITY VERIFICATION REQUIRED...")
      return
    }

    if (id && user?.id && !isProcessing && status === 'LOADING') {
      handleClaim(id, user.id)
    }
  }, [ready, authenticated, id, user?.id])

  const handleClaim = async (claimId: string, userId: string) => {
    setIsProcessing(true)
    setErrorMessage("VERIFYING ARTIFACT...")

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("IDENTITY_TOKEN_UNAVAILABLE");

      // Balance crediting happens server-side (see api/v2/redeem-claim.js) so
      // the browser never gets to write wngs_balance/transactions directly.
      const response = await fetch('/api/v2/redeem-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ shortCode: claimId, userId }),
      })

      const result = await response.json()

      if (!response.ok) {
        setStatus('ERROR')
        setErrorMessage(
          response.status === 409 ? "CLAIM FAILED // ALREADY SCANNED" :
          response.status === 404 ? "ARTIFACT_NOT_FOUND: This claim link does not exist." :
          response.status === 400 ? "CLAIM FAILED // INVALID ARTIFACT" :
          "CLAIM FAILED // SYSTEM ERROR"
        )
        setRawError(result?.error || null)
        return
      }

      setRewardAmount(result.awarded)
      setStatus('SUCCESS')
      fetchUserProfile(userId) // Sync global state
    } catch (err: any) {
      console.error('Claim error:', err)
      setStatus('ERROR')
      setErrorMessage("CLAIM FAILED // SYSTEM ERROR")
      setRawError(err?.message || String(err))
    } finally {
      setIsProcessing(false)
    }
  }

  if (!ready) {
    return (
      <Center h="100vh" bg="black">
        <Spinner color={yellow} size="xl" />
      </Center>
    )
  }

  return (
    <Box bg={bg} minH="100vh" color={yellow} p={6} fontFamily="monospace">
      <Center h="100vh">
        <VStack spacing={8} textAlign="center">
          {status === 'LOADING' && (
            <>
              <Spinner size="xl" thickness="4px" speed="0.65s" color={yellow} />
              <VStack spacing={2}>
                <Heading size="md" letterSpacing="0.2em">ESTABLISHING SECURE CONNECTION...</Heading>
                <Text fontSize="xs">{errorMessage}</Text>
              </VStack>
              {!authenticated && (
                <Button 
                  bg={yellow} 
                  color="black" 
                  borderRadius="0" 
                  fontWeight="900" 
                  onClick={login}
                  _hover={{ bg: "white" }}
                >
                  AUTHENTICATE_IDENTITY
                </Button>
              )}
            </>
          )}

          {status === 'SUCCESS' && (
            <>
              <Box p={10} border={`4px solid ${yellow}`} bg={yellow} color="black">
                <Icon as={MdCheckCircleOutline} w={20} h={20} mb={4} />
                <Heading size="2xl" fontWeight="900" fontStyle="italic" mb={2}>ARTIFACT SCANNED</Heading>
                <Heading size="xl" fontWeight="900">+{rewardAmount} WNGS ACQUIRED</Heading>
              </Box>
              <Button 
                variant="outline" 
                borderColor={yellow} 
                color={yellow} 
                borderRadius="0" 
                h="60px" 
                px={10}
                fontWeight="900"
                _hover={{ bg: yellow, color: "black" }}
                onClick={() => navigate('/wallet')}
              >
                RETURN TO WALLET
              </Button>
            </>
          )}

          {status === 'ERROR' && (
            <>
              <Box p={10} border={`4px solid #FF1744`} bg="#FF1744" color="white">
                <Icon as={MdErrorOutline} w={20} h={20} mb={4} />
                <Heading size="xl" fontWeight="900" mb={2}>{errorMessage}</Heading>
                <Text fontSize="xs" fontWeight="900" mb={4}>STAMINA DEPLETED OR ALREADY SCANNED</Text>
                {rawError && (
                  <Box p={2} bg="blackAlpha.400" borderRadius="md" mt={2}>
                    <Text fontSize="8px" fontWeight="900" color="white" textAlign="left" wordBreak="break-all">
                      DIAGNOSTIC_DATA: {rawError}
                    </Text>
                  </Box>
                )}
              </Box>
              <Button 
                variant="outline" 
                borderColor={yellow} 
                color={yellow} 
                borderRadius="0" 
                h="60px" 
                px={10}
                fontWeight="900"
                _hover={{ bg: yellow, color: "black" }}
                onClick={() => navigate('/wallet')}
              >
                RETURN TO WALLET
              </Button>
            </>
          )}
        </VStack>
      </Center>
    </Box>
  )
}

export default Claim
