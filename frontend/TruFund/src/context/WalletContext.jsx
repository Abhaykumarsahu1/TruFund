import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import CampaignFactoryABI from "../contracts/CampaignFactory.json";
import CampaignABI from "../contracts/Campaign.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount]   = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner]     = useState(null);
    const [chainId, setChainId]   = useState(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);
    const [isBoardMember, setIsBoardMember] = useState(false);

    const SEPOLIA_CHAIN_ID = "0xaa36a7";

    const checkBoardMembership = async (account, provider) => {
    try {
         const factory = new ethers.Contract(
         CONTRACT_ADDRESSES.CAMPAIGN_FACTORY,
         CampaignFactoryABI.abi,
         provider
        );
        const allCampaigns = await factory.getAllCampaigns();

        for (const address of allCampaigns) {
            const campaign = new ethers.Contract(
                address,
                CampaignABI.abi,
                provider
            );
            const isMember = await campaign.isBoardMember(account);
            if (isMember) {
                setIsBoardMember(true);
                return;
            }
        }
        setIsBoardMember(false);
    } catch (err) {
        console.error("Board check failed:", err);
        setIsBoardMember(false);
    }
};

    // ONLY listen for changes — no auto connect
    useEffect(() => {
        if (!window.ethereum) return;

        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                // user disconnected from MetaMask side
                setAccount(null);
                setSigner(null);
                setProvider(null);
            } else {
                setAccount(accounts[0]);
            }
        };

      const handleChainChanged = async (chainId) => {
    // instead of reloading, just update the provider
    if (window.ethereum) {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const web3Signer = await web3Provider.getSigner();
        setProvider(web3Provider);
        setSigner(web3Signer);
        setChainId(chainId);
    }
};

        window.ethereum.on("accountsChanged", handleAccountsChanged);
        window.ethereum.on("chainChanged", handleChainChanged);

        return () => {
            window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
            window.ethereum.removeListener("chainChanged", handleChainChanged);
        };
    }, []);

  const connectWallet = async () => {
    try {
        setLoading(true);
        setError(null);

        // force MetaMask provider, not Brave
        const metaMaskProvider = window.ethereum.providers 
            ? window.ethereum.providers.find(p => p.isMetaMask && !p.isBraveWallet)
            : window.ethereum;

        if (!metaMaskProvider) {
            setError("MetaMask not found!");
            return;
        }

        // Step 1 — force disconnect all accounts first
        // This makes MetaMask always show the account picker popup
        await metaMaskProvider.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }],
        });

        // Step 2 — now get the selected account
        const accounts = await metaMaskProvider.request({
            method: "eth_requestAccounts",
        });

        if (!accounts || accounts.length === 0) {
            setError("No account selected.");
            return;
        }

        // Step 3 — set up provider and signer
        const web3Provider = new ethers.BrowserProvider(metaMaskProvider);
        const web3Signer   = await web3Provider.getSigner();
        const network      = await web3Provider.getNetwork();

        setProvider(web3Provider);
        setSigner(web3Signer);
        setAccount(accounts[0]);
        await checkBoardMembership(accounts[0], web3Provider);
        setChainId(network.chainId.toString());

    } catch (err) {
        if (err.code === 4001) {
            setError("Connection rejected.");
        } else {
            setError(err.message);
        }
    } finally {
        setLoading(false);
    }
};

    const disconnectWallet = () => {
        setAccount(null);
        setProvider(null);
        setSigner(null);
        setChainId(null);
        setError(null);
        setIsBoardMember(false);
    };

    const shortAddress = (addr) => {
        if (!addr) return "";
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <WalletContext.Provider value={{
            account,
            provider,
            signer,
            chainId,
            loading,
            error,
            isBoardMember,
            connectWallet,
            disconnectWallet,
            shortAddress,
        }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => useContext(WalletContext);