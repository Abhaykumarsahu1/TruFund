import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount]   = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner]     = useState(null);
    const [chainId, setChainId]   = useState(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);

    const SEPOLIA_CHAIN_ID = "0xaa36a7";

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
        const provider = window.ethereum.providers 
            ? window.ethereum.providers.find(p => p.isMetaMask && !p.isBraveWallet)
            : window.ethereum;

        // this will trigger MetaMask popup
        const accounts = await provider.request({
            method: "eth_requestAccounts",
        });

        // set MetaMask as the active provider for ethers
        const web3Provider = new ethers.BrowserProvider(provider);
        const web3Signer   = await web3Provider.getSigner();
        const network      = await web3Provider.getNetwork();

        setProvider(web3Provider);
        setSigner(web3Signer);
        setAccount(accounts[0]);
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
            connectWallet,
            disconnectWallet,
            shortAddress,
        }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => useContext(WalletContext);