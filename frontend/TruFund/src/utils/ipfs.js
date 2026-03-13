import axios from "axios";

const PINATA_API_KEY    = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY;
const PINATA_BASE_URL   = "https://api.pinata.cloud";

// ─────────────────────────────────────────
//  Upload IMAGE to IPFS via Pinata
// ─────────────────────────────────────────

export const uploadImageToIPFS = async (file) => {
    try {
        const formData = new FormData();
        formData.append("file", file);

        // metadata
        const metadata = JSON.stringify({
            name: `TruFund-${Date.now()}`,
        });
        formData.append("pinataMetadata", metadata);

        const options = JSON.stringify({ cidVersion: 0 });
        formData.append("pinataOptions", options);

        const response = await axios.post(
            `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
            formData,
            {
                maxBodyLength: Infinity,
                headers: {
                    "Content-Type": "multipart/form-data",
                    pinata_api_key:        PINATA_API_KEY,
                    pinata_secret_api_key: PINATA_SECRET_KEY,
                },
            }
        );

        const ipfsHash = response.data.IpfsHash;
        console.log("Uploaded to IPFS:", ipfsHash);
        return ipfsHash;

    } catch (err) {
        console.error("IPFS upload error:", err);
        throw new Error("Failed to upload image to IPFS");
    }
};

// ─────────────────────────────────────────
//  Upload JSON metadata to IPFS
// ─────────────────────────────────────────

export const uploadMetadataToIPFS = async (metadata) => {
    try {
        const response = await axios.post(
            `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
            {
                pinataContent: metadata,
                pinataMetadata: { name: `TruFund-Meta-${Date.now()}` },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    pinata_api_key:        PINATA_API_KEY,
                    pinata_secret_api_key: PINATA_SECRET_KEY,
                },
            }
        );

        return response.data.IpfsHash;
    } catch (err) {
        console.error("Metadata upload error:", err);
        throw new Error("Failed to upload metadata to IPFS");
    }
};

// ─────────────────────────────────────────
//  Get IPFS image URL from hash
// ─────────────────────────────────────────

export const getIPFSUrl = (hash) => {
    if (!hash || hash === "QmDefaultHash") return null;
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
};