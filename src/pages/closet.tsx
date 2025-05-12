import React, { useState } from 'react';
import { Box, Heading, SimpleGrid, Text, useDisclosure, Modal, ModalOverlay, ModalContent, ModalBody, IconButton } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowLeft, FaSync } from 'react-icons/fa';

interface ClosetItem {
  name: string;
  image: string;
  borderColor: string;
  details: string;
  label: string;
  labelColor: string;
}

const items: ClosetItem[] = [
  {
    name: 'Monarch Jacket',
    image: '/monarch-jacket.png',
    borderColor: '#622CC6',
    details: "London Pop-Up '25\nSerial #0387\nApril 27, 2025\n@butterflyboy",
    label: 'BLACK',
    labelColor: '#622CC6',
  },
  {
    name: 'Store Opening Tee',
    image: '/store-tee.png',
    borderColor: '#F4.4019',
    details: "Store Opening '24\nSerial #0123\nMarch 10, 2024\n@papillonfan",
    label: 'GOLD',
    labelColor: '#F4.4019',
  },
  // Add more items as needed
];

const MotionBox = motion(Box);

const Closet: React.FC = () => {
  const [selected, setSelected] = useState<ClosetItem | null>(null);
  const [flipped, setFlipped] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleCardClick = (item: ClosetItem) => {
    setSelected(item);
    setFlipped(false);
    onOpen();
  };

  const handleFlip = () => setFlipped((f) => !f);

  return (
    <Box bg="#121212" minH="100vh" color="#FFFBEF" p={0}>
      <Box textAlign="center" pt={6}>
        <Heading fontFamily="Outfit, sans-serif" fontWeight={700} fontSize="2xl" letterSpacing="0.1em" mb={1} color="#FFFBEF">PAPILLON</Heading>
        <Text fontSize="2xl" fontWeight={600} mb={4} color="#FFFBEF">Closet</Text>
      </Box>
      <SimpleGrid columns={2} spacing={4} px={4}>
        {items.map((item, idx) => (
          <Box
            key={idx}
            border={`2.5px solid ${item.borderColor}`}
            borderRadius="20px"
            bg="#181818"
            p={4}
            textAlign="center"
            onClick={() => handleCardClick(item)}
            cursor="pointer"
            boxShadow="md"
          >
            <img src={item.image} alt={item.name} style={{ height: 80, margin: '0 auto 12px' }} />
            <Text fontSize="lg" fontWeight={600} mb={2}>{item.name}</Text>
            <Box border={`2px solid ${item.labelColor}`} color={item.labelColor} borderRadius="10px" px={2} py={0.5} display="inline-block" fontWeight={700} fontSize="md">{item.label}</Box>
          </Box>
        ))}
      </SimpleGrid>

      <Modal isOpen={isOpen} onClose={onClose} size="xs" isCentered motionPreset="none">
        <ModalOverlay bg="rgba(18,18,18,0.85)" />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalBody p={0} display="flex" justifyContent="center" alignItems="center">
            <AnimatePresence initial={false}>
              {selected && (
                <MotionBox
                  key={flipped ? 'back' : 'front'}
                  initial={{ rotateY: flipped ? 180 : 0 }}
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    width: 260,
                    height: 340,
                    perspective: 1000,
                    borderRadius: 24,
                    background: '#181818',
                    border: `2.5px solid ${selected.borderColor}`,
                    position: 'relative',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    color: '#FFFBEF',
                    fontFamily: 'Outfit, sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transformStyle: 'preserve-3d',
                  }}
                  onClick={handleFlip}
                  onTouchStart={handleFlip}
                >
                  {!flipped ? (
                    <Box w="100%" h="100%" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                      <Text fontSize="xl" fontWeight={700} mb={2}>{selected.name}</Text>
                      <img src={selected.image} alt={selected.name} style={{ height: 120, marginBottom: 16 }} />
                      <Box border={`2px solid ${selected.labelColor}`} color={selected.labelColor} borderRadius="10px" px={3} py={1} fontWeight={700} fontSize="lg" mb={4}>{selected.label}</Box>
                      <Text fontSize="md" color="#FFFBEF" opacity={0.7} mt={4}>Tap or swipe to flip</Text>
                    </Box>
                  ) : (
                    <Box w="100%" h="100%" display="flex" flexDirection="column" alignItems="center" justifyContent="center" px={4}>
                      <Text fontSize="lg" fontWeight={700} mb={2}>{selected.name}</Text>
                      <Text whiteSpace="pre-line" fontSize="md" color="#FFFBEF" mb={4}>{selected.details}</Text>
                      <Text fontSize="md" color="#FFFBEF" opacity={0.7}>Tap or swipe to flip</Text>
                    </Box>
                  )}
                  <IconButton aria-label="Close" icon={<FaArrowLeft />} position="absolute" top={2} left={2} size="sm" onClick={onClose} bg="transparent" color="#FFFBEF" _hover={{ bg: 'rgba(255,255,255,0.1)' }} />
                  <IconButton aria-label="Flip" icon={<FaSync />} position="absolute" top={2} right={2} size="sm" onClick={handleFlip} bg="transparent" color="#FFFBEF" _hover={{ bg: 'rgba(255,255,255,0.1)' }} />
                </MotionBox>
              )}
            </AnimatePresence>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Closet;