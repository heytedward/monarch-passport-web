import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Heading, Text, VStack, Center, Spinner, Button, Icon, useColorModeValue } from '@chakra-ui/react'
import { MdOutlineElectricBolt, MdErrorOutline, MdCheckCircleOutline } from 'react-icons/md'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const Claim = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, authenticated, ready, login } = usePrivy()
  const { fetchWngsBalance } = useStore()

  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING')
  const [errorMessage, setErrorMessage] = useState('ESTABLISHING SECURE CONNECTION...')
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
      // 1. Check if already claimed in transactions
      const { data: existingTx, error: txError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->claim_id', claimId)
        .maybeSingle()

      if (existingTx) {
        setStatus('ERROR')
        setErrorMessage("CLAIM FAILED // ALREADY SCANNED")
        return
      }

      // 2. Fetch reward amount from claim_links or artifacts
      // First try claim_links
      let { data: claimLink, error: claimError } = await supabase
        .from('claim_links')
        .select('wngs_award')
        .eq('short_code', claimId)
        .maybeSingle()

      let amount = 0
      if (claimLink) {
        amount = claimLink.wngs_award
      } else {
        // Fallback to artifacts if claim_links doesn't have it
        const { data: artifact, error: artError } = await supabase
          .from('artifacts')
          .select('tier')
          .eq('tag_id', claimId)
          .maybeSingle()
        
        if (artifact) {
          // Default rewards based on tier
          const tierRewards: Record<string, number> = {
            'BRONZE': 50,
            'SILVER': 100,
            'GOLD': 500,
            'BLACK': 1000
          }
          amount = tierRewards[artifact.tier] || 25
        }
      }

      if (amount === 0) {
        setStatus('ERROR')
        setErrorMessage("CLAIM FAILED // INVALID ARTIFACT")
        return
      }

      setRewardAmount(amount)

      // 3. Update profiles (Atomic increment is better but we'll fetch and update for simplicity here, 
      // though RPC or increment is preferred)
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('wngs_balance')
        .eq('id', userId)
        .single()

      if (profError) throw profError

      const newBalance = (profile.wngs_balance || 0) + amount

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ wngs_balance: newBalance })
        .eq('id', userId)

      if (updateError) throw updateError

      // 4. Insert transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: amount,
          type: 'NFC_TAP',
          metadata: { claim_id: claimId }
        })

      if (insertError) throw insertError

      // 5. Success
      setStatus('SUCCESS')
      fetchWngsBalance(userId) // Sync global state
    } catch (err) {
      console.error('Claim error:', err)
      setStatus('ERROR')
      setErrorMessage("CLAIM FAILED // SYSTEM ERROR")
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
                <Text fontSize="xs" fontWeight="900">STAMINA DEPLETED OR ALREADY SCANNED</Text>
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
