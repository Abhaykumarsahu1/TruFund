import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import CampaignFactoryABI from "../contracts/CampaignFactory.json";
import CampaignABI from "../contracts/Campaign.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

export const useContract = () => {
    const { signer, provider } = useWallet();

    // read + write access (needs signer)
    const getFactoryContract = () => {
        if (!signer) return null;
        return new ethers.Contract(
            CONTRACT_ADDRESSES.CAMPAIGN_FACTORY,
            CampaignFactoryABI.abi,
            signer
        );
    };

    // read + write access to a specific campaign
    const getCampaignContract = (address) => {
        if (!signer) return null;
        return new ethers.Contract(
            address,
            CampaignABI.abi,
            signer
        );
    };

    // read only (no signer needed)
    const getFactoryContractReadOnly = () => {
        if (!provider) return null;
        return new ethers.Contract(
            CONTRACT_ADDRESSES.CAMPAIGN_FACTORY,
            CampaignFactoryABI.abi,
            provider
        );
    };

    const getCampaignContractReadOnly = (address) => {
        if (!provider) return null;
        return new ethers.Contract(
            address,
            CampaignABI.abi,
            provider
        );
    };

    return {
        getFactoryContract,
        getCampaignContract,
        getFactoryContractReadOnly,
        getCampaignContractReadOnly,
    };
};