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
  useColorMode,
  useColorModeValue,
  Spinner,
  useToast
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { MdTune, MdRefresh, MdClose } from 'react-icons/md'
import { PiShoppingBagFill, PiSunFill, PiMoonFill } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

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

const ClosetSlot = ({ index, item, onOpen, text, border, bg }: { index: string, item?: ClosetItemData, onOpen: (item: ClosetItemData) => void, text: string, border: string, bg: string }) => {
  if (item) {
    const isActiveTheme = item.type === 'theme' && item.borderColor === '#FFB000';

    return (
      <Box 
        border="1px solid" 
        borderColor={item.borderColor || border}
        h="140px" 
        position="relative" 
        bg={bg}
        cursor="pointer"
        transition="all 0.2s"
        onClick={() => !item.locked && onOpen(item)}
        _hover={!item.locked ? { transform: 'scale(1.02)', borderColor: "#FFB000" } : {}}
      >
        <Text position="absolute" top={1} left={1} fontSize="6px" color={text} opacity={0.4} fontFamily="monospace">{index}</Text>
        <Center h="full">
          {item.locked ? (
             <Box border="1px solid" borderColor={border} p={4} bg={bg} opacity={0.5}>
                <Icon as={PiShoppingBagFill} color={text} opacity={0.3} boxSize="30px" />
                <Text fontSize="5px" color={text} opacity={0.3} mt={1} textAlign="center" fontWeight="900">LOCKED</Text>
             </Box>
          ) : (
            item.type === 'theme' ? (
               <Icon as={item.themeMode === 'light' ? PiSunFill : PiMoonFill} color={text} boxSize="35px" />
            ) : item.type === 'physical' ? (
              <TShirtIcon color={text} />
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
      borderColor={border} 
      h="140px" 
      position="relative"
    >
      <Text position="absolute" top={1} left={1} fontSize="6px" color={text} opacity={0.4} fontFamily="monospace">{index}</Text>
      <Center h="full">
        <Box w="2px" h="2px" bg={text} opacity={0.3} borderRadius="full" />
      </Center>
    </Box>
  )
}

const Closet = () => {
  const [mode, setMode] = useState<'physical' | 'digital'>('physical');
  const { colorMode, setColorMode } = useColorMode();
  const { setActiveAvatarColors } = useStore();
  const toast = useToast();
  
  const bg = useColorModeValue("white", "black");
  const cardBg = useColorModeValue("gray.50", "gray.900");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const border = useColorModeValue("gray.300", "whiteAlpha.300");
  const inverseText = useColorModeValue("white", "black");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<ClosetItemData | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleEquip = () => {
    if (!selectedItem) return;

    const name = selectedItem.name.toUpperCase();
    if (name.includes('LIGHT_THEME') || selectedItem.themeMode === 'light') {
      setColorMode('light');
      toast({ title: 'PROTOCOL_EQUIPPED: LIGHT_MODE', status: 'success', duration: 2000 });
    } else if (name.includes('DARK_THEME') || selectedItem.themeMode === 'dark') {
      setColorMode('dark');
      toast({ title: 'PROTOCOL_EQUIPPED: DARK_MODE', status: 'success', duration: 2000 });
    } else if (selectedItem.avatarColors) {
      setActiveAvatarColors(selectedItem.avatarColors);
      toast({ title: 'PROTOCOL_EQUIPPED: AVATAR_SYNCED', status: 'success', duration: 2000 });
    }
    onClose();
  };
  
  // LIVE DATA STATES
  const { user } = usePrivy();
  const [livePhysicalItems, setLivePhysicalItems] = useState<Record<string, ClosetItemData>>({});
  const [isLoading, setIsLoading] = useState(true);

  // FETCH ARTIFACTS FROM DATABASE
  useEffect(() => {
    const fetchArtifacts = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('artifacts')
          .select('*')
          .eq('owner_id', user.id)
          .eq('is_activated', true); // Only fetch successfully claimed items

        if (error) throw error;

        if (data) {
          const fetchedItems: Record<string, ClosetItemData> = {};
          
          // Map DB records to UI slots (01, 02, etc.)
          data.forEach((artifact, index) => {
            const slotKey = `0${index + 1}`.slice(-2);
            
            // Strictly dynamic: Use product_name if available, fallback to name, or 'ARTIFACT'
            const product_name = (artifact.product_name || artifact.name || 'ARTIFACT').toUpperCase();

            fetchedItems[slotKey] = {
              id: artifact.tag_id,
              type: 'physical',
              name: product_name,
              borderColor: '#FFB000', // Monarch Gold for active items
              dossier: {
                collection: artifact.collection?.toUpperCase() || 'GENERAL_RELEASE',
                releaseDate: new Date(artifact.created_at).toISOString().split('T')[0],
                serialId: `SN-${artifact.tag_id.toUpperCase()}`,
                xpPerTap: '50',
                composition: `${artifact.season?.toUpperCase() || 'CORE'}_COLLECTION`,
                activeMissions: [
                  'Initialize system handshake',
                  'Register phygital vault'
                ]
              }
            };
          });
          
          setLivePhysicalItems(fetchedItems);
        }
      } catch (err) {
        console.error("Uplink to Registry Failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtifacts();
  }, [user]);

  // Keep digital items hardcoded for now (Themes/Avatars)
  const digital_items: Record<string, ClosetItemData> = {
    '01': {
      id: 'T01',
      type: 'theme',
      name: 'LIGHT_THEME',
      themeMode: 'light',
      borderColor: colorMode === 'light' ? '#FFB000' : border,
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
      name: 'DARK_THEME',
      themeMode: 'dark',
      borderColor: colorMode === 'dark' ? '#FFB000' : border,
      dossier: {
        collection: 'SYSTEM_PROTOCOLS',
        releaseDate: '2024-01-01',
        serialId: 'THM-D-001',
        xpPerTap: '0',
        composition: 'LOW_LIGHT_ENCRYPTION',
        activeMissions: ['Maintain stealth protocols']
      }
    }
  };

  const current_items = mode === 'physical' ? livePhysicalItems : digital_items;

  const handleOpen = (item: ClosetItemData) => {
    setSelectedItem(item);
    setIsFlipped(false);
    onOpen();
  }

  return (
    <Box bg={bg} minH="100vh" pb="100px">
      <Container maxW="container.sm" p={0}>
        {/* Header */}
        <Box p={8} bg={bg}>
          <VStack align="start" spacing={2}>
            <Heading fontSize="5xl" fontWeight="900" fontStyle="italic" color={text} fontFamily="'Archivo Black', sans-serif">
              CLOSET
            </Heading>
            <Text fontSize="9px" fontWeight="900" color="#FFB000" fontFamily="monospace" letterSpacing="0.1em">
              {isLoading ? 'SYNCING_REGISTRY...' : `ASSETS_VERIFIED // ${Object.keys(current_items).filter(k => !current_items[k].locked).length}`}
            </Text>
          </VStack>
          <Box h="12px" bg="#FFB000" w="100%" mt={6} />
        </Box>

        {/* Tab Switcher */}
        <Box p={6}>
          <Flex 
            border="1px solid" 
            borderColor={text}
            borderRadius="full" 
            p="2px"
            bg={bg}
          >
            <Button 
              flex={1} 
              h="36px"
              borderRadius="full" 
              bg={mode === 'physical' ? "#FFB000" : "transparent"}
              color={mode === 'physical' ? inverseText : text}
              fontSize="9px"
              fontWeight="900"
              onClick={() => setMode('physical')}
              leftIcon={<Box as="span" h="8px" w="8px" border="1px solid" borderColor={mode === 'physical' ? inverseText : text} borderRadius="full" bg={mode === 'physical' ? inverseText : "transparent"} />}
              _hover={{}}
            >
              PHYSICAL
            </Button>
            <Button 
              flex={1} 
              h="36px"
              borderRadius="full" 
              bg={mode === 'digital' ? "#FFB000" : "transparent"}
              color={mode === 'digital' ? inverseText : text}
              fontSize="9px"
              fontWeight="900"
              onClick={() => setMode('digital')}
              leftIcon={<Box as="span" h="8px" w="8px" border="1px solid" borderColor={mode === 'digital' ? inverseText : text} borderRadius="full" bg={mode === 'digital' ? inverseText : "transparent"} />}
              _hover={{}}
            >
              DIGITAL
            </Button>
          </Flex>
        </Box>

        {/* Info Bar */}
        <Box borderY="1px solid" borderColor={border} px={6} py={2}>
          <Flex justify="space-between" align="center">
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">PROTOCOL: {mode.toUpperCase()}_STORAGE</Text>
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">VAULT_SYNC: {isLoading ? 'PENDING' : 'ONLINE'}</Text>
          </Flex>
        </Box>

        {/* Grid Section */}
        <Box p={6}>
          {/* Grid Header */}
          <Box border="1px solid" borderColor={text} borderBottom="none" p={4} bg={bg}>
            <Flex justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Heading fontSize="xs" fontWeight="900" color={text} fontFamily="'Archivo Black', sans-serif">
                  STORAGE_SLOTS // {Object.keys(current_items).length}
                </Heading>
              </VStack>
              <Button 
                size="xs" 
                variant="outline" 
                color={text} 
                borderColor={text} 
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
          <Box border="1px solid" borderColor={text} p={4}>
            <Flex justify="space-between" mb={4} borderBottom="1px solid" borderColor={border} pb={1}>
              <Text fontSize="6px" fontWeight="900" color={mutedText} fontFamily="monospace">SLOT_ID</Text>
              <Text fontSize="6px" fontWeight="900" color={mutedText} fontFamily="monospace">PROTOCOL_TAG</Text>
            </Flex>
            
            {isLoading ? (
              <Center h="200px">
                <Spinner color="#FFB000" />
              </Center>
            ) : (
              <SimpleGrid columns={3} spacing={3}>
                <ClosetSlot index="01" item={current_items['01']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="02" item={current_items['02']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="03" item={current_items['03']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="04" item={current_items['04']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="05" item={current_items['05']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="06" item={current_items['06']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="07" item={current_items['07']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="08" item={current_items['08']} onOpen={handleOpen} text={text} border={border} bg={bg} />
                <ClosetSlot index="09" item={current_items['09']} onOpen={handleOpen} text={text} border={border} bg={bg} />
              </SimpleGrid>
            )}

            {/* Grid Footer Info */}
            <Flex justify="end" mt={4}>
              <Text fontSize="6px" fontWeight="900" color={mutedText} opacity={0.4} fontFamily="monospace">
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
                    bg={bg}
                    border="4px solid"
                    borderColor={selectedItem.borderColor || border}
                    style={{ backfaceVisibility: "hidden" }}
                    flexDirection="column"
                    p={8}
                    onClick={() => setIsFlipped(true)}
                    cursor="pointer"
                  >
                    <VStack spacing={8}>
                      <Box border={`2px solid ${text}`} p={10}>
                        {selectedItem.type === 'theme' ? (
                          <Icon as={selectedItem.themeMode === 'light' ? PiSunFill : PiMoonFill} color={text} boxSize="100px" />
                        ) : selectedItem.type === 'physical' ? (
                          <TShirtIcon color={text} boxSize="100px" />
                        ) : (
                          <AvatarGrid colors={selectedItem.avatarColors || []} size="120px" />
                        )}
                      </Box>
                      <VStack spacing={2} textAlign="center">
                        {(() => {
                          const product_name = (selectedItem.name || "ARTIFACT").toUpperCase();
                          return (
                            <Text color={text} fontFamily="'Archivo Black', sans-serif" fontSize="xl" lineHeight="1">
                              {product_name}
                            </Text>
                          );
                        })()}
                        <Text fontSize="9px" fontWeight="900" color="#FFB000" fontFamily="monospace">
                          {selectedItem.dossier.collection} // {selectedItem.dossier.composition.replace('_COLLECTION', '')}
                        </Text>
                        <Box pt={2}>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" border="1px solid" borderColor={border} px={2} py={0.5}>
                            SERIAL: {selectedItem.id.toUpperCase()}
                          </Text>
                        </Box>
                      </VStack>
                      <HStack color={mutedText}>
                        <Icon as={MdRefresh} />
                        <Text fontSize="9px" fontWeight="900">TAP TO VIEW SPECS</Text>
                      </HStack>
                    </VStack>
                  </Center>

                  {/* BACK (ARTIFACT_METADATA) */}
                  <Box
                    position="absolute"
                    inset={0}
                    bg={bg}
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    border={`4px solid ${text}`}
                    p={8}
                    display="flex"
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    textAlign="center"
                  >
                    <IconButton 
                      aria-label="Close" 
                      icon={<MdClose />} 
                      variant="ghost" 
                      color={mutedText} 
                      position="absolute"
                      top={2}
                      right={2}
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      _hover={{ color: text }}
                    />

                    <VStack spacing={10} w="full">
                      <VStack spacing={2}>
                        <Text color={text} fontFamily="'Archivo Black', sans-serif" fontSize="3xl" lineHeight="1.1">
                          {selectedItem.name}
                        </Text>
                        <Box h="2px" bg="#FFB000" w="40px" />
                      </VStack>

                      <VStack spacing={4} w="full">
                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>COLLECTION</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.collection}</Text>
                        </Box>
                        
                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>SEASON</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">
                            {selectedItem.dossier.composition.replace('_COLLECTION', '')}
                          </Text>
                        </Box>

                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>SERIAL_IDENTIFIER</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.serialId}</Text>
                        </Box>

                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>REGISTRY_DATE</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.releaseDate}</Text>
                        </Box>
                      </VStack>

                      {(selectedItem.type === 'theme' || 
                        selectedItem.type === 'digital' || 
                        selectedItem.name.toUpperCase().includes('MODE') ||
                        selectedItem.dossier.collection === 'SYSTEM_PROTOCOLS') && (
                        <Button 
                          w="full" 
                          h="50px" 
                          bg="#FFB000" 
                          color="black" 
                          borderRadius="0" 
                          fontSize="xs" 
                          fontWeight="900" 
                          onClick={handleEquip}
                          _hover={{ bg: text, color: bg }}
                        >
                          EQUIP
                        </Button>
                      )}
                    </VStack>

                    {/* Footer - Inside Metadata Box */}
                    <Box mt="auto" pt={4} w="full">
                      <Center cursor="pointer" onClick={() => setIsFlipped(false)}>
                        <HStack color={mutedText} spacing={1}>
                          <Icon as={MdRefresh} boxSize="10px" />
                          <Text fontSize="8px" fontWeight="900">TAP_TO_FLIP_BACK</Text>
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
