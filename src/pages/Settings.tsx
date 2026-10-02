import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  HStack,
  Link,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import {
  PiArrowLeftBold,
  PiArrowRightBold,
  PiArrowUpRightBold,
  PiAppleLogoBold,
  PiEnvelopeSimpleBold,
  PiGoogleLogoBold,
  PiWalletBold,
} from 'react-icons/pi';
import { useAuth, type LoginKind } from '../lib/auth';
import { clearCache } from '../lib/pageCache';
import { isAdminUser } from '../lib/admin';
import {
  canPromptNatively,
  isIOS,
  isStandalone,
  onInstallAvailabilityChange,
  promptNativeInstall,
} from '../lib/install';
import useStore from '../store/useStore';
import UsernameForm from '../components/UsernameForm';
import { memberHandle } from '../lib/username';

const GOLD = '#FFB000';
const CRIMSON = '#DC143C';
const STORE_URL = 'https://papillonbrand.us';
const PRIVACY_EMAIL = 'legal@papillonbrand.us';

interface LoginRow {
  kind: LoginKind;
  label: string;
  icon: React.ElementType;
  /** Email address or Google/Apple account shown to the member. */
  detail: string | null;
  /** What Privy needs to remove it: the email address or the OAuth subject. */
  id: string | null;
}

function Section({ title, children, border }: { title: string; children: React.ReactNode; border: string }) {
  return (
    <Box px={6} py={7} borderBottom={`1px solid ${border}`}>
      <Text fontSize="10px" fontWeight="900" color={GOLD} letterSpacing="0.12em" mb={4}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

const Settings = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout, linkLogin, unlinkLogin } = useAuth();
  const { username, setUsername } = useStore();
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [removing, setRemoving] = React.useState<LoginKind | null>(null);
  const [editingName, setEditingName] = React.useState(false);

  const bgColor = useColorModeValue('gray.50', 'black');
  const text = useColorModeValue('black', 'white');
  const mutedText = useColorModeValue('gray.600', 'whiteAlpha.600');
  const border = useColorModeValue('gray.300', 'whiteAlpha.300');
  const cardBg = useColorModeValue('white', 'whiteAlpha.50');

  React.useEffect(() => {
    const off = onInstallAvailabilityChange(rerender);
    return () => { off(); };
  }, []);

  const logins: LoginRow[] = [
    {
      kind: 'email', label: 'Email', icon: PiEnvelopeSimpleBold,
      detail: user?.email?.address ?? null, id: user?.email?.address ?? null,
    },
    {
      kind: 'google', label: 'Google', icon: PiGoogleLogoBold,
      detail: user?.google?.email ?? null, id: user?.google?.subject ?? null,
    },
    {
      kind: 'apple', label: 'Apple', icon: PiAppleLogoBold,
      detail: user?.apple?.email ?? (user?.apple ? 'Connected' : null), id: user?.apple?.subject ?? null,
    },
  ];
  // Ways back into the account: the methods above plus any outside wallet
  // (the built-in Passport wallet doesn't count; it can't sign you in alone).
  const externalWallets = (user?.linkedAccounts ?? []).filter(
    (a: any) => a.type === 'wallet' && a.walletClientType !== 'privy',
  ).length;
  const signInCount = logins.filter((l) => l.id).length + externalWallets;

  const walletAddress = user?.wallet?.address;
  const admin = isAdminUser(user);
  const showInstall = !isStandalone() && (isIOS() || canPromptNatively());

  const handleLogout = async () => {
    clearCache();
    setUsername(null);
    await logout();
    navigate('/');
  };

  const handleRemove = async (row: LoginRow) => {
    if (!row.id) return;
    setRemoving(row.kind);
    try {
      await unlinkLogin(row.kind, row.id);
      toast({ title: `${row.label.toUpperCase()} REMOVED`, status: 'success', duration: 2000 });
    } catch {
      toast({ title: `COULD NOT REMOVE ${row.label.toUpperCase()}`, status: 'error', duration: 3000 });
    } finally {
      setRemoving(null);
    }
  };

  const deleteMailto = `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent('Data Request · delete my Passport account')}&body=${encodeURIComponent(
    `Please delete my Monarch Passport account and its data.\n\nAccount id: ${user?.id ?? ''}\nUsername: ${username ? '@' + username : 'not set'}\n`,
  )}`;

  const rowButton = {
    size: 'sm' as const,
    h: '34px',
    borderRadius: '0',
    fontWeight: '900',
    fontSize: '10px',
    px: 4,
  };

  const linkRow = (label: string, onClick: () => void, external = false) => (
    <Box
      as="button"
      onClick={onClick}
      w="full"
      textAlign="left"
      py={3}
      borderBottom={`1px solid ${border}`}
      _last={{ borderBottom: 'none' }}
      _hover={{ color: GOLD }}
    >
      <HStack justify="space-between">
        <Text fontSize="sm" fontWeight="900">{label}</Text>
        {external ? <PiArrowUpRightBold /> : <PiArrowRightBold />}
      </HStack>
    </Box>
  );

  return (
    <Box bg={bgColor} minH="100vh" pb="100px" color={text}>
      {/* Header */}
      <Box px={6} pt={12} pb={6} borderBottom={`4px solid ${text}`}>
        <HStack spacing={3}>
          <Button
            variant="ghost"
            p={0}
            minW="auto"
            aria-label="Back"
            _hover={{ bg: 'transparent', transform: 'translateX(-4px)' }}
            onClick={() => navigate(-1)}
          >
            <PiArrowLeftBold size={24} color="currentColor" />
          </Button>
          <Heading fontSize="3xl" fontWeight="900" fontStyle="italic" textTransform="uppercase" letterSpacing="-0.02em">
            Settings
          </Heading>
        </HStack>
      </Box>

      <VStack spacing={0} align="stretch">
        {/* Username */}
        <Section title="YOUR NAME" border={border}>
          {username && !editingName ? (
            <HStack justify="space-between" bg={cardBg} border={`2px solid ${text}`} p={4}>
              <Box>
                <Text fontSize="xl" fontWeight="900">{memberHandle(username)}</Text>
                <Text fontSize="10px" color={mutedText} mt={1}>Shown on your profile and in the feed</Text>
              </Box>
              <Button {...rowButton} variant="outline" borderColor={text} borderWidth="2px" onClick={() => setEditingName(true)}>
                CHANGE
              </Button>
            </HStack>
          ) : (
            <VStack align="stretch" spacing={2}>
              {!username && (
                <Text fontSize="xs" color={mutedText} mb={1}>
                  Pick the name people see on your profile and in the feed.
                </Text>
              )}
              <UsernameForm
                autoFocus={editingName}
                onSaved={() => {
                  setEditingName(false);
                  toast({ title: 'NAME SAVED', status: 'success', duration: 1500 });
                }}
              />
              {editingName && (
                <Button variant="link" alignSelf="start" size="xs" color={mutedText} fontWeight="900" onClick={() => setEditingName(false)}>
                  CANCEL
                </Button>
              )}
            </VStack>
          )}
        </Section>

        {/* Sign-in methods */}
        <Section title="SIGN IN WITH" border={border}>
          <VStack align="stretch" spacing={0} border={`2px solid ${text}`} bg={cardBg}>
            {logins.map((row) => (
              <HStack key={row.kind} justify="space-between" px={4} py={3} borderBottom={`1px solid ${border}`}>
                <HStack spacing={3} minW={0}>
                  <Box as={row.icon} boxSize="20px" flexShrink={0} />
                  <Box minW={0}>
                    <Text fontSize="sm" fontWeight="900">{row.label}</Text>
                    <Text fontSize="10px" color={mutedText} noOfLines={1}>
                      {row.detail ?? 'Not connected'}
                    </Text>
                  </Box>
                </HStack>
                {row.id ? (
                  <Button
                    {...rowButton}
                    variant="outline"
                    borderColor={border}
                    borderWidth="2px"
                    isLoading={removing === row.kind}
                    isDisabled={signInCount <= 1}
                    title={signInCount <= 1 ? 'Add another way to sign in first' : undefined}
                    onClick={() => handleRemove(row)}
                  >
                    REMOVE
                  </Button>
                ) : (
                  <Button {...rowButton} bg={GOLD} color="black" _hover={{ bg: '#e69e00' }} onClick={() => linkLogin(row.kind)}>
                    CONNECT
                  </Button>
                )}
              </HStack>
            ))}
            {walletAddress && (
              <HStack px={4} py={3} spacing={3}>
                <Box as={PiWalletBold} boxSize="20px" flexShrink={0} />
                <Box>
                  <Text fontSize="sm" fontWeight="900">Passport wallet</Text>
                  <Text fontSize="10px" color={mutedText}>
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </Text>
                </Box>
              </HStack>
            )}
          </VStack>
          <Text fontSize="10px" color={mutedText} mt={3} lineHeight="1.5">
            Connect more than one so you can always get back in. You need at least one.
          </Text>
        </Section>

        {/* Look */}
        <Section title="YOUR LOOK" border={border}>
          {linkRow('Themes and avatars', () => navigate('/closet'))}
        </Section>

        {/* App */}
        {showInstall && (
          <Section title="APP" border={border}>
            {canPromptNatively() ? (
              linkRow('Add Passport to your Home Screen', () => { promptNativeInstall().then(rerender); })
            ) : (
              <Box>
                <Text fontSize="sm" fontWeight="900">Add Passport to your Home Screen</Text>
                <Text fontSize="xs" color={mutedText} mt={1} lineHeight="1.5">
                  In Safari, tap Share, then Add to Home Screen.
                </Text>
              </Box>
            )}
          </Section>
        )}

        {/* Help */}
        <Section title="HELP" border={border}>
          {linkRow('Shop Papillon', () => window.open(STORE_URL, '_blank', 'noopener'), true)}
          {linkRow('Privacy policy', () => window.open(`${STORE_URL}/privacy-policy`, '_blank', 'noopener'), true)}
          {linkRow('Terms of service', () => window.open(`${STORE_URL}/terms-of-service`, '_blank', 'noopener'), true)}
          {linkRow('Contact us', () => { window.location.href = `mailto:${PRIVACY_EMAIL}`; }, true)}
        </Section>

        {/* Admin only */}
        {admin && (
          <Section title="ADMIN" border={border}>
            <Button
              w="full"
              h="52px"
              borderRadius="0"
              bg={GOLD}
              color="black"
              fontWeight="900"
              _hover={{ bg: text, color: GOLD }}
              onClick={() => navigate('/command-center')}
            >
              OPEN COMMAND CENTER
            </Button>
          </Section>
        )}

        {/* Account */}
        <Section title="ACCOUNT" border={border}>
          <VStack spacing={4} align="stretch">
            <Button
              h="54px"
              w="full"
              borderRadius="0"
              bg={text}
              color={bgColor}
              fontWeight="900"
              _hover={{ bg: GOLD, color: 'black' }}
              onClick={handleLogout}
            >
              LOG OUT
            </Button>
            <Link
              href={deleteMailto}
              alignSelf="center"
              fontSize="10px"
              fontWeight="900"
              color={CRIMSON}
              _hover={{ textDecoration: 'underline' }}
            >
              DELETE MY ACCOUNT
            </Link>
            <Text fontSize="10px" color={mutedText} textAlign="center" lineHeight="1.5">
              Opens an email to request deleting your account and its data.
            </Text>
          </VStack>
        </Section>
      </VStack>

      <Text fontSize="9px" color={mutedText} textAlign="center" mt={8}>
        MONARCH PASSPORT · PAPILLON BRAND
      </Text>
    </Box>
  );
};

export default Settings;
