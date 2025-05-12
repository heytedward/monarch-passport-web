import React from 'react';

interface ClosetItem {
  name: string;
  image: string;
  borderColor: string;
}

const items: ClosetItem[] = [
  {
    name: 'Monarch Jacket',
    image: '/monarch-jacket.png', // Make sure this image is in your public folder
    borderColor: '#7F3FBF', // Your purple
  },
  // You can add more items here
];

const Closet: React.FC = () => {
  return (
    <div style={{
      backgroundColor: '#121212',
      color: '#FFFBEF',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'Outfit, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>My Closet</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '16px',
        justifyItems: 'center'
      }}>
        {items.map((item, index) => (
          <div key={index} style={{
            border: `2px solid ${item.borderColor}`,
            borderRadius: '16px',
            width: '160px',
            height: '220px',
            backgroundColor: '#1C1C1C',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <img src={item.image} alt={item.name} style={{ height: '100px', marginBottom: '12px' }} />
            <p style={{ textAlign: 'center' }}>{item.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Closet;