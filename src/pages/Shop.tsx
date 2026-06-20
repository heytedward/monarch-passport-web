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
  useColorModeValue,
  useToast
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PiShoppingBagFill, PiCreditCardFill, PiCubeFill } from 'react-icons/pi'
import { Logo } from '../components/Logo'
import { MdFilterList, MdRefresh, MdClose } from 'react-icons/md'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { usePrivy } from '@privy-io/react-auth'

import { WngsCoin } from '../components/WngsCoin'

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
  wngsAmount?: number;
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
        _hover={{ borderColor: "var(--monarch-accent)" }}
        transition="all 0.2s"
      >
        <Text position="absolute" top={1} left={1} fontSize="6px" color={text} opacity={0.4} fontFamily="monospace">{index}</Text>
        <Center h="full" flexDirection="column">
          {item.type === 'physical' ? (
            <TShirtIcon color={text} />
          ) : (item as any).category === 'WNGS' ? (
            <Box w="60px" h="60px">
              <WngsCoin isStatic={true} />
            </Box>
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
  const { user } = usePrivy();
  const toast = useToast();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialFilter = searchParams.get('filter');

  const [mode, setMode] = useState<'physical' | 'digital'>(initialFilter === 'WNGS' ? 'digital' : 'physical');
  const [filter, setFilter] = useState<'ALL' | 'PREMIUM' | 'BASIC'>('ALL');
  const [digitalFilter, setDigitalFilter] = useState<'ALL' | 'AVATARS' | 'THEMES' | 'WNGS'>(initialFilter === 'WNGS' ? 'WNGS' : 'ALL');
  const [products, setProducts] = useState<ShopItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
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

  const handleAcquireWngs = async (item: ShopItemData) => {
    if (!user) {
      toast({
        title: "AUTHENTICATION REQUIRED",
        description: "PLEASE LOG IN TO ACQUIRE WNGS.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/checkout/wngs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundleName: item.name,
          priceInCents: item.price * 100,
          wngsAmount: item.wngsAmount,
          userId: user.id,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      toast({
        title: "CHECKOUT ERROR",
        description: error.message || "COULD NOT INITIALIZE STRIPE CHECKOUT.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*');
      
      if (!error && data) {
        const mappedProducts: ShopItemData[] = data.map((p: any) => ({
          id: p.id,
          type: p.type,
          price: p.price,
          priceString: p.type === 'physical' ? `$${p.price}` : `${p.price} WNGS`,
          name: p.name,
          specs: p.specs || [],
          avatarColors: p.avatar_colors,
          borderColor: p.border_color,
          category: p.category
        }));

        const mockWngs: ShopItemData[] = [
          { id: 'W01', type: 'digital', category: 'WNGS', price: 10, priceString: '1000 WNGS', name: 'CACHE // 1000 WNGS', specs: [], wngsAmount: 1000 },
          { id: 'W02', type: 'digital', category: 'WNGS', price: 45, priceString: '5000 WNGS', name: 'LOOT // 5000 WNGS', specs: [], wngsAmount: 5000 },
          { id: 'W03', type: 'digital', category: 'WNGS', price: 80, priceString: '10000 WNGS', name: 'VAULT // 10000 WNGS', specs: [], wngsAmount: 10000 },
          { id: 'W04', type: 'digital', category: 'WNGS', price: 350, priceString: '50000 WNGS', name: 'MAINFRAME // 50000 WNGS', specs: [], wngsAmount: 50000 },
        ];

        setProducts([...mappedProducts, ...mockWngs]);
      } else {
        const mockWngs: ShopItemData[] = [
          { id: 'W01', type: 'digital', category: 'WNGS', price: 10, priceString: '1000 WNGS', name: 'CACHE // 1000 WNGS', specs: [], wngsAmount: 1000 },
          { id: 'W02', type: 'digital', category: 'WNGS', price: 45, priceString: '5000 WNGS', name: 'LOOT // 5000 WNGS', specs: [], wngsAmount: 5000 },
          { id: 'W03', type: 'digital', category: 'WNGS', price: 80, priceString: '10000 WNGS', name: 'VAULT // 10000 WNGS', specs: [], wngsAmount: 10000 },
          { id: 'W04', type: 'digital', category: 'WNGS', price: 350, priceString: '50000 WNGS', name: 'MAINFRAME // 50000 WNGS', specs: [], wngsAmount: 50000 },
        ];
        setProducts(mockWngs);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const currentItems = products.filter(item => item.type === mode);
  
  const filteredItems = currentItems.filter(item => {
    // Apply Price Filter
    if (filter === 'PREMIUM' && item.price <= 100) return false;
    if (filter === 'BASIC' && item.price > 100) return false;

    // Apply Digital Category Filter
    if (mode === 'digital' && digitalFilter !== 'ALL') {
      if ((item as any).category !== digitalFilter) return false;
    }

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
                <Text fontSize="8px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace">PAPILLON</Text>
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
                  bg="var(--monarch-accent)" 
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

          {/* Digital Sub-navigation Filter */}
          {mode === 'digital' && (
            <Center mt={4}>
              <HStack 
                spacing={0} 
                bg={cardBg} 
                border={`1px solid ${border}`} 
                p={1}
                w="full"
                justify="space-evenly"
              >
                {['ALL', 'AVATARS', 'THEMES', 'WNGS'].map((cat) => (
                  <Button
                    key={cat}
                    variant="ghost"
                    size="xs"
                    fontSize="9px"
                    fontFamily="monospace"
                    fontWeight="900"
                    color={digitalFilter === cat ? "var(--monarch-accent)" : mutedText}
                    onClick={() => setDigitalFilter(cat as any)}
                    _hover={{ color: text }}
                    borderRadius="0"
                  >
                    {cat}
                  </Button>
                ))}
              </HStack>
            </Center>
          )}
        </Box>

        {/* Info Bar */}
        <Box borderY="1px solid" borderColor={border} px={6} py={2}>
          <Flex justify="space-between" align="center">
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">PROTOCOL: {mode === 'physical' ? 'PHYSICAL' : 'DIGITAL'}_MARKET</Text>
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">ENCRYPTION: WNGS_SYNC</Text>
          </Flex>
        </Box>

        {/* Specialized WNGS Grid or Standard Grid */}
        {mode === 'digital' && digitalFilter === 'WNGS' ? (
          <Box p={6}>
            <SimpleGrid columns={2} spacing={6}>
              {filteredItems.map((item) => (
                <Box 
                  key={item.id} 
                  bg="black" 
                  border="2px solid" 
                  borderColor="var(--monarch-accent)"
                  position="relative"
                  cursor="pointer"
                  onClick={() => handleItemOpen(item)}
                  _hover={{ transform: 'translateY(-4px)', boxShadow: '0 0 25px var(--monarch-accent)' }}
                  transition="all 0.3s"
                  aspectRatio="1/1"
                >
                  <Center h="full" flexDirection="column" p={6} textAlign="center">
                    <VStack spacing={6} w="full" h="full" justify="center">
                       <Box w="60%" h="60%" position="relative">
                          <WngsCoin isStatic={true} />
                       </Box>
                       <VStack spacing={2}>
                          <Text 
                            fontSize={{ base: "xs", md: "sm" }} 
                            fontWeight="900" 
                            color="white" 
                            fontFamily="monospace" 
                            lineHeight="1.1"
                            textTransform="uppercase"
                          >
                            {item.name.includes(' // ') ? item.name.split(' // ')[0] : item.name}: {item.name.includes(' // ') ? item.name.split(' // ')[1] : item.priceString.split(' ')[0]} / ${item.price}
                          </Text>
                          <Button
                            size="xs"
                            bg="var(--monarch-accent)"
                            color="black"
                            borderRadius="0"
                            fontSize="8px"
                            fontWeight="900"
                            fontFamily="monospace"
                            px={4}
                            isLoading={isProcessing && selectedItem?.id === item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcquireWngs(item);
                            }}
                            _hover={{ bg: "white" }}
                          >
                            [ ACQUIRE ]
                          </Button>
                       </VStack>
                    </VStack>
                  </Center>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        ) : (
          <Box p={6}>
            <Box border="1px solid" borderColor={text} borderBottom="none" p={4} bg={bg}>
              <Flex justify="space-between" align="center">
                <VStack align="start" spacing={1}>
                  <Heading fontSize="xs" fontWeight="900" color={text} fontFamily="'Archivo Black', sans-serif">
                    ASSET_SLOTS // {loading ? "..." : filteredItems.length}
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
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <ShopSlot key={`loading-${idx}`} index={(idx + 1).toString().padStart(2, '0')} onOpen={() => {}} text={text} border={border} bg={bg} cardBg={cardBg} />
                  ))
                ) : (
                  <>
                    {filteredItems.map((item, idx) => (
                      <ShopSlot key={item.id} index={(idx + 1).toString().padStart(2, '0')} item={item} onOpen={handleItemOpen} text={text} border={border} bg={bg} cardBg={cardBg} />
                    ))}
                    
                    {Array.from({ length: Math.max(0, 9 - filteredItems.length) }).map((_, idx) => (
                      <ShopSlot key={`empty-${idx}`} index={(filteredItems.length + idx + 1).toString().padStart(2, '0')} onOpen={handleItemOpen} text={text} border={border} bg={bg} cardBg={cardBg} />
                    ))}
                  </>
                )}
              </SimpleGrid>

              <Flex justify="end" mt={4}>
                <Text fontSize="6px" fontWeight="900" color={mutedText} opacity={0.4} fontFamily="monospace">
                  SYSTEM_STABILITY: 100% // {loading ? "LOADING..." : "LOAD_COMPLETE"}
                </Text>
              </Flex>
            </Box>
          </Box>
        )}
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
                        ) : (selectedItem as any).category === 'WNGS' ? (
                          <Box w="120px" h="120px">
                             <WngsCoin />
                          </Box>
                        ) : (
                          <AvatarGrid colors={selectedItem.avatarColors || []} size="120px" />
                        )}
                      </Box>
                      <VStack spacing={2}>
                        <Text fontSize="2xl" fontWeight="900" color={bg} bg={text} px={4} fontStyle="italic">
                          {selectedItem.priceString}
                        </Text>
                        <Text fontSize="10px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace">
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
                        <Box h="2px" w="40px" bg="var(--monarch-accent)" />
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
                        isLoading={isProcessing && selectedItem.category === 'WNGS'}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (selectedItem.type === 'physical' && (selectedItem as any).external_buy_url) {
                            window.open((selectedItem as any).external_buy_url, '_blank');
                          } else if ((selectedItem as any).category === 'WNGS') {
                            handleAcquireWngs(selectedItem);
                          } else {
                            handleAddToCart();
                          }
                        }}
                        _hover={{ bg: "var(--monarch-accent)", color: "black" }}
                      >
                        {selectedItem.type === 'physical' && (selectedItem as any).external_buy_url 
                          ? 'BUY_NOW' 
                          : (selectedItem as any).category === 'WNGS' 
                            ? 'ACQUIRE_WNGS' 
                            : 'ADD_TO_CART'}
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
                _hover={{ bg: "var(--monarch-accent)", color: "black" }}
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
                    <Icon as={PiShoppingBagFill} color="var(--monarch-accent)" boxSize="20px" />
                    <Heading fontSize="xl" fontWeight="900" color={text} fontStyle="italic">
                      MY_CART
                    </Heading>
                    <Circle size="18px" bg="var(--monarch-accent)" color="black" fontSize="10px" fontWeight="900">
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
                    <HStack spacing={1} color="var(--monarch-accent)">
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
