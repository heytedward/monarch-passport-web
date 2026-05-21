import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import useStore from '../store/useStore';

export default function Claim() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();
  const { ready, authenticated, user, login } = usePrivy();
  const executeHandshake = useStore((state) => state.executeHandshake);
  const [status, setStatus] = useState('AWAITING_INPUT');
  const [loading, setLoading] = useState(false);

  const handleInitialize = async () => {
    if (!user?.id) return;
    setLoading(true);
    setStatus('EXECUTING_UPLINK...');

    try {
      const res = await fetch('/api/v2/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId, ownerId: user.id }),
      });

      if (!res.ok) throw new Error('Uplink Failed');

      setStatus('ARTIFACT_INITIALIZED. ROUTING TO CLOSET...');
      if (executeHandshake && tagId) executeHandshake(tagId);
      setTimeout(() => navigate('/closet'), 1500);
    } catch (error) {
      console.error(error);
      setStatus('ACTIVATION_FAILED. TRY AGAIN.');
      setLoading(false);
    }
  };

  if (!ready) return <div className="h-screen bg-black text-[#FFB000] font-mono flex items-center justify-center">LOADING_SYSTEM_RESOURCES...</div>;

  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center font-mono text-white p-6 text-center select-none">
      <h1 className="text-3xl font-black mb-2 tracking-widest text-[#FFB000] uppercase">Initialization Protocol</h1>
      <p className="mb-8 text-gray-400">Target Artifact: <span className="text-white font-bold">{tagId}</span></p>

      <div className="w-full max-w-sm border border-gray-800 p-6 flex flex-col gap-4">
        {!authenticated ? (
          <>
            <p className="text-sm text-gray-400">Identity verification required to bind physical artifact.</p>
            <button 
              onClick={login}
              className="w-full bg-white text-black py-3 font-bold uppercase tracking-wide hover:bg-gray-200 transition-colors"
            >
              Authenticate Identity
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-green-500">Identity Confirmed: {user?.id.slice(0, 12)}...</p>
            <button 
              onClick={handleInitialize}
              disabled={loading}
              className="w-full bg-[#FFB000] text-black py-3 font-bold uppercase tracking-wide hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Initialize Artifact'}
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-sm text-[#FFB000] animate-pulse">{status}</p>
    </div>
  );
}
