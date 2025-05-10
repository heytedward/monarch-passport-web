import { useState } from 'react';

function Home() {
  const [reward, setReward] = useState(null);

  const handleTap = () => {
    setReward({
      message: "You earned 5 $WNGS and 1 stamp!",
      time: new Date().toLocaleTimeString(),
    });
  };

  return (
    <div style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h1>Monarch Passport</h1>
      <p>Tap your item to scan and earn.</p>
      <button onClick={handleTap} style={{ padding: '12px 24px', fontSize: 18 }}>
        Tap to Scan
      </button>

      {reward && (
        <div style={{ marginTop: 40 }}>
          <h3>{reward.message}</h3>
          <p>{reward.time}</p>
        </div>
      )}
    </div>
  );
}

export default Home;