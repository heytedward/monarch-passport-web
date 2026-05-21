import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Heading, Text, VStack, Button, Center, Icon } from '@chakra-ui/react';
import { MdPersonAdd, MdChevronRight } from 'react-icons/md';

export default function Recruit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refId = searchParams.get('ref');
  const tagId = searchParams.get('tag');

  return (
    <Box bg="black" minH="100vh" color="white" p={8} pt="100px">
      <VStack spacing={8} align="stretch">
        <Box borderBottom="8px solid #FFB000" pb={6}>
          <Heading className="de-stijl-heading" fontSize="5xl" letterSpacing="-0.05em" fontStyle="italic">
            RECRUITMENT<br />PROTOCOL
          </Heading>
          <Text className="de-stijl-body" fontWeight="black" fontSize="xs" mt={2} color="#FFB000">
            INVITATION_FROM: {refId?.slice(0, 12).toUpperCase() || 'UNKNOWN_AGENT'}
          </Text>
        </Box>

        <Box bg="whiteAlpha.100" border="4px solid white" p={8}>
          <VStack align="start" spacing={4}>
            <Heading fontSize="xl" className="de-stijl-heading">NEW_AGENT_DETECTED</Heading>
            <Text className="de-stijl-body" fontSize="sm" opacity={0.8} lineHeight="1.6">
              You have scanned a Monarch artifact tagged: <Text as="span" color="#FFB000" fontWeight="bold">[{tagId || 'UNIDENTIFIED'}]</Text>. 
              This item is currently linked to another agent.
            </Text>
            <Text className="de-stijl-body" fontSize="xs" opacity={0.6}>
              By joining the Monarch ecosystem, you can start earning $WNGS and claiming your own artifacts.
            </Text>
          </VStack>
        </Box>

        <Button
          bg="#FFB000"
          color="black"
          _hover={{ bg: "white" }}
          borderRadius="0"
          height="70px"
          className="de-stijl-heading"
          fontSize="2xl"
          rightIcon={<Icon as={MdChevronRight} />}
          leftIcon={<Icon as={MdPersonAdd} />}
          onClick={() => navigate('/')}
        >
          INITIALIZE_PASSPORT
        </Button>

        <Text fontSize="9px" fontFamily="monospace" color="whiteAlpha.400" textAlign="center">
          SYSTEM_RECRUITMENT_V1.0 // MULTI_LEVEL_UPLINK
        </Text>
      </VStack>
    </Box>
  );
}
