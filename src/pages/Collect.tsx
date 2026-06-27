import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Heading, Text, VStack, Center, Spinner, Button, Icon } from '@chakra-ui/react'
import { MdCheckCircleOutline, MdErrorOutline, MdInventory2 } from 'react-icons/md'
import { usePrivy } from '@privy-io/react-auth'

const Collect = () => {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, authenticated, ready, login, getAccessToken } = usePrivy()

  const isDev = import.meta.env.DEV
  const devBypass = isDev && localStorage.getItem('monarch_dev_bypass') === 'true'

  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ALREADY_CLAIMED' | 'INVALID' | 'ERROR'>('LOADING')
  const [itemName, setItemName] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const bg = 'black'
  const accent = '#FFB000'

  useEffect(() => {
    if (!ready && !devBypass) return
    if (!authenticated && !devBypass) {
      // Not logged in — prompt login, then they'll land back here via the same URL.
      login()
      return
    }
    if (code && user?.id && !isProcessing && status === 'LOADING') {
      handleCollect(code, user.id)
    }
  }, [ready, authenticated, code, user?.id])

  const handleCollect = async (itemCode: string, userId: string) => {
    setIsProcessing(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('IDENTITY_TOKEN_UNAVAILABLE')

      const response = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'collect', code: itemCode, userId }),
      })

      const result = await response.json()

      if (response.status === 409 || result.error === 'ALREADY_CLAIMED') {
        setStatus('ALREADY_CLAIMED')
        return
      }

      if (response.status === 404 || result.error === 'INVALID_ITEM_CODE') {
        setStatus('INVALID')
        return
      }

      if (!response.ok) {
        setStatus('ERROR')
        return
      }

      setItemName(result.item?.name || null)
      setStatus('SUCCESS')
    } catch {
      setStatus('ERROR')
    } finally {
      setIsProcessing(false)
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'LOADING':
        return (
          <VStack spacing={6}>
            <Spinner color={accent} size="xl" thickness="2px" />
            <Text fontSize="xs" fontFamily="monospace" fontWeight="900" color="gray.500" letterSpacing="0.1em">
              AUTHENTICATING_ITEM...
            </Text>
          </VStack>
        )

      case 'SUCCESS':
        return (
          <VStack spacing={8}>
            <Icon as={MdCheckCircleOutline} color={accent} w={16} h={16} />
            <VStack spacing={2} textAlign="center">
              <Text fontSize="9px" fontFamily="monospace" fontWeight="900" color={accent} letterSpacing="0.15em">
                ITEM_REGISTERED //
              </Text>
              <Heading
                fontSize="3xl"
                fontWeight="900"
                fontFamily="'Archivo Black', sans-serif"
                color="white"
                lineHeight="1"
              >
                {itemName ? itemName.toUpperCase() : 'ITEM_AUTHENTICATED'}
              </Heading>
              <Text fontSize="xs" fontFamily="monospace" color="gray.500" pt={2}>
                THIS PIECE HAS BEEN LOGGED TO YOUR CLOSET.
              </Text>
            </VStack>
            <Button
              bg={accent}
              color="black"
              w="full"
              h="50px"
              borderRadius="0"
              fontWeight="900"
              fontFamily="monospace"
              fontSize="sm"
              onClick={() => navigate('/closet')}
              _hover={{ bg: '#e69e00' }}
            >
              VIEW_CLOSET →
            </Button>
          </VStack>
        )

      case 'ALREADY_CLAIMED':
        return (
          <VStack spacing={8}>
            <Icon as={MdInventory2} color={accent} w={16} h={16} />
            <VStack spacing={2} textAlign="center">
              <Text fontSize="9px" fontFamily="monospace" fontWeight="900" color={accent} letterSpacing="0.15em">
                ALREADY_REGISTERED //
              </Text>
              <Heading fontSize="2xl" fontWeight="900" fontFamily="'Archivo Black', sans-serif" color="white" lineHeight="1">
                ITEM_ON_FILE
              </Heading>
              <Text fontSize="xs" fontFamily="monospace" color="gray.500" pt={2}>
                THIS PIECE IS ALREADY IN YOUR CLOSET.
              </Text>
            </VStack>
            <Button
              bg="transparent"
              color={accent}
              border={`1px solid ${accent}`}
              w="full"
              h="50px"
              borderRadius="0"
              fontWeight="900"
              fontFamily="monospace"
              fontSize="sm"
              onClick={() => navigate('/closet')}
              _hover={{ bg: accent, color: 'black' }}
            >
              VIEW_CLOSET →
            </Button>
          </VStack>
        )

      case 'INVALID':
        return (
          <VStack spacing={8}>
            <Icon as={MdErrorOutline} color="#DC143C" w={16} h={16} />
            <VStack spacing={2} textAlign="center">
              <Text fontSize="9px" fontFamily="monospace" fontWeight="900" color="#DC143C" letterSpacing="0.15em">
                VERIFICATION_FAILED //
              </Text>
              <Heading fontSize="2xl" fontWeight="900" fontFamily="'Archivo Black', sans-serif" color="white" lineHeight="1">
                INVALID_CODE
              </Heading>
              <Text fontSize="xs" fontFamily="monospace" color="gray.500" pt={2}>
                THIS CODE DOES NOT MATCH ANY REGISTERED ITEM.
              </Text>
            </VStack>
            <Button
              bg="transparent"
              color="gray.500"
              border="1px solid"
              borderColor="gray.700"
              w="full"
              h="50px"
              borderRadius="0"
              fontWeight="900"
              fontFamily="monospace"
              fontSize="sm"
              onClick={() => navigate('/home')}
              _hover={{ color: 'white', borderColor: 'white' }}
            >
              RETURN_HOME
            </Button>
          </VStack>
        )

      case 'ERROR':
      default:
        return (
          <VStack spacing={8}>
            <Icon as={MdErrorOutline} color="#DC143C" w={16} h={16} />
            <VStack spacing={2} textAlign="center">
              <Text fontSize="9px" fontFamily="monospace" fontWeight="900" color="#DC143C" letterSpacing="0.15em">
                SYSTEM_ERROR //
              </Text>
              <Heading fontSize="2xl" fontWeight="900" fontFamily="'Archivo Black', sans-serif" color="white" lineHeight="1">
                REQUEST_FAILED
              </Heading>
              <Text fontSize="xs" fontFamily="monospace" color="gray.500" pt={2}>
                UNABLE TO REGISTER ITEM. TRY AGAIN.
              </Text>
            </VStack>
            <Button
              bg={accent}
              color="black"
              w="full"
              h="50px"
              borderRadius="0"
              fontWeight="900"
              fontFamily="monospace"
              fontSize="sm"
              onClick={() => code && user?.id && handleCollect(code, user.id)}
              _hover={{ bg: '#e69e00' }}
            >
              RETRY
            </Button>
          </VStack>
        )
    }
  }

  return (
    <Box bg={bg} minH="100vh" color="white" display="flex" alignItems="center" justifyContent="center" px={8}>
      <Box w="full" maxW="380px">
        <VStack spacing={12}>
          <VStack spacing={1} textAlign="center">
            <Text fontSize="8px" fontFamily="monospace" fontWeight="900" color="gray.600" letterSpacing="0.2em">
              MONARCH_PASSPORT // ITEM_REGISTRY
            </Text>
            <Box w="40px" h="2px" bg={accent} />
          </VStack>

          <Center minH="280px" w="full">
            {renderContent()}
          </Center>

          <Text fontSize="7px" fontFamily="monospace" color="gray.700" textAlign="center">
            PHYGITAL_VERIFICATION_PROTOCOL // SEASON_01
          </Text>
        </VStack>
      </Box>
    </Box>
  )
}

export default Collect
