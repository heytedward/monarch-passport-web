import React, { useState } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  Center, 
  Input, 
  Button, 
  Select, 
  FormControl, 
  FormLabel, 
  Textarea, 
  HStack,
  useToast,
  Switch,
  Divider
} from '@chakra-ui/react';
import { AdminGuard } from '../AdminGuard';
import Registry from './Registry';

const CommandCenter: React.FC = () => {
  const [prefix, setPrefix] = useState('s');
  const [startNum, setStartNum] = useState(2);
  const [count, setCount] = useState(10);
  const [tier, setTier] = useState('COMMON');
  const [product, setProduct] = useState('Alpha Hoodie');
  const [collection, setCollection] = useState('Genesis');
  const [season, setSeason] = useState('FW25');
  const [isSeasonArtifact, setIsSeasonArtifact] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  const toast = useToast();

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setGeneratedUrls([]);

    try {
      const response = await fetch('/api/v2/admin/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passphrase': passphrase
        },
        body: JSON.stringify({
          prefix,
          startNum,
          count,
          tier,
          product,
          collection,
          season,
          isSeasonArtifact
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'UPLINK_FAILURE');
      }

      setGeneratedUrls(data.urls || []);
      toast({
        title: 'BATCH_MINTED_SUCCESSFULLY',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      setError(err.message || 'SYSTEM_ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(generatedUrls.join('\n'));
    toast({
      title: 'COPIED_TO_CLIPBOARD',
      status: 'info',
      duration: 2000,
    });
  };

  return (
    <AdminGuard>
      <Box minH="100vh" bg="black" color="white" p={8} fontFamily="monospace">
        <VStack align="stretch" spacing={12} maxW="1000px" mx="auto">
          {/* Header Section */}
          <VStack align="start" spacing={0}>
            <Heading color="#FFB000" fontSize="3xl" fontWeight="900" letterSpacing="-0.02em" mb={2}>
              MONARCH_OS // ADMIN_DASHBOARD
            </Heading>
            <Box h="2px" bg="gray.800" w="full" />
          </VStack>

          {/* Minting Section */}
          <VStack align="stretch" spacing={6}>
            <VStack align="start" spacing={0}>
              <Heading color="#FFB000" fontSize="xl" fontWeight="900" mb={2}>
                ARTIFACT_GENERATION_TERMINAL
              </Heading>
              <Box h="1px" bg="whiteAlpha.300" w="full" />
            </VStack>

            <Box as="form" onSubmit={handleMint} border="1px solid #FFB000" p={6} bg="whiteAlpha.50">
              <VStack spacing={6}>
                <HStack spacing={4} w="full">
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">PREFIX</FormLabel>
                    <Input 
                      value={prefix} 
                      onChange={(e) => setPrefix(e.target.value)}
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      fontSize="sm"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">START_NUM</FormLabel>
                    <Input 
                      type="number"
                      value={startNum} 
                      onChange={(e) => setStartNum(parseInt(e.target.value))}
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      fontSize="sm"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">COUNT</FormLabel>
                    <Input 
                      type="number"
                      value={count} 
                      onChange={(e) => setCount(parseInt(e.target.value))}
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      fontSize="sm"
                    />
                  </FormControl>
                </HStack>

                <HStack spacing={4} w="full">
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">TIER</FormLabel>
                    <Select 
                      value={tier} 
                      onChange={(e) => setTier(e.target.value)}
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      bg="black"
                      fontSize="sm"
                    >
                      <option value="COMMON" style={{backgroundColor: 'black'}}>COMMON</option>
                      <option value="UNCOMMON" style={{backgroundColor: 'black'}}>UNCOMMON</option>
                      <option value="RARE" style={{backgroundColor: 'black'}}>RARE</option>
                      <option value="EPIC" style={{backgroundColor: 'black'}}>EPIC</option>
                      <option value="LEGENDARY" style={{backgroundColor: 'black'}}>LEGENDARY</option>
                      <option value="MONARCH" style={{backgroundColor: 'black'}}>MONARCH</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">PRODUCT_NAME</FormLabel>
                    <Input 
                      value={product} 
                      onChange={(e) => setProduct(e.target.value)}
                      placeholder="e.g. Alpha Hoodie"
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      fontSize="sm"
                    />
                  </FormControl>
                </HStack>

                <HStack spacing={4} w="full">
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">COLLECTION</FormLabel>
                    <Input 
                      value={collection} 
                      onChange={(e) => setCollection(e.target.value)}
                      placeholder="e.g. Genesis"
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      fontSize="sm"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">SEASON</FormLabel>
                    <Input 
                      value={season} 
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="e.g. FW25"
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      fontSize="sm"
                    />
                  </FormControl>
                </HStack>

                <HStack spacing={4} w="full" justify="space-between" align="center">
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="season-artifact" fontSize="xs" color="#FFB000" mb="0">
                      SEASON_ARTIFACT?
                    </FormLabel>
                    <Switch 
                      id="season-artifact" 
                      isChecked={isSeasonArtifact}
                      onChange={(e) => setIsSeasonArtifact(e.target.checked)}
                      colorScheme="orange"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel fontSize="xs" color="#FFB000">ADMIN_PASSPHRASE</FormLabel>
                    <Input 
                      type="password"
                      value={passphrase} 
                      onChange={(e) => setPassphrase(e.target.value)}
                      borderColor="whiteAlpha.300"
                      _focus={{ borderColor: '#FFB000' }}
                      borderRadius="0"
                      fontSize="sm"
                    />
                  </FormControl>
                </HStack>

                {error && (
                  <Text color="red.500" fontSize="sm" fontWeight="900">
                    ERROR: {error}
                  </Text>
                )}

                <Button 
                  type="submit"
                  w="full"
                  bg="#FFB000"
                  color="black"
                  borderRadius="0"
                  fontWeight="900"
                  isLoading={isLoading}
                  loadingText="UPLINKING..."
                  _hover={{ bg: 'white' }}
                >
                  MINT_BATCH
                </Button>
              </VStack>
            </Box>

            {generatedUrls.length > 0 && (
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between">
                  <Text color="#FFB000" fontSize="sm" fontWeight="900">GENERATED_MANIFEST</Text>
                  <Button 
                    size="xs" 
                    bg="whiteAlpha.200" 
                    color="white" 
                    onClick={copyAll}
                    _hover={{ bg: 'whiteAlpha.400' }}
                  >
                    COPY_ALL
                  </Button>
                </HStack>
                <Textarea 
                  value={generatedUrls.join('\n')}
                  readOnly
                  rows={10}
                  bg="whiteAlpha.50"
                  borderColor="whiteAlpha.300"
                  fontSize="xs"
                  borderRadius="0"
                />
              </VStack>
            )}

            <Text color="gray.500" fontSize="xs">
              SYSTEM_STATUS: {isLoading ? 'PROCESSING' : 'IDLE'} // READY_FOR_UPLINK
            </Text>
          </VStack>

          <Divider borderColor="whiteAlpha.200" />

          {/* Registry Section */}
          <Registry />
          
        </VStack>
      </Box>
    </AdminGuard>
  );
};

export default CommandCenter;
