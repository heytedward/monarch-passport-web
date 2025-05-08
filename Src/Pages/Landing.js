import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Magic } from 'magic-sdk';

const magic = new Magic('YOUR_MAGIC_PUBLISHABLE_KEY'); // Replace with your Magic key

function Landing() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    const email = window.prompt("Enter your email:");
    if (email) {
      await magic.auth.loginWithEmailOTP({ email });
      navigate('/passport');
    }
  };

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h1>MONARCH PASSPORT</h1>
      <p>Earn stamps. Build your legend.</p>
      <button onClick={handleLogin}>Login / Sign Up</button>
      <br />
      <button onClick={() => alert("WNGS is your reward for exploration.")}>What is WNGS?</button>
    </div>
  );
}

export default Landing;
