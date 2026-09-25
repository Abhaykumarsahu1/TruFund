# TruFund

TruFund is a decentralized charity donation tracker built on Ethereum, designed to bring full transparency to how donations are collected and used. Every donation, campaign, and fund withdrawal is recorded on-chain, so donors can verify exactly where their money goes instead of relying on trust alone.

## Problem

Traditional charity platforms are opaque — donors have no way to verify that funds are actually used for the causes they were given for. TruFund solves this by moving the entire donation lifecycle (campaign creation, donations, and withdrawals) onto the blockchain, making every transaction publicly auditable.

## Features

- **On-chain campaign creation** — Anyone can create a fundraising campaign with a goal amount and description.
- **Transparent donations** — All donations are recorded immutably on-chain and tied to a specific campaign.
- **Verifiable fund withdrawals** — Withdrawals are traceable, so donors can see how raised funds are actually used.
- **Decentralized storage** — Campaign metadata/images are stored on IPFS (via Pinata) instead of centralized servers.
- **Wallet-based auth** — Users connect via MetaMask; no accounts or passwords.

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity |
| Contract Tooling | Foundry (build, test, deploy) |
| Frontend | React |
| Blockchain Interaction | ethers.js |
| Wallet | MetaMask |
| Decentralized Storage | IPFS (via Pinata) |
| Network | Ethereum Sepolia Testnet |

## Architecture

1. **Smart Contract Layer** — Solidity contracts handle campaign creation, donation tracking, and withdrawal logic, deployed and tested using Foundry.
2. **Frontend Layer** — A React app interacts with the deployed contracts via ethers.js, letting users create campaigns, donate, and track fund usage.
3. **Storage Layer** — Campaign details/images are uploaded to IPFS through Pinata, keeping the app decentralized end-to-end rather than relying on a centralized backend/database.

## Getting Started

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js & npm
- MetaMask browser extension
- Sepolia testnet ETH (from a faucet)

### Smart Contracts

```bash
cd contracts
forge install
forge build
forge test
```

Deploy to Sepolia:
```bash
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Create a `.env` file with:
```
REACT_APP_CONTRACT_ADDRESS=<deployed_contract_address>
REACT_APP_PINATA_API_KEY=<your_pinata_api_key>
REACT_APP_PINATA_SECRET_KEY=<your_pinata_secret_key>
```

## Usage

1. Connect your MetaMask wallet (Sepolia testnet).
2. Create a new campaign with a goal and description.
3. Browse active campaigns and donate ETH directly to one.
4. Track donations and withdrawals for any campaign on-chain.

## Future Improvements

- Milestone-based fund release (withdrawals unlocked as goals are hit)
- Multi-token donation support
- Mainnet/L2 deployment
- Campaign verification/reputation system

## License

MIT
