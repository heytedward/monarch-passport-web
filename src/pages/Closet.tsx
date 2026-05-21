import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  Button, 
  Flex,
  Icon,
  Center,
  SimpleGrid,
  Container,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  useDisclosure,
  IconButton,
  Divider,
  useColorMode
} from '@chakra-ui/react'
import { useState } from 'react'
import { MdTune, MdRefresh, MdClose, MdLightMode, MdDarkMode } from 'react-icons/md'
import { PiShoppingBagFill, PiSunFill, PiMoonFill } from 'react-icons/pi'
import { motion, AnimatePresence } from 'framer-motion'

const MotionBox = motion.create(Box)

const TShirtIcon = ({ color = "white", boxSize = "40px" }: { color?: string, boxSize?: string }) => (
  <Box position="relative" w={boxSize} h={boxSize}>
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  </Box>
)

const AvatarGrid = ({ colors, size = "40px" }: { colors: string[], size?: string }) => (
  <SimpleGrid columns={3} spacing={0.5} w={size} h={size} border="1px solid white" p={0.5} bg="black">
    {colors.map((c, i) => (
      <Box key={i} bg={c} w="100%" h="100%" />
    ))}
  </SimpleGrid>
)

interface ClosetItemData {
  id: string;
  type: 'physical' | 'digital' | 'theme';
  name: string;
  borderColor?: string;
  locked?: boolean;
  avatarColors?: string[];
  themeMode?: 'light' | 'dark';
  dossier: {
    collection: string;
    releaseDate: string;
    serialId: string;
    xpPerTap: string;
    composition: string;
    activeMissions: string[];
  };
}

const ClosetSlot = ({ index, item, onOpen }: { index: string, item?: ClosetItemData, onOpen: (item: ClosetItemData) => void }) => {
  if (item) {
    const isActiveTheme = item.type === 'theme' && item.borderColor === '#FFB000';

    return (
      <Box 
        border="1px solid" 
        borderColor={item.borderColor || "white"}
        h="140px" 
        position="relative" 
        bg="black"
        cursor="pointer"
        transition="all 0.2s"
        onClick={() => !item.locked && onOpen(item)}
        _hover={!item.locked ? { transform: 'scale(1.02)', borderColor: "#FFB000" } : {}}
      >
        <Text position="absolute" top={1} left={1} fontSize="6px" color="whiteAlpha.400" fontFamily="monospace">{index}</Text>
        <Center h="full">
          {item.locked ? (
             <Box border="1px solid whiteAlpha.300" p={4} bg="whiteAlpha.100">
                <Icon as={PiShoppingBagFill} color="whiteAlpha.300" boxSize="30px" />
                <Text fontSize="5px" color="whiteAlpha.300" mt={1} textAlign="center" fontWeight="900">LOCKED</Text>
             </Box>
          ) : (
            item.type === 'theme' ? (
               <Icon as={item.themeMode === 'light' ? PiSunFill : PiMoonFill} color="white" boxSize="35px" />
            ) : item.type === 'physical' ? (
              <TShirtIcon />
            ) : (
              <AvatarGrid colors={item.avatarColors || []} size="60px" />
            )
          )}
        </Center>
        {item.borderColor && <Box position="absolute" bottom={0} left={0} right={0} h="15px" bg={item.borderColor} opacity={isActiveTheme ? 0.8 : 0.3} />}
      </Box>
    )
  }

  return (
    <Box 
      border="1px dashed" 
      borderColor="whiteAlpha.300" 
      h="140px" 
      position="relative"
    >
      <Text position="absolute" top={1} left={1} fontSize="6px" color="whiteAlpha.400" fontFamily="monospace">{index}</Text>
      <Center h="full">
        <Box w="2px" h="2px" bg="whiteAlpha.300" borderRadius="full" />
      </Center>
    </Box>
  )
}

const Closet = () => {
  const [mode, setMode] = useState<'physical' | 'digital'>('physical');
  const { colorMode, setColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<ClosetItemData | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const physical_items: Record<string, ClosetItemData> = {
    '01': { 
      id: 'P01', 
      type: 'physical', 
      name: 'NEO_HOODIE_01', 
      borderColor: '#D53F8C',
      dossier: {
        collection: 'GENESYS_PHASE_1',
        releaseDate: '2026-01-15',
        serialId: 'SN-2026-0387',
        xpPerTap: '40',
        composition: '100% ORGANIC FRENCH TERRY (450 GSM)',
        activeMissions: [
          'Complete 3 artifact taps this week',
          'Share this artifact profile 2 times'
        ]
      }
    },
    '02': { 
      id: 'P02', 
      type: 'physical', 
      name: 'MONARCH_TEE_04', 
      borderColor: '#38A169',
      dossier: {
        collection: 'LONDON_DROP_25',
        releaseDate: '2025-05-12',
        serialId: 'SN-2025-0912',
        xpPerTap: '25',
        composition: '100% ORGANIC COTTON (220 GSM)',
        activeMissions: [
          'Visit a Papillon retail node',
          'Scan 5 times in 24 hours'
        ]
      }
    },
    '03': { 
      id: 'P03', 
      type: 'physical', 
      name: 'UNKNOWN_ASSET', 
      locked: true,
      dossier: {
        collection: 'LOCKED',
        releaseDate: '???',
        serialId: '???',
        xpPerTap: '0',
        composition: 'UNKNOWN',
        activeMissions: []
      }
    },
    '04': { 
      id: 'P04', 
      type: 'physical', 
      name: 'SYSTEM_TOTE_v1',
      borderColor: 'white',
      dossier: {
        collection: 'GENESIS_COLLECTION',
        releaseDate: '2024-11-01',
        serialId: 'SN-2024-0001',
        xpPerTap: '10',
        composition: 'RECYCLED TECH NYLON',
        activeMissions: [
          'Initial system handshake',
          'Register phygital vault'
        ]
      }
    },
  };

  const digital_items: Record<string, ClosetItemData> = {
    '01': {
      id: 'T01',
      type: 'theme',
      name: 'BASIC_LIGHT_THEME',
      themeMode: 'light',
      borderColor: colorMode === 'light' ? '#FFB000' : 'white',
      dossier: {
        collection: 'SYSTEM_PROTOCOLS',
        releaseDate: '2024-01-01',
        serialId: 'THM-L-001',
        xpPerTap: '0',
        composition: 'HIGH_CONTRAST_EMISSION',
        activeMissions: ['Sync interface to Solar Day']
      }
    },
    '02': {
      id: 'T02',
      type: 'theme',
      name: 'BASIC_DARK_THEME',
      themeMode: 'dark',
      borderColor: colorMode === 'dark' ? '#FFB000' : 'white',
      dossier: {
        collection: 'SYSTEM_PROTOCOLS',
        releaseDate: '2024-01-01',
        serialId: 'THM-D-001',
        xpPerTap: '0',
        composition: 'LOW_LIGHT_ENCRYPTION',
        activeMissions: ['Maintain stealth protocols']
      }
    },
    '03': {
      id: 'D01',
      type: 'digital',
      name: 'IDENTITY_MATRIX_01',
      borderColor: '#FFB000',
      avatarColors: ['white', 'purple.500', 'black', 'orange.400', 'white', 'purple.500', 'black', 'black', 'white'],
      dossier: {
        collection: 'DIGITAL_GENESIS',
        releaseDate: '2026-03-10',
        serialId: 'ID-001-ALPHA',
        xpPerTap: '50',
        composition: 'NEURAL_LINK_PROTOCOL (v1.2)',
        activeMissions: [
          'Sync with physical counterpart',
          'Update status 5 times'
        ]
      }
    },
    '04': {
      id: 'D02',
      type: 'digital',
      name: 'IDENTITY_MATRIX_02',
      borderColor: 'cyan.400',
      avatarColors: ['black', 'yellow.400', 'black', 'yellow.400', 'purple.500', 'yellow.400', 'black', 'yellow.400', 'black'],
      dossier: {
        collection: 'NEO_CYBER_SERIES',
        releaseDate: '2026-04-15',
        serialId: 'ID-002-BETA',
        xpPerTap: '30',
        composition: 'CYAN_EMISSION_MESH',
        activeMissions: [
          'Visit Neo_City node',
          'Collect 5 stamps'
        ]
      }
    }
  };

  const current_items = mode === 'physical' ? physical_items : digital_items;

  const handleOpen = (item: ClosetItemData) => {
    setSelectedItem(item);
    setIsFlipped(false);
    onOpen();
  }

  const handleThemeApply = () => {
    if (selectedItem?.type === 'theme' && selectedItem.themeMode) {
      setColorMode(selectedItem.themeMode);
      onClose();
    }
  }

  return (
    <Box bg="black" minH="100vh" pb="100px">
      <Container maxW="container.sm" p={0}>
        {/* Header */}
        <Box p={8} bg="black">
          <VStack align="start" spacing={2}>
            <Heading fontSize="5xl" fontWeight="900" fontStyle="italic" color="white" fontFamily="'Archivo Black', sans-serif">
              CLOSET
            </Heading>
            <Text fontSize="9px" fontWeight="900" color="#FFB000" fontFamily="monospace" letterSpacing="0.1em">
              ASSETS_VERIFIED // {Object.keys(current_items).filter(k => !current_items[k].locked).length}
            </Text>
          </VStack>
          <Box h="12px" bg="#FFB000" w="100%" mt={6} />
        </Box>

        {/* Tab Switcher */}
        <Box p={6}>
          <Flex 
            border="1px solid white" 
            borderRadius="full" 
            p="2px"
            bg="black"
          >
            <Button 
              flex={1} 
              h="36px"
              borderRadius="full" 
              bg={mode === 'physical' ? "#FFB000" : "transparent"}
              color={mode === 'physical' ? "black" : "white"}
              fontSize="9px"
              fontWeight="900"
              onClick={() => setMode('physical')}
              leftIcon={<Box as="span" h="8px" w="8px" border="1px solid" borderColor={mode === 'physical' ? "black" : "white"} borderRadius="full" bg={mode === 'physical' ? "black" : "transparent"} />}
              _hover={{}}
            >
              PHYSICAL
            </Button>
            <Button 
              flex={1} 
              h="36px"
              borderRadius="full" 
              bg={mode === 'digital' ? "#FFB000" : "transparent"}
              color={mode === 'digital' ? "black" : "white"}
              fontSize="9px"
              fontWeight="900"
              onClick={() => setMode('digital')}
              leftIcon={<Box as="span" h="8px" w="8px" border="1px solid" borderColor={mode === 'digital' ? "black" : "white"} borderRadius="full" bg={mode === 'digital' ? "black" : "transparent"} />}
              _hover={{}}
            >
              DIGITAL
            </Button>
          </Flex>
        </Box>

        {/* Info Bar */}
        <Box borderY="1px solid whiteAlpha.300" px={6} py={2}>
          <Flex justify="space-between" align="center">
            <Text fontSize="7px" fontWeight="900" color="white" fontFamily="monospace">PROTOCOL: {mode.toUpperCase()}_STORAGE</Text>
            <Text fontSize="7px" fontWeight="900" color="white" fontFamily="monospace">VAULT_SYNC: ONLINE</Text>
          </Flex>
        </Box>

        {/* Grid Section */}
        <Box p={6}>
          {/* Grid Header */}
          <Box border="1px solid white" borderBottom="none" p={4} bg="black">
            <Flex justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Heading fontSize="xs" fontWeight="900" color="white" fontFamily="'Archivo Black', sans-serif">
                  STORAGE_SLOTS // {Object.keys(current_items).length}
                </Heading>
              </VStack>
              <Button 
                size="xs" 
                variant="outline" 
                color="white" 
                borderColor="white" 
                borderRadius="0"
                leftIcon={<MdTune />}
                fontSize="8px"
                fontWeight="900"
                h="24px"
              >
                REFINE
              </Button>
            </Flex>
          </Box>

          {/* Asset Grid */}
          <Box border="1px solid white" p={4}>
            <Flex justify="space-between" mb={4} borderBottom="1px solid whiteAlpha.300" pb={1}>
              <Text fontSize="6px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace">SLOT_ID</Text>
              <Text fontSize="6px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace">PROTOCOL_TAG</Text>
            </Flex>
            
            <SimpleGrid columns={3} spacing={3}>
              <ClosetSlot index="01" item={current_items['01']} onOpen={handleOpen} />
              <ClosetSlot index="02" item={current_items['02']} onOpen={handleOpen} />
              <ClosetSlot index="03" item={current_items['03']} onOpen={handleOpen} />
              <ClosetSlot index="04" item={current_items['04']} onOpen={handleOpen} />
              <ClosetSlot index="05" onOpen={handleOpen} />
              <ClosetSlot index="06" onOpen={handleOpen} />
              <ClosetSlot index="07" onOpen={handleOpen} />
              <ClosetSlot index="08" onOpen={handleOpen} />
              <ClosetSlot index="09" onOpen={handleOpen} />
            </SimpleGrid>

            {/* Grid Footer Info */}
            <Flex justify="end" mt={4}>
              <Text fontSize="6px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">
                SYSTEM_STABILITY: 100% // LOAD_COMPLETE
              </Text>
            </Flex>
          </Box>
        </Box>
      </Container>

      {/* Flip Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
        <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.900" />
        <ModalContent bg="transparent" boxShadow="none" border="none" maxW="340px">
          <ModalBody p={0}>
            {selectedItem && (
              <Box perspective="1000px" w="full" h="580px">
                <MotionBox
                  w="full"
                  h="full"
                  position="relative"
                  transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* FRONT */}
                  <Center
                    position="absolute"
                    inset={0}
                    bg="black"
                    border="4px solid"
                    borderColor={selectedItem.borderColor || "white"}
                    style={{ backfaceVisibility: "hidden" }}
                    flexDirection="column"
                    p={8}
                    onClick={() => setIsFlipped(true)}
                    cursor="pointer"
                  >
                    <VStack spacing={8}>
                      <Box border="2px solid white" p={10}>
                        {selectedItem.type === 'theme' ? (
                          <Icon as={selectedItem.themeMode === 'light' ? PiSunFill : PiMoonFill} color="white" boxSize="100px" />
                        ) : selectedItem.type === 'physical' ? (
                          <TShirtIcon boxSize="100px" />
                        ) : (
                          <AvatarGrid colors={selectedItem.avatarColors || []} size="120px" />
                        )}
                      </Box>
                      <VStack spacing={1}>
                        <Text fontSize="10px" fontWeight="900" color="#FFB000" fontFamily="monospace">
                          {selectedItem.name}
                        </Text>
                        <Text fontSize="8px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">
                          SLOT_INDEX: {selectedItem.id}
                        </Text>
                      </VStack>
                      <HStack color="whiteAlpha.400">
                        <Icon as={MdRefresh} />
                        <Text fontSize="9px" fontWeight="900">TAP TO VIEW MISSION_DOSSIER</Text>
                      </HStack>
                    </VStack>
                  </Center>

                  {/* BACK (MISSION_DOSSIER) */}
                  <Box
                    position="absolute"
                    inset={0}
                    bg="black"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    border="4px solid white"
                    p={0}
                    display="flex"
                    flexDirection="column"
                  >
                    {/* Dossier Header */}
                    <Box p={6} borderBottom="1px solid whiteAlpha.300">
                      <Flex justify="space-between" align="start">
                        <VStack align="start" spacing={0}>
                          <Heading fontSize="2xl" fontWeight="900" color="white" fontStyle="italic" letterSpacing="-0.02em">
                            MISSION_DOSSIER
                          </Heading>
                          <Text fontSize="8px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace">
                            ON-CHAIN VERIFICATION: SECURE
                          </Text>
                        </VStack>
                        <IconButton 
                          aria-label="Close" 
                          icon={<MdClose />} 
                          variant="outline" 
                          color="white" 
                          borderColor="whiteAlpha.400" 
                          borderRadius="0"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onClose(); }}
                        />
                      </Flex>
                      <Box h="4px" bg={selectedItem.borderColor || "white"} w="full" mt={4} />
                    </Box>

                    {/* Dossier Content */}
                    <Box flex={1} p={6} overflowY="auto">
                      <VStack align="stretch" spacing={5}>
                        <Box>
                          <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">COLLECTION</Text>
                          <Text fontSize="xs" fontWeight="900" color="white">{selectedItem.dossier.collection}</Text>
                        </Box>
                        
                        <HStack spacing={10}>
                          <Box>
                            <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">RELEASE_DATE</Text>
                            <Text fontSize="xs" fontWeight="900" color="white">{selectedItem.dossier.releaseDate}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">SERIAL_ID</Text>
                            <Text fontSize="xs" fontWeight="900" color="white">{selectedItem.dossier.serialId}</Text>
                          </Box>
                        </HStack>

                        <Box>
                          <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">XP_PER_TAP</Text>
                          <Text fontSize="xl" fontWeight="900" color="white">{selectedItem.dossier.xpPerTap}</Text>
                        </Box>

                        <Box>
                          <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">COMPOSITION</Text>
                          <Text fontSize="9px" fontWeight="900" color="white">{selectedItem.dossier.composition}</Text>
                        </Box>

                        <Divider borderColor="whiteAlpha.300" />

                        {selectedItem.type === 'theme' ? (
                           <Button 
                            w="full" 
                            h="60px" 
                            bg={selectedItem.borderColor === '#FFB000' ? "whiteAlpha.200" : "white"} 
                            color={selectedItem.borderColor === '#FFB000' ? "white" : "black"} 
                            borderRadius="0" 
                            fontSize="sm" 
                            fontWeight="900" 
                            onClick={handleThemeApply}
                            isDisabled={selectedItem.borderColor === '#FFB000'}
                          >
                            {selectedItem.borderColor === '#FFB000' ? 'ALREADY_ACTIVE' : 'APPLY_PROTOCOL'}
                          </Button>
                        ) : (
                          <Box>
                            <Text fontSize="7px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace" mb={2}>ACTIVE_MISSIONS</Text>
                            <VStack align="start" spacing={1}>
                              {selectedItem.dossier.activeMissions.map((mission, i) => (
                                <Text key={i} fontSize="10px" fontWeight="900" color="whiteAlpha.800">
                                  [{i + 1}] {mission}
                                </Text>
                              ))}
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    </Box>

                    {/* Dossier Footer */}
                    <Box p={4} borderTop="1px solid whiteAlpha.300">
                      <Center cursor="pointer" onClick={() => setIsFlipped(false)}>
                        <HStack color="whiteAlpha.400" spacing={1}>
                          <Icon as={MdRefresh} boxSize="10px" />
                          <Text fontSize="8px" fontWeight="900">TAP TO SPIN BACK</Text>
                        </HStack>
                      </Center>
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

export default Closet
