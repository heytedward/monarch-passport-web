import React from 'react';
import { Box, Button, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { useAuth } from '../lib/auth';
import useStore from '../store/useStore';
import {
  USERNAME_MAX,
  normalizeUsername,
  usernameErrorMessage,
  usernameProblem,
} from '../lib/username';

interface UsernameFormProps {
  /** Called with the saved name after the server accepts it. */
  onSaved?: (username: string) => void;
  submitLabel?: string;
  autoFocus?: boolean;
}

/**
 * Username input + save, shared by the first-login prompt and Settings.
 * Saves through `set_username`; the store is updated on success.
 */
export default function UsernameForm({ onSaved, submitLabel = 'SAVE', autoFocus }: UsernameFormProps) {
  const { user, getAccessToken } = useAuth();
  const { username, setUsername } = useStore();
  const [value, setValue] = React.useState(username ?? '');
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const name = normalizeUsername(value);
  const problem = usernameProblem(value);
  const unchanged = !!username && name === username;
  const message = serverError ?? (touched && value ? problem : null);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (problem || unchanged || !user?.id) return;
    setSaving(true);
    setServerError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, action: 'set_username', username: name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setServerError(usernameErrorMessage(data?.error));
        return;
      }
      setUsername(data.username);
      onSaved?.(data.username);
    } catch {
      setServerError(usernameErrorMessage(undefined));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box as="form" onSubmit={save} noValidate>
      <VStack align="stretch" spacing={2}>
        <HStack spacing={0} border="2px solid" borderColor={message ? '#DC143C' : 'currentColor'}>
          <Text px={3} fontWeight="900" color="#FFB000" aria-hidden>@</Text>
          <Input
            aria-label="Username"
            value={value}
            onChange={(e) => { setValue(e.target.value); setServerError(null); }}
            onBlur={() => setTouched(true)}
            maxLength={USERNAME_MAX + 1}
            autoFocus={autoFocus}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            placeholder="yourname"
            border="none"
            borderRadius="0"
            px={0}
            h="48px"
            fontWeight="900"
            textTransform="lowercase"
            _focusVisible={{ boxShadow: 'none' }}
          />
          <Button
            type="submit"
            isLoading={saving}
            isDisabled={!!problem || unchanged}
            borderRadius="0"
            h="48px"
            px={5}
            bg="#FFB000"
            color="black"
            fontWeight="900"
            fontSize="xs"
            _hover={{ bg: '#e69e00' }}
            _disabled={{ bg: 'whiteAlpha.300', color: 'whiteAlpha.600', cursor: 'not-allowed' }}
          >
            {submitLabel}
          </Button>
        </HStack>
        <Text fontSize="10px" fontWeight="700" color={message ? '#DC143C' : 'gray.500'} minH="14px">
          {message ?? '3 to 20 characters · letters, numbers and hyphens'}
        </Text>
      </VStack>
    </Box>
  );
}
