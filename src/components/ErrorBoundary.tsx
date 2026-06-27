import React from 'react';
import { Box, Heading, Text, Button, VStack } from '@chakra-ui/react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

// Catches render-time crashes in the routed pages so a single bad field or
// thrown error renders an intentional De Stijl fault screen instead of a blank
// white page (the same symptom the color-mode bug produced). Error boundaries
// must be class components -- there is no hook equivalent.
//
// The fault screen surfaces the error message + the top of the component stack
// on-screen (not just the console) so a crash can be diagnosed from a single
// screenshot without opening dev tools.
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RENDER_FAULT:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack || null });
  }

  handleReload = () => {
    // Full reload clears the boundary's error state and re-fetches the app.
    window.location.assign('/home');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // First few frames of the component stack name the component that threw.
    const topFrames = (this.state.componentStack || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join('\n');

    return (
      <Box bg="black" minH="100vh" color="white" display="flex" alignItems="center" justifyContent="center" px={6} py={10}>
        <VStack spacing={5} textAlign="center" maxW="440px" border="2px solid #DC143C" p={8}>
          <Heading fontFamily="'Archivo Black', sans-serif" fontSize="2xl" letterSpacing="-0.02em" color="#DC143C">
            SYSTEM_FAULT //
          </Heading>
          <Text fontFamily="monospace" fontSize="xs" color="gray.400">
            A RENDER ERROR INTERRUPTED THIS SCREEN. THE FAULT HAS BEEN LOGGED.
          </Text>

          {this.state.error?.message && (
            <Box w="full" border="1px solid #FFB000" p={3} textAlign="left">
              <Text fontFamily="monospace" fontSize="9px" fontWeight="900" color="#FFB000" mb={1}>ERROR //</Text>
              <Text fontFamily="monospace" fontSize="xs" color="white" wordBreak="break-word" sx={{ userSelect: 'text' }}>
                {this.state.error.message}
              </Text>
            </Box>
          )}

          {topFrames && (
            <Box w="full" border="1px solid" borderColor="whiteAlpha.300" p={3} textAlign="left">
              <Text fontFamily="monospace" fontSize="9px" fontWeight="900" color="gray.500" mb={1}>COMPONENT_STACK //</Text>
              <Text as="pre" fontFamily="monospace" fontSize="10px" color="gray.300" whiteSpace="pre-wrap" wordBreak="break-word" sx={{ userSelect: 'text' }}>
                {topFrames}
              </Text>
            </Box>
          )}

          <Button
            bg="#FFB000" color="black" w="full" h="48px" borderRadius="0" fontWeight="900" fontFamily="monospace" fontSize="sm"
            _hover={{ bg: '#e69e00' }} _active={{ bg: '#cc8c00' }} onClick={this.handleReload}
          >
            RELOAD_SYSTEM
          </Button>
        </VStack>
      </Box>
    );
  }
}

export default ErrorBoundary;
