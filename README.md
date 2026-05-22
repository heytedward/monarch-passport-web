# Monarch Passport

A Web2 loyalty app for Papillon Brand that will eventually integrate with Solana. Customers can scan NFC-enabled apparel to earn $WNGS points, collect seasonal stamps, and view their digital passport of rewards.

## Features

- NFC scanning of Papillon Brand apparel
- $WNGS points system
- Seasonal digital stamps collection
- Rewards redemption
- Modern, responsive UI built with Chakra UI
- Future Solana integration planned
- Deployment refresh commit

## Tech Stack

- React 18
- TypeScript
- Vite
- Chakra UI
- React Router
- Zustand (State Management)
- Web NFC API

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Development

The app is structured as follows:

- `/src/components` - Reusable UI components
- `/src/pages` - Main application pages
- `/src/store` - Zustand state management
- `/src/types` - TypeScript type definitions

## NFC Scanning

The app uses the Web NFC API to scan NFC-enabled apparel. Note that Web NFC is currently only supported in Chrome for Android. For development and testing on other platforms, you can use the mock NFC data in the development environment.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 