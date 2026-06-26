import React from 'react';
import { Box, Heading, Text, Button, VStack } from '@chakra-ui/react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Catches render-time crashes in the routed pages so a single bad field or
// thrown error renders an intentional De Stijl fault screen instead of a blank
// white page (the same symptom the color-mode bug produced). Error boundaries
// must be class components -- there is no hook equivalent.
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the crash in the console / server logs for debugging.
    console.error('RENDER_FAULT:', error, info.componentStack);
  }

  handleReload = () => {
    // Full reload clears the boundary's error state and re-fetches the app.
    window.location.assign('/home');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Box bg="black" minH="100vh" color="white" display="flex" alignItems="center" justifyContent="center" px={6}>
        <VStack spacing={6} textAlign="center" maxW="400px" border="2px solid #DC143C" p={8}>
          <Heading
            fontFamily="'Archivo Black', sans-serif"
            fontSize="2xl"
            letterSpacing="-0.02em"
            color="#DC143C"
          >
            SYSTEM_FAULT //
          </Heading>
          <Text fontFamily="monospace" fontSize="sm" color="gray.400">
            A RENDER ERROR INTERRUPTED THIS SCREEN. THE FAULT HAS BEEN LOGGED.
          </Text>
          {this.state.error?.message && (
            <Text fontFamily="monospace" fontSize="xs" color="gray.600" wordBreak="break-word">
              [ {this.state.error.message} ]
            </Text>
          )}
          <Button
            bg="#FFB000"
            color="black"
            w="full"
            h="50px"
            borderRadius="0"
            fontWeight="900"
            fontFamily="monospace"
            fontSize="sm"
            _hover={{ bg: '#e69e00' }}
            _active={{ bg: '#cc8c00' }}
            onClick={this.handleReload}
          >
            RELOAD_SYSTEM
          </Button>
        </VStack>
      </Box>
    );
  }
}

export default ErrorBoundary;
