import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  Flex, 
  Icon, 
  Center, 
  Image,
  Spinner,
  useColorModeValue,
  Container
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { MdOutlineElectricBolt, MdAccessTime, MdPerson } from 'react-icons/md'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

interface MonarchTimesPost {
  id: string;
  title: string;
  content: string;
  image_url: string;
  author: string;
  created_at: string;
  status: string;
}

const PostCard = ({ post, text, mutedText, border, accent }: { 
  post: MonarchTimesPost, 
  text: string, 
  mutedText: string, 
  border: string,
  accent: string
}) => {
  const dateStr = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();

  return (
    <Box borderBottom={`4px solid ${text}`} bg="black">
      {/* Image Section */}
      {post.image_url && (
        <Box borderBottom={`2px solid ${text}`} position="relative">
          <Image 
            src={post.image_url} 
            alt={post.title} 
            w="full" 
            h="auto" 
            objectFit="cover"
            maxH="400px"
            filter="grayscale(20%)"
          />
          <Box 
            position="absolute" 
            top={2} 
            left={2} 
            bg={accent} 
            px={2} 
            py={0.5}
          >
            <Text fontSize="7px" fontWeight="900" color="black" fontFamily="monospace">
              SYSTEM_LIVE
            </Text>
          </Box>
        </Box>
      )}

      {/* Content Section */}
      <VStack align="stretch" spacing={4} p={6}>
        <VStack align="start" spacing={1}>
          <HStack spacing={2} color={accent}>
            <Icon as={MdAccessTime} boxSize="10px" />
            <Text fontSize="9px" fontWeight="900" fontFamily="monospace">
              LOGGED: {dateStr}
            </Text>
          </HStack>
          <Heading 
            fontSize="2xl" 
            fontWeight="900" 
            color="white" 
            fontFamily="monospace"
            lineHeight="1.1"
            textTransform="uppercase"
          >
            {post.title}
          </Heading>
        </VStack>

        <Text 
          fontSize="sm" 
          color="gray.400" 
          fontFamily="monospace" 
          lineHeight="1.6"
        >
          {post.content}
        </Text>

        <HStack pt={4} spacing={3}>
          <Box bg="whiteAlpha.100" p={2} border={`1px solid ${whiteAlpha300}`}>
             <HStack spacing={2}>
                <Icon as={MdPerson} color={accent} boxSize="12px" />
                <Text fontSize="9px" fontWeight="900" color="white" fontFamily="monospace">
                  // TRANSMITTED_BY: {post.author?.toUpperCase() || 'SYSTEM'}
                </Text>
             </HStack>
          </Box>
        </HStack>
      </VStack>
    </Box>
  );
};

// Internal constant for alpha transparency
const whiteAlpha300 = "rgba(255, 255, 255, 0.16)";

const Home = () => {
  const { wngsBalance, activeTheme, activeThemeAccent } = useStore();
  const [posts, setPosts] = useState<MonarchTimesPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bg = "black";
  const text = "white";
  const mutedText = "gray.500";
  const border = "whiteAlpha.300";
  const brandAccent = activeThemeAccent || (activeTheme === 'CRIMSON_OVERRIDE' ? '#DC143C' : '#FFB000');

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('monarch_times')
          .select('*')
          .eq('status', 'PUBLISHED')
          .order('created_at', { ascending: false });

        const mockPost: MonarchTimesPost = {
          id: 'mock-01',
          title: 'NEO_COLLECTION // HANDSHAKE_SEQUENCE_LOGGED',
          content: 'The first batch of NTAG 424 DNA chips has been successfully integrated into the Neo Hoodie v1. Agents report 100% signal stability during initial phygital stress tests. Protocol Season 01 is now entering the final verification phase.',
          image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop',
          author: 'SYSTEM_ARCHITECT',
          created_at: new Date().toISOString(),
          status: 'PUBLISHED'
        };

        if (!error && data && data.length > 0) {
          setPosts(data);
        } else {
          setPosts([mockPost]);
        }
      } catch (err) {
        console.error('Error fetching Monarch Times:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  return (
    <Box bg={bg} minH="100vh" pb="90px">
      <Container maxW="container.sm" p={0}>
        {/* Header */}
        <Box borderBottom={`4px solid ${text}`} p={6} pt={12}>
          <Flex justify="space-between" align="center">
            <VStack align="start" spacing={0}>
              <Heading fontSize="4xl" fontWeight="900" fontStyle="italic" color={text} letterSpacing="-0.04em" fontFamily="'Archivo Black', sans-serif">
                MONARCH_TIMES
              </Heading>
              <Text fontSize="9px" fontWeight="900" color={brandAccent} fontFamily="monospace" letterSpacing="0.1em">
                BALANCE: {wngsBalance} WNGS // SESSION_ACTIVE
              </Text>
            </VStack>
          </Flex>
        </Box>

        {/* Status Bar */}
        <Box borderBottom={`2px solid ${text}`} py={3} px={6} bg="whiteAlpha.50">
          <HStack justify="space-between">
            <Text fontSize="10px" fontWeight="900" color={text} fontFamily="monospace" letterSpacing="0.1em">
              AUTONOMOUS_FEED // V2.0_STABLE
            </Text>
            <Box h="8px" w="8px" bg={brandAccent} borderRadius="full" />
          </HStack>
        </Box>

        {/* Feed Content */}
        {isLoading ? (
          <Center py={20}>
            <VStack spacing={4}>
              <Spinner color={brandAccent} size="xl" thickness="4px" />
              <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="monospace">
                CONNECTING_TO_NEURAL_LINK...
              </Text>
            </VStack>
          </Center>
        ) : posts.length > 0 ? (
          <VStack spacing={0} align="stretch">
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                text={text} 
                mutedText={mutedText} 
                border={border}
                accent={brandAccent}
              />
            ))}
          </VStack>
        ) : (
          <Center py={40} px={10} textAlign="center">
            <VStack spacing={6}>
              <Box p={8} border={`2px dashed ${mutedText}`}>
                <Text fontSize="xs" fontWeight="900" color={mutedText} fontFamily="monospace" letterSpacing="0.2em">
                  [ WAITING_FOR_SYSTEM_TRANSMISSION ]
                </Text>
              </Box>
              <Text fontSize="9px" color={mutedText} fontFamily="monospace" maxW="250px">
                THE ARCHIVE IS CURRENTLY SILENT. AGENTS ARE CALCULATING NEXT PROTOCOLS.
              </Text>
            </VStack>
          </Center>
        )}
      </Container>
    </Box>
  )
}

export default Home
