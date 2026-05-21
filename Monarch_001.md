# Monarch_001: Technical Documentation & Application Manifesto

## Project Overview: The Monarch Passport
**Monarch_001** is a high-fidelity, mobile-first web application serving as the primary interface for the **Monarch Ecosystem**. It bridges physical brand artifacts with digital identity and ownership through a "Phygital" (Physical + Digital) protocol. 

Built with a strict industrial "De Stijl" aesthetic, the application operates as a digital terminal for **Agents** and **Humans** to interact with the brand's proprietary technologies, specifically the **WNGS_LINK** protocol.

---

## 🛠 Tech Stack (Expert Level)
- **Framework:** React 18+ with TypeScript
- **Styling:** Chakra UI (Custom Theme)
- **State Management:** Zustand (with `persist` middleware for session continuity)
- **Authentication:** Privy (Supporting Email, Social, and Web3 login)
- **Blockchain Interface:** Embedded Solana Wallets (via Privy)
- **Hardware Integration:** Web NFC API (`NDEFReader`) for physical artifact verification
- **Build Tool:** Vite
- **Infrastructure:** Vercel (Configured)

---

## 🚀 Key Features

### 1. WNGS_LINK (NFC Scanning)
The core "Phygital" bridge. Using the Web NFC API, users can "Execute Handshake" with physical brand items.
- **Protocol:** `NDEFReader` polls for hardware UIDs/URL records.
- **Validation:** Synchronizes with a backend REST API to award $WNGS credits and link physical assets to the digital closet.
- **UX:** Industrial terminal feedback with real-time syncing states.

### 2. Digital Identity System
The application distinguishes between two primary identity types:
- **HUMAN:** Standard user profile.
- **AGENT:** Advanced identity type, often used for developers or high-clearance community members.
- **Authentication:** Managed via Privy, ensuring a seamless onboarding flow for both Web2 and Web3 users.

### 3. $WNGS Wallet & Economy
A dedicated financial terminal for the Monarch ecosystem.
- **Currency:** $WNGS (Monarch Credits).
- **Features:** Transaction history, points balance, and buy/earn workflows.
- **Design:** Modeled after high-contrast financial terminals.

### 4. The Digital Closet
An inventory system tracking all "Synced Artifacts."
- **Function:** Displays digital representations of physical products owned by the user.
- **Integration:** Directly linked to the successful execution of the WNGS_LINK protocol.

### 5. Monarch Times (Social Feed)
A specialized activity feed providing ecosystem updates, rarities (e.g., 'MONARCH', 'LEGENDARY'), and community interactions.

### 6. Digital Passport
A centralized identity hub displaying "Clearance Levels" and status within the ecosystem. It acts as the user's primary "Proof of Identity."

---

## 🎯 Target Audience
1.  **Brand Enthusiasts:** Collectors of Monarch physical/digital assets.
2.  **Web3 Pioneers:** Users seeking seamless integration between physical goods and on-chain ownership.
3.  **Agents & Developers:** Technical contributors who interact with the "Terminal" aspect of the brand.

---

## 🧪 QA & Verification Guide

### Critical Paths for Testing:
- **Auth Flow:** Verify Privy login methods and ensures `identityType` is correctly set in Zustand state.
- **NFC Handshake:** Test on Android Chrome (Web NFC support) and use the `DEBUG_SIMULATION_MODE` for desktop testing.
- **State Persistence:** Ensure $WNGS balance and identity persist across page refreshes (Zustand storage).
- **Responsive Terminal UI:** The app is mobile-first; verify the "De Stijl" layout holds across various mobile viewports.
- **Dev Bypass:** Verify that `localStorage.getItem('monarch_dev_bypass') === 'true'` allows bypassing auth for rapid UI development.

### Architecture Structure:
- `/src/pages`: Core views (Wallet, Scanner, Shop, Closet, etc.)
- `/src/store`: Zustand state definitions (`useStore.ts`)
- `/src/components`: Reusable UI elements (Navbar, Logo)
- `/src/config.ts`: Environment and API endpoint configuration

---

## 💎 Design Philosophy: "Industrial De Stijl"
The app intentionally uses a limited color palette (Black, White, #FFB000 Yellow) and heavy-weight typography (Archivo Black) to evoke the feeling of a high-security terminal rather than a standard consumer app. This "Industrial" look is key to the Monarch brand identity.

---

*Document Version: 1.0.0*
*System Status: OPERATIONAL*
