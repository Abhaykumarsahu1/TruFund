import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const Landing = () => {
    const navigate = useNavigate();
    const { account, connectWallet } = useWallet();

   const handleCampaigner = () => {
    if (!account) {
        alert("Please connect your wallet first!");
        return;
    }
    navigate("/register");
};

const handleDonor = () => {
    if (!account) {
        alert("Please connect your wallet first!");
        return;
    }
    navigate("/donate");
};
    return (
        <div style={styles.container}>

            {/* Hero Section */}
            <div style={styles.hero}>
                <h1 style={styles.title}>
                    Transparent Giving, <br />
                    <span style={styles.highlight}>Powered by Blockchain</span>
                </h1>
                <p style={styles.subtitle}>
                    TruFund is a decentralized charity platform where every donation
                    is tracked on-chain and every withdrawal requires board approval.
                    No middlemen. No blind trust.
                </p>
            </div>

            {/* Cards */}
            <div style={styles.cardContainer}>

                {/* Campaigner Card */}
                <div style={styles.card}>
                    <div style={styles.cardIcon}>🏛️</div>
                    <h2 style={styles.cardTitle}>I'm a Campaigner</h2>
                    <p style={styles.cardDesc}>
                        Register your NGO, launch a fundraising campaign,
                        and manage fund withdrawals through your board's approval.
                    </p>
                    <ul style={styles.featureList}>
                        <li>✅ Create & manage campaigns</li>
                        <li>✅ Upload docs to IPFS</li>
                        <li>✅ Request fund withdrawals</li>
                        <li>✅ Full on-chain transparency</li>
                    </ul>
                    <button style={styles.primaryBtn} onClick={handleCampaigner}>
                        Start a Campaign →
                    </button>
                </div>

                {/* Donor Card */}
                <div style={styles.card}>
                    <div style={styles.cardIcon}>💚</div>
                    <h2 style={styles.cardTitle}>I'm a Donor</h2>
                    <p style={styles.cardDesc}>
                        Browse verified campaigns, donate crypto directly to
                        smart contracts, and track exactly how your funds are used.
                    </p>
                    <ul style={styles.featureList}>
                        <li>✅ Browse all campaigns</li>
                        <li>✅ Donate in ETH</li>
                        <li>✅ Track fund usage</li>
                        <li>✅ 100% on-chain record</li>
                    </ul>
                    <button style={styles.secondaryBtn} onClick={handleDonor}>
                        Browse Campaigns →
                    </button>
                </div>

            </div>

            {/* Stats bar */}
            <div style={styles.statsBar}>
                <div style={styles.stat}>
                    <span style={styles.statNumber}>100%</span>
                    <span style={styles.statLabel}>On-chain Transparency</span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.stat}>
                    <span style={styles.statNumber}>2/3</span>
                    <span style={styles.statLabel}>Supermajority Required</span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.stat}>
                    <span style={styles.statNumber}>0</span>
                    <span style={styles.statLabel}>Middlemen</span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.stat}>
                    <span style={styles.statNumber}>ETH</span>
                    <span style={styles.statLabel}>Sepolia Testnet</span>
                </div>
            </div>

        </div>
    );
};

const styles = {
    container: {
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px 20px",
        gap: "60px",
    },
    hero: {
        textAlign: "center",
        maxWidth: "700px",
    },
    title: {
        fontSize: "48px",
        fontWeight: "800",
        lineHeight: 1.2,
        margin: 0,
    },
    highlight: {
        color: "#22c55e",
    },
    subtitle: {
        fontSize: "18px",
        color: "#94a3b8",
        marginTop: "20px",
        lineHeight: 1.7,
    },
    cardContainer: {
        display: "flex",
        gap: "30px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    card: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "40px",
        width: "340px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        transition: "transform 0.2s",
    },
    cardIcon: {
        fontSize: "48px",
    },
    cardTitle: {
        fontSize: "24px",
        fontWeight: "700",
        margin: 0,
        color: "#f1f5f9",
    },
    cardDesc: {
        color: "#94a3b8",
        lineHeight: 1.6,
        margin: 0,
        fontSize: "15px",
    },
    featureList: {
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        color: "#cbd5e1",
        fontSize: "14px",
    },
    primaryBtn: {
        background: "#22c55e",
        color: "#000",
        border: "none",
        padding: "14px",
        borderRadius: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        fontSize: "16px",
        marginTop: "8px",
    },
    secondaryBtn: {
        background: "transparent",
        color: "#22c55e",
        border: "2px solid #22c55e",
        padding: "14px",
        borderRadius: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        fontSize: "16px",
        marginTop: "8px",
    },
    statsBar: {
        display: "flex",
        gap: "40px",
        alignItems: "center",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "30px 50px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    stat: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
    },
    statNumber: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#22c55e",
    },
    statLabel: {
        fontSize: "13px",
        color: "#64748b",
    },
    statDivider: {
        width: "1px",
        height: "40px",
        background: "#334155",
    },
};

export default Landing;