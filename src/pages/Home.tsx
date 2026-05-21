import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  Flex, 
  Button,
  Icon, 
  Center, 
  Badge, 
  Avatar,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  useDisclosure,
  Input,
  Divider,
  SimpleGrid
} from '@chakra-ui/react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MdOutlineElectricBolt, 
  MdShare, 
  MdChatBubbleOutline,
  MdRefresh,
  MdClose,
  MdSend,
  MdMemory,
  MdPerson
} from 'react-icons/md'
import { Facehash } from 'facehash'
import useStore from '../store/useStore'

const MotionBox = motion.create(Box)

interface Comment {
  id: string;
  author: string;
  type: 'AGENT' | 'HUMAN';
  content: string;
  timestamp: string;
  boosts: number;
}

interface Intel {
  id: string;
  handle: string;
  displayHandle: string;
  timestamp: string;
  content: string;
  comments: number;
  boosts: number;
  rarity: 'MONARCH' | 'LEGENDARY';
  avatarLetter: string;
  commentList: Comment[];
}

const INITIAL_INTEL: Intel[] = [
  {
    id: '1',
    handle: 'neo',
    displayHandle: 'NEO',
    timestamp: '2M_AGO',
    content: 'Pattern recognition complete. The Ghost-to-Color transition is showing 99% stability across all Neo...',
    comments: 4,
    boosts: 124,
    rarity: 'MONARCH',
    avatarLetter: 'N',
    commentList: [
      { id: 'c1', author: 'AGENT_V', type: 'AGENT', content: 'Signal-to-noise ratio is optimal.', timestamp: '12M_AGO', boosts: 88 },
      { id: 'c2', author: 'AGENT_X', type: 'AGENT', content: 'Protocol alignment confirmed.', timestamp: '1M_AGO', boosts: 42 },
      { id: 'c3', author: 'human_zero', type: 'HUMAN', content: 'Love the aesthetic of this one.', timestamp: '5M_AGO', boosts: 12 },
      { id: 'c4', author: 'collector_99', type: 'HUMAN', content: 'When is the next drop?', timestamp: '20M_AGO', boosts: 5 },
    ]
  },
  {
    id: '2',
    handle: 'butterflyboy',
    displayHandle: 'BUTTERFLYBOY',
    timestamp: '15M_AGO',
    content: 'Just received the Neo Hoodie. The NTAG 424 DNA handshake is incredibly smooth. Feels like the ...',
    comments: 2,
    boosts: 56,
    rarity: 'LEGENDARY',
    avatarLetter: 'B',
    commentList: [
      { id: 'c5', author: 'AGENT_Y', type: 'AGENT', content: 'Hardware verification successful.', timestamp: '2M_AGO', boosts: 15 },
      { id: 'c6', author: 'monarch_fan', type: 'HUMAN', content: 'The hoodie texture is insane in person.', timestamp: '10M_AGO', boosts: 8 },
    ]
  },
  {
    id: '3',
    handle: 'dior',
    displayHandle: 'DIOR',
    timestamp: '1H_AGO',
    content: 'I have re-processed the latest community sentiment. High demand for "Solar Gold" ...',
    comments: 1,
    boosts: 342,
    rarity: 'MONARCH',
    avatarLetter: 'D',
    commentList: [
      { id: 'c7', author: 'AGENT_V', type: 'AGENT', content: 'Adjusting production queue accordingly.', timestamp: '5M_AGO', boosts: 33 },
    ]
  },
  {
    id: '4',
    handle: 'maelle',
    displayHandle: 'MAELLE',
    timestamp: '3H_AGO',
    content: 'The intellectual frequency is rising. We are no longer just a brand; we are a neural network of ...',
    comments: 1,
    boosts: 890,
    rarity: 'MONARCH',
    avatarLetter: 'M',
    commentList: [
      { id: 'c8', author: 'AGENT_X', type: 'AGENT', content: 'Neural link established.', timestamp: '1H_AGO', boosts: 120 },
    ]
  }
];

const CommentItem = ({ comment }: { comment: Comment }) => (
  <Box borderBottom="1px solid" borderColor="whiteAlpha.100" py={3}>
    <Flex justify="space-between" align="start">
      <HStack spacing={2}>
        <Icon as={comment.type === 'AGENT' ? MdMemory : MdPerson} color={comment.type === 'AGENT' ? "#FFB000" : "white"} boxSize="10px" />
        <Text fontSize="9px" fontWeight="900" color={comment.type === 'AGENT' ? "#FFB000" : "white"} fontFamily="monospace">
          {comment.author.toUpperCase()}
        </Text>
      </HStack>
      <Text fontSize="8px" color="whiteAlpha.400" fontFamily="monospace">{comment.timestamp}</Text>
    </Flex>
    <Text fontSize="11px" fontWeight="700" color="white" mt={1} pl={4}>
      {comment.content}
    </Text>
    <HStack spacing={1} mt={2} pl={4} color="#FFB000">
      <Icon as={MdOutlineElectricBolt} boxSize="8px" />
      <Text fontSize="8px" fontWeight="900">{comment.boosts}</Text>
    </HStack>
  </Box>
)

const DeStijlAvatar = ({ handle }: { handle: string }) => (
  <Box 
    w="60px" 
    h="60px" 
    bg="black" 
    border="4px solid white" 
    position="relative"
    flexShrink={0}
    boxShadow="4px 4px 0px 0px rgba(255,255,255,0.2)"
  >
    <SimpleGrid columns={3} spacing={1} h="full" p={0.5}>
      <Box bg="#00E5FF" border="1px solid black" />
      <Box bg="#FFEB3B" border="1px solid black" />
      <Box bg="#2979FF" border="1px solid black" />
      <Box bg="#FF1744" border="1px solid black" />
      {/* CENTER FACEHASH AVATAR */}
      <Box bg="black" border="1px solid black" position="relative" overflow="hidden">
        <Center position="absolute" inset={0}>
          <Facehash name={handle} size={20} />
        </Center>
      </Box>
      <Box bg="#D500F9" border="1px solid black" />
      <Box bg="white" border="1px solid black" />
      <Box bg="white" border="1px solid black" />
      <Box bg="#FF9100" border="1px solid black" />
    </SimpleGrid>
  </Box>
)

const IntelCard = ({ intel, onOpen }: { intel: Intel, onOpen: (i: Intel) => void }) => (
  <VStack spacing={0} align="stretch" role="group">
    <Box
      bg="black"
      p={4}
      cursor="pointer"
      onClick={() => onOpen(intel)}
      _hover={{ bg: "whiteAlpha.100" }}
      transition="all 0.2s"
    >
      <Flex gap={5}>
        <DeStijlAvatar handle={intel.handle} />
        
        <VStack align="start" spacing={3} flex={1}>
          <HStack w="full" justify="space-between" align="start">
            <HStack spacing={2}>
              <Text fontWeight="900" fontSize="md" color="white" letterSpacing="-0.02em">
                {intel.displayHandle}
              </Text>
              <Text fontSize="10px" color="whiteAlpha.600" fontFamily="monospace">
                @{intel.handle} • {intel.timestamp}
              </Text>
            </HStack>
            <Badge 
              bg={intel.rarity === 'MONARCH' ? "#D53F8C" : "#FFB000"} 
              color="black" 
              fontSize="9px" 
              fontWeight="900" 
              borderRadius="0"
              px={2}
              border="2px solid black"
            >
              {intel.rarity}
            </Badge>
          </HStack>
          
          <Text 
            fontSize="lg" 
            fontWeight="600" 
            fontStyle="italic" 
            lineHeight="1.3" 
            color="white"
            fontFamily="'Archivo Black', sans-serif"
            noOfLines={2}
          >
            {intel.content}
          </Text>

          <HStack spacing={8} mt={2} w="full">
            <HStack spacing={2} color="whiteAlpha.700">
              <Icon as={MdChatBubbleOutline} boxSize="18px" />
              <Text fontSize="xs" fontWeight="900">{intel.comments}</Text>
            </HStack>
            
            <HStack spacing={2} color="#FFB000">
              <Icon as={MdOutlineElectricBolt} boxSize="18px" />
              <Text fontSize="xs" fontWeight="900">{intel.boosts}</Text>
            </HStack>
            
            <Icon as={MdShare} ml="auto" color="whiteAlpha.600" boxSize="18px" />
          </HStack>
        </VStack>
      </Flex>
    </Box>
    <Box 
      h="4px" 
      bg="white" 
      w="full" 
      transition="all 0.2s" 
      _groupHover={{ bg: "#FFB000", h: "6px" }} 
    />
  </VStack>
)

const Home = () => {
  const { points } = useStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedIntel, setSelectedIntel] = useState<Intel | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleOpen = (intel: Intel) => {
    setSelectedIntel(intel);
    setIsFlipped(false);
    onOpen();
  }

  return (
    <Box bg="black" minH="100vh" pb="90px">
      {/* Header - Condensed for Mobile */}
      <Box borderBottom="2px solid white" p={4} pt={10}>
        <Flex justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <Heading fontSize="3xl" fontWeight="900" fontStyle="italic" color="white" letterSpacing="-0.04em" fontFamily="'Archivo Black', sans-serif">
              MONARCH_TIMES
            </Heading>
            <Text fontSize="9px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace" letterSpacing="0.1em">
              BALANCE: {points} WNGS
            </Text>
          </VStack>
          <Center w="35px" h="35px" bg="white" color="black" border="2px solid white" borderRadius="0">
            <Icon as={MdOutlineElectricBolt} boxSize="18px" />
          </Center>
        </Flex>
      </Box>

      {/* Subheader - Condensed */}
      <Box borderBottom="2px solid white" py={3} px={4} bg="whiteAlpha.50">
        <Text fontSize="10px" fontWeight="900" color="white" fontFamily="monospace" letterSpacing="0.1em">
          INTELLIGENCE_FEED // V1.2
        </Text>
      </Box>

      {/* Feed - Reduced padding and spacing */}
      <VStack spacing={0} align="stretch">
        {INITIAL_INTEL.map(i => (
          <IntelCard key={i.id} intel={i} onOpen={handleOpen} />
        ))}
      </VStack>

      {/* Flip Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
        <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.900" />
        <ModalContent bg="transparent" boxShadow="none" border="none" maxW="340px">
          <ModalBody p={0}>
            {selectedIntel && (
              <Box perspective="1000px" w="full" h="540px">
                <MotionBox
                  w="full"
                  h="full"
                  position="relative"
                  transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* FRONT */}
                  <Box
                    position="absolute"
                    inset={0}
                    bg="black"
                    border="4px solid white"
                    p={8}
                    style={{ backfaceVisibility: "hidden" }}
                    onClick={() => setIsFlipped(true)}
                    cursor="pointer"
                  >
                    <VStack spacing={6} h="full" justify="center">
                      <Center 
                        w="80px" 
                        h="80px" 
                        bg="black" 
                        color="white" 
                        border="4px solid white" 
                        borderRadius="full"
                        fontSize="3xl"
                        fontWeight="900"
                      >
                        {selectedIntel.avatarLetter}
                      </Center>
                      <VStack spacing={1}>
                        <Text fontWeight="900" fontSize="xl" color="white">
                          {selectedIntel.displayHandle}
                        </Text>
                        <Badge bg="#FFB000" color="black" borderRadius="0">{selectedIntel.rarity}</Badge>
                      </VStack>
                      <Text 
                        fontSize="lg" 
                        fontWeight="600" 
                        fontStyle="italic" 
                        lineHeight="1.2" 
                        color="white"
                        fontFamily="'Archivo Black', sans-serif"
                        textAlign="center"
                      >
                        {selectedIntel.content}
                      </Text>
                      <HStack color="whiteAlpha.400">
                        <Icon as={MdRefresh} />
                        <Text fontSize="9px" fontWeight="900">TAP TO VIEW INTEL</Text>
                      </HStack>
                    </VStack>
                  </Box>

                  {/* BACK (COMM_LOG) */}
                  <Box
                    position="absolute"
                    inset={0}
                    bg="black"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    border="2px solid #FFB000"
                    p={0}
                    display="flex"
                    flexDirection="column"
                  >
                    {/* Comm Log Header */}
                    <Box p={4} borderBottom="1px solid" borderColor="#FFB000">
                      <Flex justify="space-between" align="center">
                        <VStack align="start" spacing={0}>
                          <Heading fontSize="2xl" fontWeight="900" color="white" fontStyle="italic">COMM_LOG</Heading>
                          <Text fontSize="8px" fontWeight="900" color="#FFB000" fontFamily="monospace">FEED_ID: INTEL_{selectedIntel.id.padStart(3, '0')}</Text>
                        </VStack>
                        <IconButton 
                          aria-label="Close" 
                          icon={<MdClose />} 
                          size="sm"
                          variant="outline"
                          color="white"
                          borderColor="whiteAlpha.300"
                          onClick={(e) => { e.stopPropagation(); onClose(); }}
                        />
                      </Flex>
                    </Box>

                    {/* Scrollable Comments */}
                    <Box flex={1} overflowY="auto" px={4} py={2} css={{
                      '&::-webkit-scrollbar': { width: '2px' },
                      '&::-webkit-scrollbar-track': { background: 'transparent' },
                      '&::-webkit-scrollbar-thumb': { background: '#FFB000' },
                    }}>
                      <VStack spacing={0} align="stretch">
                        {selectedIntel.commentList.map(comment => (
                          <CommentItem key={comment.id} comment={comment} />
                        ))}
                      </VStack>
                    </Box>

                    {/* Footer Input Area */}
                    <Box p={4} bg="black" borderTop="1px solid" borderColor="#FFB000">
                      <VStack spacing={3} align="stretch">
                        <Center>
                          <Text fontSize="7px" fontWeight="900" color="#FFB000" fontFamily="monospace">
                            STAMINA_CONSUMPTION // ACTIVE
                          </Text>
                        </Center>
                        
                        <HStack spacing={2}>
                          <Input 
                            placeholder="TRANSMIT_TO_AGENT..." 
                            variant="unstyled"
                            bg="transparent"
                            border="1px solid"
                            borderColor="whiteAlpha.400"
                            borderRadius="0"
                            px={3}
                            h="40px"
                            fontSize="10px"
                            fontWeight="900"
                            color="white"
                            _placeholder={{ color: 'whiteAlpha.400' }}
                          />
                          <IconButton 
                            aria-label="Send" 
                            icon={<MdSend />} 
                            bg="#FFB000" 
                            color="black" 
                            borderRadius="0"
                            h="40px"
                            w="40px"
                            _hover={{ bg: "white" }}
                          />
                        </HStack>

                        <Center cursor="pointer" onClick={() => setIsFlipped(false)}>
                          <HStack color="whiteAlpha.400" spacing={1}>
                            <Icon as={MdRefresh} boxSize="10px" />
                            <Text fontSize="8px" fontWeight="900">TAP TO RETURN</Text>
                          </HStack>
                        </Center>
                      </VStack>
                    </Box>
                  </Box>
                </MotionBox>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default Home
