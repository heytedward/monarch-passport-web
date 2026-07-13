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
  Button,
  Textarea,
  useToast,
  Container
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { MdAccessTime, MdPerson, MdLocalFireDepartment, MdChatBubbleOutline, MdArrowBack, MdSend } from 'react-icons/md'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import NotificationsBell from '../components/NotificationsBell'

const BOOST_COST = 50;
const COMMENT_COST = 10;

// Derive a short readable handle from a Privy DID for comment attribution.
const handleFromId = (id: string) => '@' + (id || '').replace(/^did:privy:/, '').slice(0, 6).toUpperCase();

interface Comment { id: string; user_id: string; body: string; created_at: string; }

interface MonarchTimesPost {
  id: string;
  title: string;
  content: string;
  image_url: string;
  author: string;
  created_at: string;
  status: string;
  boost_count?: number;
  is_featured?: boolean;
}

// A MONARCH_TIMES post as a fixed-height flip card: front shows the post +
// HYPE (boost) and COMMENTS actions; tapping COMMENTS flips to the back, which
// lists comments and a paid composer. Mirrors the flip cards used elsewhere.
const PostCard = ({ post, accent }: { post: MonarchTimesPost; accent: string }) => {
  const { user, getAccessToken } = usePrivy();
  const { wngsBalance, setWngsBalance } = useStore();
  const toast = useToast();

  const isMock = post.id?.startsWith('mock');
  const [flipped, setFlipped] = useState(false);
  const [boostCount, setBoostCount] = useState(post.boost_count || 0);
  const [isFeatured, setIsFeatured] = useState(!!post.is_featured);
  const [boosting, setBoosting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const dateStr = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();

  const api = async (body: Record<string, any>) => {
    const token = await getAccessToken();
    const res = await fetch('/api/v2/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user?.id, ...body }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) throw new Error(data?.error || 'REQUEST_FAILED');
    return data;
  };

  const loadComments = async () => {
    if (commentsLoaded || isMock) return;
    setLoadingComments(true);
    try {
      const data = await api({ action: 'get_comments', postId: post.id });
      setComments(data.comments || []);
      setCommentsLoaded(true);
    } catch { /* leave empty */ } finally { setLoadingComments(false); }
  };

  const openComments = () => { setFlipped(true); loadComments(); };

  const handleBoost = async () => {
    if (isMock) return;
    setBoosting(true);
    try {
      const data = await api({ action: 'boost_post', postId: post.id });
      setBoostCount(data.boostCount);
      setIsFeatured(data.isFeatured);
      setWngsBalance(data.newBalance);
      toast({ title: data.isFeatured ? 'POST_FEATURED //' : 'HYPE_SENT //', status: 'success', duration: 1500 });
    } catch (e: any) {
      toast({ title: 'BOOST_FAILED', description: e.message, status: 'error', duration: 2500 });
    } finally { setBoosting(false); }
  };

  const handleComment = async () => {
    if (!commentText.trim() || isMock) return;
    setPosting(true);
    try {
      const data = await api({ action: 'add_comment', postId: post.id, body: commentText.trim() });
      setComments((c) => [...c, data.comment]);
      setWngsBalance(data.newBalance);
      setCommentText('');
    } catch (e: any) {
      toast({ title: 'COMMENT_FAILED', description: e.message, status: 'error', duration: 2500 });
    } finally { setPosting(false); }
  };

  return (
    <Box position="relative" h="540px" borderBottom="4px solid white" style={{ perspective: '1600px' }}>
      <Box position="absolute" inset={0} style={{
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* FRONT */}
        <Box position="absolute" inset={0} bg="black" overflow="hidden" display="flex" flexDirection="column" style={{ backfaceVisibility: 'hidden' }}>
          {post.image_url && (
            <Box position="relative" flexShrink={0} borderBottom="2px solid white">
              <Image src={post.image_url} alt={post.title} w="full" h="180px" objectFit="cover" filter="grayscale(20%)" />
              {isFeatured && (
                <Box position="absolute" top={2} left={2} bg={accent} px={2} py={0.5}>
                  <Text fontSize="8px" fontWeight="900" color="black" fontFamily="monospace">★ FEATURED</Text>
                </Box>
              )}
            </Box>
          )}
          <VStack align="stretch" spacing={3} p={6} flex={1} overflow="hidden">
            <HStack spacing={2} color={accent}>
              <Icon as={MdAccessTime} boxSize="10px" />
              <Text fontSize="9px" fontWeight="900" fontFamily="monospace">LOGGED: {dateStr}</Text>
              {isFeatured && !post.image_url && (
                <Text fontSize="9px" fontWeight="900" fontFamily="monospace" color={accent}>// ★ FEATURED</Text>
              )}
            </HStack>
            <Heading fontSize="xl" fontWeight="900" color="white" fontFamily="monospace" lineHeight="1.1" textTransform="uppercase" noOfLines={2}>
              {post.title}
            </Heading>
            <Text fontSize="sm" color="gray.400" fontFamily="monospace" lineHeight="1.6" noOfLines={post.image_url ? 3 : 8} flex={1}>
              {post.content}
            </Text>
            <HStack spacing={2}>
              <Icon as={MdPerson} color={accent} boxSize="12px" />
              <Text fontSize="9px" fontWeight="900" color="white" fontFamily="monospace">// {post.author?.toUpperCase() || 'SYSTEM'}</Text>
            </HStack>
          </VStack>
          <HStack spacing={0} borderTop="2px solid white" flexShrink={0}>
            <Button flex={1} h="48px" borderRadius="0" bg="black" color="white" fontFamily="monospace" fontSize="10px" fontWeight="900"
              leftIcon={<MdLocalFireDepartment />} isLoading={boosting} onClick={handleBoost} isDisabled={isMock || wngsBalance < BOOST_COST}
              borderRight="2px solid white" _hover={{ bg: accent, color: 'black' }}>
              HYPE{boostCount > 0 ? ` (${boostCount})` : ''} // {BOOST_COST}
            </Button>
            <Button flex={1} h="48px" borderRadius="0" bg="black" color="white" fontFamily="monospace" fontSize="10px" fontWeight="900"
              leftIcon={<MdChatBubbleOutline />} onClick={openComments} isDisabled={isMock} _hover={{ bg: 'whiteAlpha.200' }}>
              COMMENTS
            </Button>
          </HStack>
        </Box>

        {/* BACK */}
        <Box position="absolute" inset={0} bg="black" overflow="hidden" display="flex" flexDirection="column"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <HStack justify="space-between" p={4} borderBottom="2px solid white" flexShrink={0}>
            <HStack spacing={2}>
              <Icon as={MdChatBubbleOutline} color={accent} boxSize="14px" />
              <Text fontSize="11px" fontWeight="900" color="white" fontFamily="monospace">COMMENTS // {comments.length}</Text>
            </HStack>
            <Button size="xs" h="26px" borderRadius="0" bg="transparent" color="white" border="1px solid white"
              fontFamily="monospace" fontSize="9px" leftIcon={<MdArrowBack />} onClick={() => setFlipped(false)} _hover={{ bg: 'white', color: 'black' }}>
              BACK
            </Button>
          </HStack>
          <VStack align="stretch" spacing={3} p={4} flex={1} overflowY="auto">
            {loadingComments ? (
              <Center py={8}><Spinner color={accent} size="sm" /></Center>
            ) : comments.length === 0 ? (
              <Center py={8}><Text fontSize="9px" fontWeight="900" color="gray.600" fontFamily="monospace">[ NO_COMMENTS_YET // BE_FIRST ]</Text></Center>
            ) : comments.map((c) => (
              <Box key={c.id} borderLeft={`2px solid ${accent}`} pl={3} py={1}>
                <Text fontSize="8px" fontWeight="900" color={accent} fontFamily="monospace">{handleFromId(c.user_id)}</Text>
                <Text fontSize="xs" color="gray.300" fontFamily="monospace" lineHeight="1.4">{c.body}</Text>
              </Box>
            ))}
          </VStack>
          <VStack align="stretch" spacing={2} p={4} borderTop="2px solid white" flexShrink={0}>
            <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="ADD_TRANSMISSION..."
              bg="black" border="1px solid" borderColor="whiteAlpha.400" borderRadius="0" color="white" fontFamily="monospace" fontSize="xs"
              rows={2} resize="none" maxLength={500} _placeholder={{ color: 'gray.600' }} _focus={{ borderColor: accent, boxShadow: 'none' }} />
            <Button h="40px" borderRadius="0" bg={accent} color="black" fontFamily="monospace" fontSize="10px" fontWeight="900"
              rightIcon={<MdSend />} isLoading={posting} isDisabled={!commentText.trim() || wngsBalance < COMMENT_COST} onClick={handleComment} _hover={{ bg: 'white' }}>
              {wngsBalance < COMMENT_COST ? 'INSUFFICIENT_WNGS' : `TRANSMIT // ${COMMENT_COST} WNGS`}
            </Button>
          </VStack>
        </Box>
      </Box>
    </Box>
  );
};

const Home = () => {
  const { wngsBalance, activeTheme, activeThemeAccent } = useStore();
  const [posts, setPosts] = useState<MonarchTimesPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bg = "black";
  const text = "white";
  const mutedText = "gray.500";
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
            <NotificationsBell />
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
              <PostCard key={post.id} post={post} accent={brandAccent} />
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
