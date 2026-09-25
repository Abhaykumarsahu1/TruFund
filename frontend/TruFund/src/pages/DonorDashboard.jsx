import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContract } from "../hooks/useContract";
import { ethers } from "ethers";
import { getIPFSUrl } from "../utils/ipfs";

const DonorDashboard = () => {
    const navigate = useNavigate();
    const { getFactoryContractReadOnly, getCampaignContractReadOnly } = useContract();

    const [campaigns, setCampaigns]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState(null);

    // ─────────────────────────────────────────
    //  FETCH ALL CAMPAIGNS
    // ─────────────────────────────────────────

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            setError(null);

            const factory = getFactoryContractReadOnly();
            if (!factory) { setError("Contract not loaded"); return; }

            // get all campaign addresses from factory
            const addresses = await factory.getAllCampaigns();
            console.log("Campaign addresses:", addresses);

            if (addresses.length === 0) {
                setCampaigns([]);
                return;
            }

            // fetch details for each campaign
            const campaignData = await Promise.all(
                addresses.map(async (address) => {
                    try {
                        const campaign = getCampaignContractReadOnly(address);

                        const [
                            title,
                            description,
                            goalAmount,
                            totalDonated,
                            deadline,
                            status,
                            campaigner,
                            donorCount,
                            ipfsHash,
                        ] = await Promise.all([
                            campaign.title(),
                            campaign.description(),
                            campaign.goalAmount(),
                            campaign.totalDonated(),
                            campaign.deadline(),
                            campaign.status(),
                            campaign.campaigner(),
                            campaign.getDonorCount(),
                            campaign.ipfsHash(),
                        ]);

                        return {
                            address,
                            title,
                            description,
                            ipfsHash,  
                            goalAmount: ethers.formatEther(goalAmount),
                            totalDonated: ethers.formatEther(totalDonated),
                            deadline: new Date(Number(deadline) * 1000),
                            status: Number(status), // 0=Active, 1=Expired, 2=Closed
                            campaigner,
                            donorCount: Number(donorCount),
                        };
                    } catch (err) {
                        console.error("Error fetching campaign:", address, err);
                        return null;
                    }
                })
            );

            // filter out any failed fetches
            setCampaigns(campaignData.filter(Boolean));

        } catch (err) {
            console.error(err);
            setError("Failed to load campaigns");
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────

    const getStatusLabel = (status) => {
        switch (status) {
            case 0: return { label: "Active",   color: "#22c55e", bg: "#052e16" };
            case 1: return { label: "Expired",  color: "#f59e0b", bg: "#451a03" };
            case 2: return { label: "Closed",   color: "#ef4444", bg: "#450a0a" };
            default: return { label: "Unknown", color: "#94a3b8", bg: "#1e293b" };
        }
    };

    const getProgressPercent = (donated, goal) => {
        const pct = (parseFloat(donated) / parseFloat(goal)) * 100;
        return Math.min(pct, 100).toFixed(1);
    };

    const getTimeLeft = (deadline) => {
        const now  = new Date();
        const diff = deadline - now;
        if (diff <= 0) return "Expired";
        const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}d ${hours}h left`;
        return `${hours}h left`;
    };

    // ─────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────

    if (loading) return (
        <div style={styles.centered}>
            <div style={styles.spinner}>⏳</div>
            <p style={styles.loadingText}>Loading campaigns from blockchain...</p>
        </div>
    );

    if (error) return (
        <div style={styles.centered}>
            <p style={styles.errorText}>⚠️ {error}</p>
            <button style={styles.retryBtn} onClick={fetchCampaigns}>Retry</button>
        </div>
    );

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>💚 All Campaigns</h1>
                <p style={styles.subtitle}>
                    Browse and donate to verified on-chain campaigns
                </p>
                <button style={styles.refreshBtn} onClick={fetchCampaigns}>
                    🔄 Refresh
                </button>
            </div>

            {/* Empty state */}
            {campaigns.length === 0 ? (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>📭</div>
                    <h2 style={styles.emptyTitle}>No campaigns yet</h2>
                    <p style={styles.emptyDesc}>
                        Be the first to launch a campaign!
                    </p>
                    <button
                        style={styles.primaryBtn}
                        onClick={() => navigate("/register")}
                    >
                        Start a Campaign
                    </button>
                </div>
            ) : (
                <>
                    {/* Stats bar */}
                    <div style={styles.statsBar}>
                        <div style={styles.stat}>
                            <span style={styles.statNum}>{campaigns.length}</span>
                            <span style={styles.statLabel}>Total Campaigns</span>
                        </div>
                        <div style={styles.statDivider} />
                        <div style={styles.stat}>
                            <span style={styles.statNum}>
                                {campaigns.filter(c => c.status === 0).length}
                            </span>
                            <span style={styles.statLabel}>Active</span>
                        </div>
                        <div style={styles.statDivider} />
                        <div style={styles.stat}>
                            <span style={styles.statNum}>
                                {campaigns.reduce((sum, c) => sum + c.donorCount, 0)}
                            </span>
                            <span style={styles.statLabel}>Total Donors</span>
                        </div>
                        <div style={styles.statDivider} />
                        <div style={styles.stat}>
                            <span style={styles.statNum}>
                                {campaigns.reduce((sum, c) => sum + parseFloat(c.totalDonated), 0).toFixed(3)} ETH
                            </span>
                            <span style={styles.statLabel}>Total Raised</span>
                        </div>
                    </div>

                    {/* Campaign Grid */}
                    <div style={styles.grid}>
                        {campaigns.map((campaign) => {
                            const statusInfo = getStatusLabel(campaign.status);
                            const progress   = getProgressPercent(campaign.totalDonated, campaign.goalAmount);
                            const timeLeft   = getTimeLeft(campaign.deadline);

                            return (
                                <div key={campaign.address} style={styles.card}>
                                    {getIPFSUrl(campaign.ipfsHash) && (
                                     <img
                                         src={getIPFSUrl(campaign.ipfsHash)}
                                         alt={campaign.title}
                                           style={{
                                             width: "calc(100% + 56px)",
                                            height: "180px",
                                            objectFit: "cover",
                                            borderRadius: "10px 10px 0 0",
                                            margin: "-28px -28px 0 -28px",
                                            display: "block",
                                        }}
                                    />
                                )}
                                    {/* Status badge */}
                                    <div style={{
                                        ...styles.badge,
                                        color: statusInfo.color,
                                        background: statusInfo.bg,
                                        border: `1px solid ${statusInfo.color}`,
                                    }}>
                                        {statusInfo.label}
                                    </div>

                                    {/* Title */}
                                    <h2 style={styles.cardTitle}>{campaign.title}</h2>

                                    {/* Description */}
                                    <p style={styles.cardDesc}>
                                        {campaign.description.length > 120
                                            ? campaign.description.slice(0, 120) + "..."
                                            : campaign.description}
                                    </p>

                                    {/* Progress bar */}
                                    <div style={styles.progressSection}>
                                        <div style={styles.progressBar}>
                                            <div style={{
                                                ...styles.progressFill,
                                                width: `${progress}%`,
                                                background: progress >= 100 ? "#22c55e" : "#3b82f6",
                                            }} />
                                        </div>
                                        <div style={styles.progressLabels}>
                                            <span style={styles.raised}>
                                                {campaign.totalDonated} ETH raised
                                            </span>
                                            <span style={styles.goal}>
                                                Goal: {campaign.goalAmount} ETH
                                            </span>
                                        </div>
                                        <div style={styles.progressPct}>
                                            {progress}% funded
                                        </div>
                                    </div>

                                    {/* Meta info */}
                                    <div style={styles.metaRow}>
                                        <div style={styles.metaItem}>
                                            <span style={styles.metaIcon}>👥</span>
                                            <span style={styles.metaText}>
                                                {campaign.donorCount} donors
                                            </span>
                                        </div>
                                        <div style={styles.metaItem}>
                                            <span style={styles.metaIcon}>⏰</span>
                                            <span style={styles.metaText}>{timeLeft}</span>
                                        </div>
                                    </div>

                                    {/* Campaigner address */}
                                    <div style={styles.campaignerRow}>
                                        <span style={styles.campaignerLabel}>By: </span>
                                        <span style={styles.campaignerAddr}>
                                            {campaign.campaigner.slice(0, 6)}...{campaign.campaigner.slice(-4)}
                                        </span>
                                    </div>

                                    {/* Donate button */}
                                    <button
                                        style={{
                                            ...styles.donateBtn,
                                            opacity: campaign.status !== 0 ? 0.5 : 1,
                                            cursor: campaign.status !== 0 ? "not-allowed" : "pointer",
                                        }}
                                        onClick={() => campaign.status === 0 && navigate(`/campaign/${campaign.address}`)}
                                        disabled={campaign.status !== 0}
                                    >
                                        {campaign.status === 0 ? "💚 Donate Now" : "Campaign Ended"}
                                    </button>

                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

const styles = {
    container: {
        minHeight: "100vh",
        background: "#0f172a",
        padding: "40px 20px",
        fontFamily: "sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
    },
    centered: {
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "16px",
        background: "#0f172a",
        fontFamily: "sans-serif",
    },
    header: {
        textAlign: "center",
        marginBottom: "40px",
    },
    title: {
        fontSize: "36px",
        fontWeight: "800",
        color: "#f1f5f9",
        margin: 0,
    },
    subtitle: {
        color: "#94a3b8",
        marginTop: "8px",
        fontSize: "16px",
    },
    refreshBtn: {
        marginTop: "16px",
        background: "transparent",
        color: "#94a3b8",
        border: "1px solid #334155",
        padding: "8px 20px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
    },
    statsBar: {
        display: "flex",
        gap: "40px",
        alignItems: "center",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "20px 40px",
        marginBottom: "40px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    stat: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
    },
    statNum: {
        fontSize: "24px",
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
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: "24px",
    },
    card: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        transition: "transform 0.2s",
        cursor: "default",
    },
    badge: {
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "700",
        width: "fit-content",
    },
    cardTitle: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    cardDesc: {
        color: "#94a3b8",
        fontSize: "14px",
        lineHeight: 1.6,
        margin: 0,
    },
    progressSection: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    progressBar: {
        background: "#0f172a",
        borderRadius: "100px",
        height: "8px",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: "100px",
        transition: "width 0.5s ease",
    },
    progressLabels: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "13px",
    },
    raised: {
        color: "#22c55e",
        fontWeight: "600",
    },
    goal: {
        color: "#64748b",
    },
    progressPct: {
        fontSize: "12px",
        color: "#64748b",
    },
    metaRow: {
        display: "flex",
        gap: "16px",
    },
    metaItem: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    metaIcon: {
        fontSize: "14px",
    },
    metaText: {
        color: "#94a3b8",
        fontSize: "13px",
    },
    campaignerRow: {
        fontSize: "13px",
        color: "#64748b",
    },
    campaignerLabel: {
        color: "#64748b",
    },
    campaignerAddr: {
        color: "#94a3b8",
        fontFamily: "monospace",
    },
    donateBtn: {
        background: "#22c55e",
        color: "#000",
        border: "none",
        padding: "12px",
        borderRadius: "10px",
        fontWeight: "bold",
        fontSize: "15px",
        marginTop: "auto",
    },
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "80px 20px",
    },
    emptyIcon: {
        fontSize: "64px",
    },
    emptyTitle: {
        color: "#f1f5f9",
        fontSize: "24px",
        margin: 0,
    },
    emptyDesc: {
        color: "#94a3b8",
        fontSize: "16px",
        margin: 0,
    },
    primaryBtn: {
        background: "#22c55e",
        color: "#000",
        border: "none",
        padding: "14px 28px",
        borderRadius: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        fontSize: "16px",
    },
    loadingText: {
        color: "#94a3b8",
        fontSize: "16px",
    },
    errorText: {
        color: "#ef4444",
        fontSize: "16px",
    },
    retryBtn: {
        background: "#1e293b",
        color: "#f1f5f9",
        border: "1px solid #334155",
        padding: "10px 24px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
    },
    spinner: {
        fontSize: "48px",
        animation: "spin 1s linear infinite",
    },
};

export default DonorDashboard;