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
  Circle,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue
} from '@chakra-ui/react'
import { useState } from 'react'
import { PiShoppingBagFill, PiCreditCardFill, PiCubeFill } from 'react-icons/pi'
import { Logo } from '../components/Logo'
import { MdFilterList, MdRefresh, MdClose } from 'react-icons/md'
import { motion } from 'framer-motion'
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

interface ShopItemData {
  id: string;
  type: 'physical' | 'digital';
  price: number;
  priceString: string;
  name: string;
  specs: { label: string; value: string }[];
  avatarColors?: string[];
  borderColor?: string;
}

const ShopSlot = ({ index, item, onOpen, text, border, bg, cardBg }: { index: string, item?: ShopItemData, onOpen: (item: ShopItemData) => void, text: string, border: string, bg: string, cardBg: string }) => {
  if (item) {
    return (
      <Box 
        border="1px solid"
        borderColor={item.borderColor || border}
        h="140px" 
        position="relative" 
        bg={bg}
        cursor="pointer"
        onClick={() => onOpen(item)}
        _hover={{ borderColor: "#FFB000" }}
        transition="all 0.2s"
      >
        <Text position="absolute" top={1} left={1} fontSize="6px" color={text} opacity={0.4} fontFamily="monospace">{index}</Text>
        <Center h="full" flexDirection="column">
          {item.type === 'physical' ? (
            <TShirtIcon color={text} />
          ) : (
            <AvatarGrid colors={item.avatarColors || []} size="60px" />
          )}
          <Box mt={2} bg={text} px={2} py={0.5}>
            <Text color={bg} fontSize="10px" fontWeight="900" fontFamily="monospace">{item.priceString}</Text>
          </Box>
        </Center>
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

const Shop = () => {
  const [mode, setMode] = useState<'physical' | 'digital'>('physical');
  const [filter, setFilter] = useState<'ALL' | 'PREMIUM' | 'BASIC'>('ALL');
  
  const bg = useColorModeValue("white", "black");
  const cardBg = useColorModeValue("gray.50", "gray.900");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const border = useColorModeValue("gray.300", "whiteAlpha.300");
  const inverseText = useColorModeValue("white", "black");

  const { isOpen: isItemOpen, onOpen: onItemOpen, onClose: onItemClose } = useDisclosure();
  const { isOpen: isCartOpen, onOpen: onCartOpen, onClose: onCartClose } = useDisclosure();
  
  const [selectedItem, setSelectedItem] = useState<ShopItemData | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  
  const { cart, addToCart, removeFromCart } = useStore();

  const physicalItems: ShopItemData[] = [
    { 
      id: 'P01', 
      type: 'physical',
      price: 79,
      priceString: '$79', 
      name: 'NEO_HOODIE_v1',
      specs: [
        { label: 'MATERIAL', value: 'PREMIUM_FIBER // 450GSM' },
        { label: 'HARDWARE', value: 'NTAG_424_DNA_CHIP' },
        { label: 'CLEARANCE', value: 'PROTOCOL_X402' }
      ]
    },
    { 
      id: 'P02', 
      type: 'physical',
      price: 29,
      priceString: '$29', 
      name: 'MONARCH_TEE_v1',
      specs: [
        { label: 'MATERIAL', value: 'ORGANIC_COTTON // 220GSM' },
        { label: 'HARDWARE', value: 'NFC_LINK_ENABLED' },
        { label: 'CLEARANCE', value: 'PROTOCOL_V1' }
      ]
    },
    { 
      id: 'P03', 
      type: 'physical',
      price: 49,
      priceString: '$49', 
      name: 'AGENT_SHELL_v2',
      specs: [
        { label: 'MATERIAL', value: 'TECH_NYLON // WATERPROOF' },
        { label: 'HARDWARE', value: 'DUAL_SYNC_HANDSHAKE' },
        { label: 'CLEARANCE', value: 'AGENTIC_COMMERCE' }
      ]
    },
  ];

  const digitalItems: ShopItemData[] = [
    {
      id: 'D01',
      type: 'digital',
      price: 499,
      priceString: '499 WNGS',
      name: 'IDENTITY_MATRIX_01',
      borderColor: '#FFB000',
      avatarColors: ['white', 'purple.500', 'black', 'orange.400', 'white', 'purple.500', 'black', 'black', 'white'],
      specs: [
        { label: 'TYPE', value: 'DIGITAL_IDENTITY' },
        { label: 'RARITY', value: 'LEGENDARY' },
        { label: 'SYNC', value: 'X402_COMPATIBLE' }
      ]
    },
    {
      id: 'D02',
      type: 'digital',
      price: 299,
      priceString: '299 WNGS',
      name: 'IDENTITY_MATRIX_02',
      borderColor: 'cyan.400',
      avatarColors: ['black', 'yellow.400', 'black', 'yellow.400', 'purple.500', 'yellow.400', 'black', 'yellow.400', 'black'],
      specs: [
        { label: 'TYPE', value: 'DIGITAL_IDENTITY' },
        { label: 'RARITY', value: 'RARE' },
        { label: 'SYNC', value: 'V1_SYNC' }
      ]
    },
    {
      id: 'D03',
      type: 'digital',
      price: 750,
      priceString: '750 WNGS',
      name: 'IDENTITY_MATRIX_03',
      borderColor: 'purple.500',
      avatarColors: ['white', 'white', 'orange.400', 'white', 'black', 'white', 'orange.400', 'white', 'white'],
      specs: [
        { label: 'TYPE', value: 'DIGITAL_IDENTITY' },
        { label: 'RARITY', value: 'MONARCH' },
        { label: 'SYNC', value: 'X402_COMPATIBLE' }
      ]
    },
    {
      id: 'D04',
      type: 'digital',
      price: 999,
      priceString: '999 WNGS',
      name: 'IDENTITY_MATRIX_04',
      borderColor: 'red.500',
      avatarColors: ['yellow.400', 'red.500', 'cyan.400', 'red.500', 'black', 'red.500', 'cyan.400', 'red.500', 'yellow.400'],
      specs: [
        { label: 'TYPE', value: 'DIGITAL_IDENTITY' },
        { label: 'RARITY', value: 'ULTRA_RARE' },
        { label: 'SYNC', value: 'X402_COMPATIBLE' }
      ]
    },
    {
      id: 'D05',
      type: 'digital',
      price: 150,
      priceString: '150 WNGS',
      name: 'IDENTITY_MATRIX_05',
      borderColor: 'orange.400',
      avatarColors: ['black', 'black', 'red.500', 'black', 'cyan.400', 'black', 'red.500', 'black', 'black'],
      specs: [
        { label: 'TYPE', value: 'DIGITAL_IDENTITY' },
        { label: 'RARITY', value: 'BASIC' },
        { label: 'SYNC', value: 'V1_SYNC' }
      ]
    },
    {
      id: 'D06',
      type: 'digital',
      price: 600,
      priceString: '600 WNGS',
      name: 'IDENTITY_MATRIX_06',
      borderColor: 'blue.500',
      avatarColors: ['cyan.400', 'white', 'cyan.400', 'white', 'red.500', 'white', 'cyan.400', 'white', 'cyan.400'],
      specs: [
        { label: 'TYPE', value: 'DIGITAL_IDENTITY' },
        { label: 'RARITY', value: 'MONARCH' },
        { label: 'SYNC', value: 'X402_COMPATIBLE' }
      ]
    },
  ];

  const currentItems = mode === 'physical' ? physicalItems : digitalItems;
  
  const filteredItems = currentItems.filter(item => {
    if (filter === 'ALL') return true;
    if (filter === 'PREMIUM') return item.price > 100;
    if (filter === 'BASIC') return item.price <= 100;
    return true;
  });

  const handleItemOpen = (item: ShopItemData) => {
    setSelectedItem(item);
    setIsFlipped(false);
    onItemOpen();
  }

  const handleAddToCart = () => {
    if (selectedItem) {
      addToCart({
        id: selectedItem.id,
        name: selectedItem.name,
        price: selectedItem.price
      });
      onItemClose();
      onCartOpen();
    }
  }

  const subtotal = cart.reduce((acc, item) => acc + item.price, 0);
  const estimatedRewards = subtotal * 10; 

  return (
    <Box bg={bg} minH="100vh" pb="100px">
      <Container maxW="container.sm" p={0}>
        {/* Header */}
        <Box p={6} borderBottom={`1px solid ${border}`}>
          <Flex justify="space-between" align="center">
            <HStack spacing={4}>
              <Logo boxSize="35px" color={text} />
              <VStack align="start" spacing={0}>
                <Text fontSize="8px" fontWeight="900" color="#FFB000" fontFamily="monospace">PAPILLON</Text>
                <Heading fontSize="3xl" fontWeight="900" fontStyle="italic" color={text} lineHeight="1" fontFamily="'Archivo Black', sans-serif">
                  {mode === 'physical' ? 'PHYSICAL' : 'DIGITAL'}
                </Heading>
              </VStack>
            </HStack>
            <Box 
              border={`1px solid ${text}`} 
              p={2} 
              cursor="pointer" 
              onClick={onCartOpen}
              position="relative"
              _hover={{ bg: cardBg }}
            >
              <Icon as={PiShoppingBagFill} color={text} boxSize="20px" />
              {cart.length > 0 && (
                <Circle 
                  size="14px" 
                  bg="#FFB000" 
                  color="black" 
                  fontSize="8px" 
                  fontWeight="900" 
                  position="absolute" 
                  top="-5px" 
                  right="-5px"
                >
                  {cart.length}
                </Circle>
              )}
            </Box>
          </Flex>
        </Box>

        {/* Tab Switcher */}
        <Box p={6}>
          <Flex 
            border={`1px solid ${text}`} 
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
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">PROTOCOL: {mode === 'physical' ? 'PHYSICAL' : 'DIGITAL'}_MARKET</Text>
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">ENCRYPTION: WNGS_SYNC</Text>
          </Flex>
        </Box>

        {/* Grid Section */}
        <Box p={6}>
          <Box border="1px solid" borderColor={text} borderBottom="none" p={4} bg={bg}>
            <Flex justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Heading fontSize="xs" fontWeight="900" color={text} fontFamily="'Archivo Black', sans-serif">
                  ASSET_SLOTS // {filteredItems.length}
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
                  leftIcon={<MdFilterList />}
                  fontSize="8px"
                  fontWeight="900"
                  h="24px"
                  _hover={{ bg: cardBg }}
                  _active={{ bg: border }}
                >
                  FILTER: {filter}
                </MenuButton>
                <MenuList bg={bg} border={`1px solid ${text}`} borderRadius="0" minW="100px">
                  <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setFilter('ALL')}>ALL_ASSETS</MenuItem>
                  <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setFilter('PREMIUM')}>PREMIUM_PROTOCOL</MenuItem>
                  <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setFilter('BASIC')}>BASIC_PROTOCOL</MenuItem>
                </MenuList>
              </Menu>
            </Flex>
          </Box>

          <Box border="1px solid" borderColor={text} p={4}>
            <Flex justify="space-between" mb={4} borderBottom="1px solid" borderColor={border} pb={1}>
              <Text fontSize="6px" fontWeight="900" color={mutedText} fontFamily="monospace">ID_INDEX</Text>
              <Text fontSize="6px" fontWeight="900" color={mutedText} fontFamily="monospace">VALUATION</Text>
            </Flex>
            
            <SimpleGrid columns={3} spacing={3}>
              {/* Render Filtered Items */}
              {filteredItems.map((item, idx) => (
                <ShopSlot key={item.id} index={(idx + 1).toString().padStart(2, '0')} item={item} onOpen={handleItemOpen} text={text} border={border} bg={bg} cardBg={cardBg} />
              ))}
              
              {/* Fill remaining slots with empty dashed boxes (up to 9) */}
              {Array.from({ length: Math.max(0, 9 - filteredItems.length) }).map((_, idx) => (
                <ShopSlot key={`empty-${idx}`} index={(filteredItems.length + idx + 1).toString().padStart(2, '0')} onOpen={handleItemOpen} text={text} border={border} bg={bg} cardBg={cardBg} />
              ))}
            </SimpleGrid>

            <Flex justify="end" mt={4}>
              <Text fontSize="6px" fontWeight="900" color={mutedText} opacity={0.4} fontFamily="monospace">
                SYSTEM_STABILITY: 100% // LOAD_COMPLETE
              </Text>
            </Flex>
          </Box>
        </Box>
      </Container>

      {/* Item Detail Modal */}
      <Modal isOpen={isItemOpen} onClose={onItemClose} isCentered size="sm">
        <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.900" />
        <ModalContent bg="transparent" boxShadow="none" border="none" maxW="340px">
          <ModalBody p={0}>
            {selectedItem && (
              <Box perspective="1000px" w="full" h="500px">
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
                    borderColor={selectedItem.borderColor || text}
                    style={{ backfaceVisibility: "hidden" }}
                    flexDirection="column"
                    p={8}
                    onClick={() => setIsFlipped(true)}
                    cursor="pointer"
                  >
                    <VStack spacing={8}>
                      <Box border={`2px solid ${text}`} p={6}>
                        {selectedItem.type === 'physical' ? (
                          <TShirtIcon color={text} boxSize="100px" />
                        ) : (
                          <AvatarGrid colors={selectedItem.avatarColors || []} size="120px" />
                        )}
                      </Box>
                      <VStack spacing={2}>
                        <Text fontSize="2xl" fontWeight="900" color={bg} bg={text} px={4} fontStyle="italic">
                          {selectedItem.priceString}
                        </Text>
                        <Text fontSize="10px" fontWeight="900" color="#FFB000" fontFamily="monospace">
                          {selectedItem.name}
                        </Text>
                      </VStack>
                      <HStack color={mutedText}>
                        <Icon as={MdRefresh} />
                        <Text fontSize="9px" fontWeight="900">TAP TO VIEW SPECS</Text>
                      </HStack>
                    </VStack>
                  </Center>

                  {/* BACK */}
                  <Center
                    position="absolute"
                    inset={0}
                    bg={bg}
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    flexDirection="column"
                    p={8}
                    textAlign="center"
                    border={`4px solid ${text}`}
                    onClick={() => setIsFlipped(false)}
                    cursor="pointer"
                  >
                    <VStack spacing={6} w="full">
                      <VStack spacing={1}>
                        <Text fontSize="xs" fontWeight="900" color={text}>ASSET_SPECIFICATIONS</Text>
                        <Box h="2px" w="40px" bg="#FFB000" />
                      </VStack>
                      
                      <VStack align="start" spacing={4} w="full">
                        {selectedItem.type === 'physical' && (
                          <Box w="full">
                            <Text fontSize="7px" fontWeight="900" color={mutedText} mb={2} fontFamily="monospace">SELECT_SIZE</Text>
                            <HStack spacing={3}>
                              {['S', 'M', 'L', 'XL'].map((size) => (
                                <Center
                                  key={size}
                                  w="32px"
                                  h="32px"
                                  borderRadius="full"
                                  border="1px solid"
                                  borderColor={selectedSize === size ? text : border}
                                  bg={selectedSize === size ? text : "transparent"}
                                  color={selectedSize === size ? bg : text}
                                  fontSize="10px"
                                  fontWeight="900"
                                  cursor="pointer"
                                  onClick={(e) => { e.stopPropagation(); setSelectedSize(size); }}
                                  transition="all 0.2s"
                                  _hover={{ borderColor: text }}
                                >
                                  {size}
                                </Center>
                              ))}
                            </HStack>
                          </Box>
                        )}

                        {selectedItem.specs.map((spec, i) => (
                          <Box key={i}>
                            <Text fontSize="8px" fontWeight="900" color={mutedText}>{spec.label}</Text>
                            <Text fontSize="xs" fontWeight="700" color={text}>{spec.value}</Text>
                          </Box>
                        ))}
                      </VStack>

                      <Button 
                        w="full" 
                        h="60px" 
                        bg={text} 
                        color={bg} 
                        borderRadius="0" 
                        fontSize="sm" 
                        fontWeight="900" 
                        onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
                        _hover={{ bg: "#FFB000", color: "black" }}
                      >
                        ADD_TO_CART
                      </Button>
                      
                      <HStack color={mutedText}>
                        <Icon as={MdRefresh} />
                        <Text fontSize="9px" fontWeight="900">TAP TO RETURN</Text>
                      </HStack>
                    </VStack>
                  </Center>
                </MotionBox>
              </Box>
            )}
            <Center mt={6}>
              <IconButton 
                aria-label="Close" 
                icon={<MdClose />} 
                onClick={onItemClose} 
                bg={text} 
                color={bg} 
                borderRadius="full"
                _hover={{ bg: "#FFB000", color: "black" }}
              />
            </Center>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Cart Modal */}
      <Modal isOpen={isCartOpen} onClose={onCartClose} isCentered size="sm">
        <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.900" />
        <ModalContent bg={bg} border={`2px solid ${text}`} borderRadius="20px" overflow="hidden">
          <ModalBody p={0}>
            <VStack spacing={0} align="stretch">
              {/* Cart Header */}
              <Box p={6} borderBottom={`1px solid ${border}`}>
                <Flex justify="space-between" align="center">
                  <HStack spacing={3}>
                    <Icon as={PiShoppingBagFill} color="#FFB000" boxSize="20px" />
                    <Heading fontSize="xl" fontWeight="900" color={text} fontStyle="italic">
                      MY_CART
                    </Heading>
                    <Circle size="18px" bg="#FFB000" color="black" fontSize="10px" fontWeight="900">
                      {cart.length}
                    </Circle>
                  </HStack>
                  <IconButton 
                    aria-label="Close" 
                    icon={<MdClose />} 
                    variant="outline" 
                    color={text} 
                    borderColor={border} 
                    borderRadius="0"
                    size="sm"
                    onClick={onCartClose}
                  />
                </Flex>
              </Box>

              {/* Cart Items */}
              <Box minH="300px" p={6} overflowY="auto" maxH="40vh">
                {cart.length === 0 ? (
                  <Center h="250px" flexDirection="column">
                    <Icon as={PiShoppingBagFill} color={border} boxSize="60px" mb={4} />
                    <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="monospace">
                      CART_IS_EMPTY
                    </Text>
                  </Center>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {cart.map((item, idx) => (
                      <Flex key={idx} justify="space-between" align="center" borderBottom={`1px solid ${border}`} pb={2}>
                        <HStack spacing={4}>
                          <Box border={`1px solid ${text}`} p={2}>
                            <TShirtIcon color={text} boxSize="20px" />
                          </Box>
                          <VStack align="start" spacing={0}>
                            <Text fontSize="10px" fontWeight="900" color={text}>{item.name}</Text>
                            <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace">${item.price}</Text>
                          </VStack>
                        </HStack>
                        <IconButton 
                          aria-label="Remove" 
                          icon={<MdClose />} 
                          size="xs" 
                          variant="ghost" 
                          color={mutedText} 
                          onClick={() => removeFromCart(item.id)}
                        />
                      </Flex>
                    ))}
                  </VStack>
                )}
              </Box>

              {/* Cart Footer */}
              <Box p={6} bg={bg} borderTop={`1px solid ${border}`}>
                <VStack spacing={4} align="stretch">
                  <Flex justify="space-between" align="center">
                    <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace">ESTIMATED_REWARDS</Text>
                    <HStack spacing={1} color="#FFB000">
                      <Icon as={MdRefresh} boxSize="10px" />
                      <Text fontSize="10px" fontWeight="900">+{estimatedRewards} WNGS</Text>
                    </HStack>
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace">SUBTOTAL</Text>
                    <Text fontSize="2xl" fontWeight="900" color={text} fontStyle="italic">${subtotal}</Text>
                  </Flex>

                  <HStack spacing={4} pt={2}>
                    <Button 
                      flex={1} 
                      h="80px" 
                      bg={cardBg} 
                      border={`1px solid ${border}`}
                      color={text}
                      borderRadius="0"
                      flexDirection="column"
                      gap={2}
                      _hover={{ bg: border }}
                    >
                      <Icon as={PiCreditCardFill} boxSize="20px" />
                      <Text fontSize="8px" fontWeight="900" lineHeight="1.2">CREDIT /<br />DEBIT</Text>
                    </Button>
                    <Button 
                      flex={1} 
                      h="80px" 
                      bg={bg} 
                      border={`1px solid ${border}`}
                      color={text}
                      borderRadius="0"
                      flexDirection="column"
                      gap={2}
                      _hover={{ bg: cardBg }}
                    >
                      <Icon as={PiCubeFill} boxSize="20px" />
                      <Text fontSize="8px" fontWeight="900" lineHeight="1.2">CRYPTO</Text>
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default Shop
