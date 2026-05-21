import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';

export default function TerminalScanner() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();
  
  const user = useStore((state) => state.user);
  const executeHandshake = useStore((state) => state.executeHandshake);
  
  const [status, setStatus] = useState('INITIALIZING_UPLINK...');

  useEffect(() => {
    async function processArtifact() {
      if (!tagId) {
        setStatus('ERROR: NO_ARTIFACT_ID_PROVIDED.');
        return;
      }

      setStatus(`VERIFYING_ARTIFACT: ${tagId}`);
      
      try {
        // Fetch artifact status from backend
        const response = await fetch(`/api/v2/verify/${tagId}`);
        
        if (!response.ok) throw new Error('Uplink failed');
        const artifactData = await response.json();

        // Logic Gate: Unclaimed Artifact (First Tap)
        if (!artifactData.isActivated) {
          setStatus('UNCLAIMED_ARTIFACT_DETECTED. ROUTING TO CLAIM TERMINAL...');
          setTimeout(() => navigate(`/claim/${tagId}`), 1500);
        } 
        // Logic Gate: Owner Tap (Digital Closet)
        else if (user && user.id === artifactData.ownerId) {
          setStatus('AUTHORIZATION_CONFIRMED. OPENING DIGITAL CLOSET...');
          if (executeHandshake) executeHandshake(tagId); 
          setTimeout(() => navigate(`/closet`), 1500);
        } 
        // Logic Gate: Stranger Tap (Recruitment/Affiliate)
        else {
          setStatus('FOREIGN_ARTIFACT. ROUTING TO RECRUITMENT PROTOCOL...');
          setTimeout(() => navigate(`/recruit?ref=${artifactData.ownerId}&tag=${tagId}`), 1500);
        }
      } catch (error) {
        console.error("Terminal Error:", error);
        setStatus('UPLINK_FAILED. INVALID_OR_CORRUPT_ARTIFACT.');
      }
    }

    processArtifact();
  }, [tagId, user, navigate, executeHandshake]);

  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center font-mono text-[#FFB000] p-6 text-center select-none">
      <h1 className="text-3xl font-black mb-6 tracking-widest uppercase">Monarch_OS // Terminal</h1>
      <p className="animate-pulse font-bold text-lg">{status}</p>
      <div className="mt-8 w-16 h-1 bg-[#FFB000] animate-bounce"></div>
    </div>
  );
}
