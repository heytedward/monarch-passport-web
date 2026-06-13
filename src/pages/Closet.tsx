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
  useColorMode,
  useColorModeValue,
  Spinner,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem
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
        _hover={!item.locked ? { transform: 'scale(1.02)', borderColor: "var(--monarch-accent)" } : {}}
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
        {item.borderColor && <Box position="absolute" bottom={0} left={0} right={0} h="15px" bg={item.borderColor} opacity={0.3} />}
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
  const [filter, setFilter] = useState<'ALL' | 'AVATARS' | 'THEMES'>('ALL');
  const { colorMode, setColorMode } = useColorMode();
  const { setActiveAvatarColors, setActiveTheme, activeTheme, activeAvatar, fetchUserProfile } = useStore();
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
  
  const { user } = usePrivy();
  const [ownedAssets, setOwnedAssets] = useState<ClosetItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const brandAccent = activeTheme === 'CRIMSON_OVERRIDE' ? '#DC143C' : '#FFB000';

  const handleEquip = async () => {
    if (!selectedItem || !user?.id) return;

    try {
      const isTheme = selectedItem.type === 'theme';
      const updateData = isTheme 
        ? { active_theme: selectedItem.id } 
        : { active_avatar: selectedItem.id };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Immediate local sync
      if (isTheme) setActiveTheme(selectedItem.id);
      
      // Sync full profile from server
      await fetchUserProfile(user.id);
      
      // Additional effects
      if (isTheme) {
        if (selectedItem.name.includes('LIGHT')) setColorMode('light');
        if (selectedItem.name.includes('DARK') || selectedItem.id === 'CRIMSON_OVERRIDE') setColorMode('dark');
      } else if (selectedItem.avatarColors) {
        setActiveAvatarColors(selectedItem.avatarColors);
      }

      toast({ 
        title: `PROTOCOL_EQUIPPED: ${selectedItem.name.toUpperCase()}`, 
        status: 'success', 
        duration: 2000 
      });
      onClose();
    } catch (err) {
      console.error("Equip Failed:", err);
      toast({ title: 'EQUIP_FAILED', status: 'error', duration: 2000 });
    }
  };

  useEffect(() => {
    const fetchOwnedAssets = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        // Fetch from user_assets joined with products
        const { data, error } = await supabase
          .from('user_assets')
          .select(`
            id,
            product_id,
            products (*)
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        // Default assets (Light/Dark/Crimson themes)
        const defaults: ClosetItemData[] = [
          {
            id: 'SYSTEM_LIGHT',
            type: 'theme',
            name: 'SYSTEM_LIGHT',
            themeMode: 'light',
            borderColor: activeTheme === 'SYSTEM_LIGHT' ? brandAccent : border,
            dossier: {
              collection: 'SYSTEM_PROTOCOLS',
              releaseDate: '2024-01-01',
              serialId: 'THM-L-001',
              xpPerTap: '0',
              composition: 'HIGH_CONTRAST',
              activeMissions: ['Sync interface to Solar Day']
            }
          },
          {
            id: 'SYSTEM_DARK',
            type: 'theme',
            name: 'SYSTEM_DARK',
            themeMode: 'dark',
            borderColor: (activeTheme === 'SYSTEM_DARK' || !activeTheme) ? brandAccent : border,
            dossier: {
              collection: 'SYSTEM_PROTOCOLS',
              releaseDate: '2024-01-01',
              serialId: 'THM-D-001',
              xpPerTap: '0',
              composition: 'LOW_LIGHT',
              activeMissions: ['Maintain stealth protocols']
            }
          },
          {
            id: 'CRIMSON_OVERRIDE',
            type: 'theme',
            name: 'CRIMSON_OVERRIDE',
            themeMode: 'dark',
            borderColor: activeTheme === 'CRIMSON_OVERRIDE' ? brandAccent : border,
            dossier: {
              collection: 'SYSTEM_PROTOCOLS',
              releaseDate: '2024-01-01',
              serialId: 'THM-C-001',
              xpPerTap: '0',
              composition: 'CRIMSON_EMISSION',
              activeMissions: ['Override default palette']
            }
          }
        ];

        if (data) {
          const mapped: ClosetItemData[] = data.map((asset: any) => {
            const p = asset.products;
            return {
              id: p.id,
              type: p.type === 'digital' ? (p.category === 'THEMES' ? 'theme' : 'digital') : 'physical',
              name: p.name.toUpperCase(),
              avatarColors: p.avatar_colors,
              borderColor: (activeTheme === p.id || activeAvatar === p.id) ? brandAccent : border,
              dossier: {
                collection: p.category || 'GENERAL_RELEASE',
                releaseDate: new Date(p.created_at || Date.now()).toISOString().split('T')[0],
                serialId: `SN-${p.id.slice(0, 8).toUpperCase()}`,
                xpPerTap: '50',
                composition: `${p.type.toUpperCase()}_ASSET`,
                activeMissions: ['Verified in local vault']
              }
            };
          });
          setOwnedAssets([...defaults, ...mapped]);
        } else {
          setOwnedAssets(defaults);
        }
      } catch (err) {
        console.error("Registry Sync Failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOwnedAssets();
  }, [user, activeTheme, activeAvatar, brandAccent]);

  const current_items = ownedAssets.filter(item => {
    const isPhysicalMode = mode === 'physical';
    const isDigitalMode = mode === 'digital';

    if (isPhysicalMode) return item.type === 'physical';
    
    if (isDigitalMode) {
      if (filter === 'AVATARS') return item.type === 'digital'; // 'digital' type is used for avatars
      if (filter === 'THEMES') return item.type === 'theme';
      return item.type === 'digital' || item.type === 'theme';
    }

    return false;
  });

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
            <Text fontSize="9px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace" letterSpacing="0.1em">
              {isLoading ? 'SYNCING_REGISTRY...' : `ASSETS_VERIFIED // ${current_items.length}`}
            </Text>
          </VStack>
          <Box h="12px" bg="var(--monarch-accent)" w="100%" mt={6} />
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
              bg={mode === 'physical' ? "var(--monarch-accent)" : "transparent"}
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
              bg={mode === 'digital' ? "var(--monarch-accent)" : "transparent"}
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
                  STORAGE_SLOTS // {isLoading ? "..." : current_items.length}
                </Heading>
              </VStack>
              <Menu>
                <MenuButton 
                  as={Button}
                  size="xs" 
                  variant="outline" 
                  color={text} 
                  borderColor={text} 
                  borderRadius="0"
                  leftIcon={<MdTune />}
                  fontSize="8px"
                  fontWeight="900"
                  h="24px"
                  _hover={{ bg: cardBg }}
                  _active={{ bg: border }}
                >
                  REFINE: {filter}
                </MenuButton>
                <MenuList bg={bg} border={`1px solid ${text}`} borderRadius="0" minW="120px">
                  <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setFilter('ALL')}>ALL_ASSETS</MenuItem>
                  {mode === 'digital' && (
                    <>
                      <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setFilter('AVATARS')}>AVATARS_ONLY</MenuItem>
                      <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setFilter('THEMES')}>THEMES_ONLY</MenuItem>
                    </>
                  )}
                </MenuList>
              </Menu>
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
                <Spinner color="var(--monarch-accent)" />
              </Center>
            ) : (
              <SimpleGrid columns={3} spacing={3}>
                {current_items.map((item, idx) => (
                  <ClosetSlot key={item.id} index={(idx + 1).toString().padStart(2, '0')} item={item} onOpen={handleOpen} text={text} border={border} bg={bg} />
                ))}
                
                {Array.from({ length: Math.max(0, 9 - current_items.length) }).map((_, idx) => (
                  <ClosetSlot key={`empty-${idx}`} index={(current_items.length + idx + 1).toString().padStart(2, '0')} onOpen={() => {}} text={text} border={border} bg={bg} />
                ))}
              </SimpleGrid>
            )}

            {/* Grid Footer Info */}
            <Flex justify="end" mt={4}>
              <Text fontSize="6px" fontWeight="900" color={mutedText} opacity={0.4} fontFamily="monospace">
                SYSTEM_STABILITY: 100% // {isLoading ? "LOADING..." : "LOAD_COMPLETE"}
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
                        <Text color={text} fontFamily="'Archivo Black', sans-serif" fontSize="xl" lineHeight="1">
                          {selectedItem.name}
                        </Text>
                        <Text fontSize="9px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace">
                          {selectedItem.dossier.collection} // {selectedItem.dossier.composition}
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
                        <Box h="2px" bg="var(--monarch-accent)" w="40px" />
                      </VStack>

                      <VStack spacing={4} w="full">
                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>COLLECTION</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.collection}</Text>
                        </Box>
                        
                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>TYPE</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.composition}</Text>
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

                      {((selectedItem.id === activeTheme || selectedItem.id === activeAvatar) || (selectedItem.id === 'SYSTEM_DARK' && !activeTheme)) ? (
                        <Button 
                          w="full" 
                          h="50px" 
                          bg="gray.100" 
                          color="gray.400" 
                          borderRadius="0" 
                          fontSize="xs" 
                          fontWeight="900" 
                          disabled
                        >
                          [ EQUIPPED ]
                        </Button>
                      ) : (
                        (selectedItem.type === 'theme' || selectedItem.type === 'digital') && (
                          <Button 
                            w="full" 
                            h="50px" 
                            bg="var(--monarch-accent)" 
                            color="black" 
                            borderRadius="0" 
                            fontSize="xs" 
                            fontWeight="900" 
                            onClick={handleEquip}
                            _hover={{ bg: text, color: bg }}
                          >
                            EQUIP
                          </Button>
                        )
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
