import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, VStack, Heading, Text, Button, Center } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';

const MotionBox = motion(Box);

const Social = () => {
  const { userId } = useParams<{ userId: string }>();

  useEffect(() => {
    const logScan = async () => {
      if (userId) {
        // Log the social click as an artifact scan
        const { error } = await supabase
          .from('artifact_scans')
          .insert([
            { 
              owner_id: userId, 
              scan_type: 'SOCIAL_LINK' 
            }
          ]);
        
        if (error) {
          console.error('Error logging social scan:', error);
        }
      }
    };

    logScan();
  }, [userId]);

  return (
    <Box bg="black" minH="100vh" color="white" position="relative" overflow="hidden">
      <Center minH="100vh">
        <VStack spacing={12} zIndex={1}>
          <MotionBox
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Logo w={64} h={64} color="#FFB000" />
          </MotionBox>

          <VStack spacing={4} textAlign="center">
            <Heading 
              fontSize="2xl" 
              fontWeight="900" 
              fontFamily="monospace" 
              letterSpacing="0.2em"
              color="#FFB000"
            >
              // NETWORK CONNECTION ESTABLISHED
            </Heading>
            <Text 
              fontSize="xs" 
              color="gray.500" 
              fontFamily="monospace" 
              maxW="300px"
            >
              YOU HAVE SUCCESSFULLY BOOSTED THIS COLLECTOR'S DAILY QUOTA.
            </Text>
          </VStack>

          <Button
            as="a"
            href="https://papillonbrand.us"
            target="_blank"
            bg="transparent"
            border="2px solid #FFB000"
            color="#FFB000"
            borderRadius="0"
            px={8}
            py={6}
            fontWeight="900"
            fontFamily="monospace"
            fontSize="xs"
            _hover={{ bg: "#FFB000", color: "black", transform: "translateY(-2px)" }}
            _active={{ transform: "translateY(0)" }}
            transition="all 0.3s"
          >
            [ EXPLORE THE MONARCH PROTOCOL ]
          </Button>
        </VStack>
      </Center>

      {/* Background Decorative Elements - Subtle Grid */}
      <Box 
        position="absolute" 
        top={0} 
        left={0} 
        right={0} 
        bottom={0} 
        opacity={0.05}
        pointerEvents="none"
        bgImage="linear-gradient(#FFB000 1px, transparent 1px), linear-gradient(90deg, #FFB000 1px, transparent 1px)"
        bgSize="60px 60px"
      />
    </Box>
  );
};

export default Social;
