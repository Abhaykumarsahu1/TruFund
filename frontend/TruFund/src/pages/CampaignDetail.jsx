import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

const CampaignDetail = () => {
    const { address } = useParams();
    const navigate    = useNavigate();
    const { account } = useWallet();
    const { getCampaignContract, getCampaignContractReadOnly } = useContract();

    const [campaign, setCampaign]     = useState(null);
    const [loading, setLoading]       = useState(true);
    const [donating, setDonating]     = useState(false);
    const [error, setError]           = useState(null);
    const [success, setSuccess]       = useState(null);
    const [donationAmt, setDonationAmt] = useState("");
    const [donors, setDonors]         = useState([]);

    // ─────────────────────────────────────────
    //  FETCH CAMPAIGN DETAILS
    // ─────────────────────────────────────────

    useEffect(() => {
        if (address) fetchCampaign();
    }, [address]);

    const fetchCampaign = async () => {
        try {
            setLoading(true);
            setError(null);

            const contract = getCampaignContractReadOnly(address);
            if (!contract) { setError("Contract not loaded"); return; }

            const [
                title,
                description,
                goalAmount,
                totalDonated,
                deadline,
                status,
                campaigner,
                donorCount,
                boardMembers,
                totalRequests,
            ] = await Promise.all([
                contract.title(),
                contract.description(),
                contract.goalAmount(),
                contract.totalDonated(),
                contract.deadline(),
                contract.status(),
                contract.campaigner(),
                contract.getDonorCount(),
                contract.getBoardMembers(),
                contract.getTotalRequests(),
            ]);

            // fetch donor list
            const donorList = [];
            const count = Number(donorCount);
            for (let i = 0; i < Math.min(count, 10); i++) {
                const donorAddr = await contract.donorList(i);
                const amount    = await contract.donations(donorAddr);
                donorList.push({
                    address: donorAddr,
                    amount: ethers.formatEther(amount),
                });
            }

            setCampaign({
                address,
                title,
                description,
                goalAmount:    ethers.formatEther(goalAmount),
                totalDonated:  ethers.formatEther(totalDonated),
                deadline:      new Date(Number(deadline) * 1000),
                status:        Number(status),
                campaigner,
                donorCount:    Number(donorCount),
                boardMembers,
                totalRequests: Number(totalRequests),
            });

            setDonors(donorList);

        } catch (err) {
            console.error(err);
            setError("Failed to load campaign details");
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────
    //  DONATE
    // ─────────────────────────────────────────

    const handleDonate = async () => {
        if (!account) { setError("Please connect your wallet"); return; }
        if (!donationAmt || parseFloat(donationAmt) < 0.01) {
            setError("Minimum donation is 0.01 ETH");
            return;
        }

        try {
            setDonating(true);
            setError(null);
            setSuccess(null);

            const contract = getCampaignContract(address);
            if (!contract) { setError("Contract not loaded"); return; }

            const tx = await contract.donate({
                value: ethers.parseEther(donationAmt),
            });

            setSuccess("Transaction submitted! Waiting for confirmation...");
            await tx.wait();
            setSuccess(`✅ Donation of ${donationAmt} ETH confirmed!`);
            setDonationAmt("");

            // refresh campaign data
            await fetchCampaign();

        } catch (err) {
            console.error(err);
            if (err.code === 4001) {
                setError("Transaction rejected.");
            } else {
                setError(err.message || "Donation failed");
            }
        } finally {
            setDonating(false);
        }
    };

    // ─────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────

    const getStatusInfo = (status) => {
        switch (status) {
            case 0: return { label: "Active",  color: "#22c55e", bg: "#052e16" };
            case 1: return { label: "Expired", color: "#f59e0b", bg: "#451a03" };
            case 2: return { label: "Closed",  color: "#ef4444", bg: "#450a0a" };
            default: return { label: "Unknown", color: "#94a3b8", bg: "#1e293b" };
        }
    };

    const getProgress = (donated, goal) => {
        const pct = (parseFloat(donated) / parseFloat(goal)) * 100;
        return Math.min(pct, 100).toFixed(1);
    };

    const getTimeLeft = (deadline) => {
        const diff = deadline - new Date();
        if (diff <= 0) return "Expired";
        const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
    };

    // ─────────────────────────────────────────
    //  LOADING / ERROR
    // ─────────────────────────────────────────

    if (loading) return (
        <div style={styles.centered}>
            <p style={styles.loadingText}>⏳ Loading campaign from blockchain...</p>
        </div>
    );

    if (error && !campaign) return (
        <div style={styles.centered}>
            <p style={styles.errorText}>⚠️ {error}</p>
            <button style={styles.backBtn} onClick={() => navigate("/donate")}>
                ← Back to Campaigns
            </button>
        </div>
    );

    if (!campaign) return null;

    const statusInfo = getStatusInfo(campaign.status);
    const progress   = getProgress(campaign.totalDonated, campaign.goalAmount);
    const timeLeft   = getTimeLeft(campaign.deadline);
    const isActive   = campaign.status === 0;

    // ─────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────

    return (
        <div style={styles.container}>

            {/* Back button */}
            <button style={styles.backBtn} onClick={() => navigate("/donate")}>
                ← Back to Campaigns
            </button>

            <div style={styles.layout}>

                {/* ── LEFT COLUMN ── */}
                <div style={styles.leftCol}>

                    {/* Header */}
                    <div style={styles.card}>
                        <div style={{
                            ...styles.badge,
                            color: statusInfo.color,
                            background: statusInfo.bg,
                            border: `1px solid ${statusInfo.color}`,
                        }}>
                            {statusInfo.label}
                        </div>

                        <h1 style={styles.title}>{campaign.title}</h1>
                        <p style={styles.description}>{campaign.description}</p>

                        {/* Progress */}
                        <div style={styles.progressSection}>
                            <div style={styles.progressBar}>
                                <div style={{
                                    ...styles.progressFill,
                                    width: `${progress}%`,
                                    background: progress >= 100 ? "#22c55e" : "#3b82f6",
                                }} />
                            </div>
                            <div style={styles.progressStats}>
                                <div style={styles.progressStat}>
                                    <span style={styles.bigNum}>{campaign.totalDonated} ETH</span>
                                    <span style={styles.smallLabel}>raised</span>
                                </div>
                                <div style={styles.progressStat}>
                                    <span style={styles.bigNum}>{progress}%</span>
                                    <span style={styles.smallLabel}>funded</span>
                                </div>
                                <div style={styles.progressStat}>
                                    <span style={styles.bigNum}>{campaign.goalAmount} ETH</span>
                                    <span style={styles.smallLabel}>goal</span>
                                </div>
                            </div>
                        </div>

                        {/* Meta */}
                        <div style={styles.metaGrid}>
                            <div style={styles.metaItem}>
                                <span style={styles.metaIcon}>👥</span>
                                <div>
                                    <div style={styles.metaValue}>{campaign.donorCount}</div>
                                    <div style={styles.metaLabel}>Donors</div>
                                </div>
                            </div>
                            <div style={styles.metaItem}>
                                <span style={styles.metaIcon}>⏰</span>
                                <div>
                                    <div style={styles.metaValue}>{timeLeft}</div>
                                    <div style={styles.metaLabel}>Deadline</div>
                                </div>
                            </div>
                            <div style={styles.metaItem}>
                                <span style={styles.metaIcon}>📋</span>
                                <div>
                                    <div style={styles.metaValue}>{campaign.totalRequests}</div>
                                    <div style={styles.metaLabel}>Requests</div>
                                </div>
                            </div>
                            <div style={styles.metaItem}>
                                <span style={styles.metaIcon}>🏛️</span>
                                <div>
                                    <div style={styles.metaValue}>{campaign.boardMembers.length}</div>
                                    <div style={styles.metaLabel}>Board Members</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Campaigner info */}
                    <div style={styles.card}>
                        <h3 style={styles.sectionTitle}>👤 Campaigner</h3>
                        <div style={styles.addressBox}>
                            <span style={styles.addressText}>{campaign.campaigner}</span>
                            <a
                                href={`https://sepolia.etherscan.io/address/${campaign.campaigner}`}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.etherscanLink}
                            >
                                View on Etherscan ↗
                            </a>
                        </div>
                    </div>

                    {/* Board Members */}
                    <div style={styles.card}>
                        <h3 style={styles.sectionTitle}>🏛️ Board Members</h3>
                        <p style={styles.boardNote}>
                            These addresses must approve withdrawal requests (2/3 supermajority)
                        </p>
                        {campaign.boardMembers.map((member, i) => (
                            <div key={i} style={styles.memberRow}>
                                <span style={styles.memberNum}>{i + 1}</span>
                                <span style={styles.memberAddr}>
                                    {member.slice(0, 10)}...{member.slice(-8)}
                                </span>
                                <a
                                    href={`https://sepolia.etherscan.io/address/${member}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={styles.miniLink}
                                >
                                    ↗
                                </a>
                            </div>
                        ))}
                    </div>

                </div>

                {/* ── RIGHT COLUMN ── */}
                <div style={styles.rightCol}>

                    {/* Donate Card */}
                    <div style={styles.donateCard}>
                        <h3 style={styles.donateTitle}>💚 Make a Donation</h3>

                        {!isActive && (
                            <div style={styles.expiredNote}>
                                ⚠️ This campaign is no longer accepting donations
                            </div>
                        )}

                        {error && <div style={styles.errorBox}>⚠️ {error}</div>}
                        {success && <div style={styles.successBox}>{success}</div>}

                        <div style={styles.inputGroup}>
                            <label style={styles.inputLabel}>Amount (ETH)</label>
                            <div style={styles.inputWrapper}>
                                <input
                                    style={{
                                        ...styles.amtInput,
                                        opacity: !isActive ? 0.5 : 1,
                                    }}
                                    type="number"
                                    placeholder="0.01"
                                    min="0.01"
                                    step="0.01"
                                    value={donationAmt}
                                    onChange={(e) => setDonationAmt(e.target.value)}
                                    disabled={!isActive}
                                />
                                <span style={styles.ethLabel}>ETH</span>
                            </div>
                            <p style={styles.minNote}>Minimum: 0.01 ETH</p>
                        </div>

                        {/* Quick amounts */}
                        <div style={styles.quickAmts}>
                            {["0.01", "0.05", "0.1", "0.5"].map(amt => (
                                <button
                                    key={amt}
                                    style={styles.quickBtn}
                                    onClick={() => setDonationAmt(amt)}
                                    disabled={!isActive}
                                >
                                    {amt} ETH
                                </button>
                            ))}
                        </div>

                        <button
                            style={{
                                ...styles.donateBtn,
                                opacity: (!isActive || donating) ? 0.6 : 1,
                                cursor: (!isActive || donating) ? "not-allowed" : "pointer",
                            }}
                            onClick={handleDonate}
                            disabled={!isActive || donating}
                        >
                            {donating ? "⏳ Processing..." : "💚 Donate Now"}
                        </button>

                        <p style={styles.secureNote}>
                            🔒 Funds go directly to the smart contract.
                            Withdrawals require board approval.
                        </p>
                    </div>  

                    {/* Contract info */}
                    <div style={styles.card}>
                        <h3 style={styles.sectionTitle}>📄 Contract</h3>
                        <div style={styles.addressBox}>
                            <span style={styles.addressText}>
                                {address.slice(0, 10)}...{address.slice(-8)}
                            </span>
                            <a
                                href={`https://sepolia.etherscan.io/address/${address}`}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.etherscanLink}
                            >
                                View on Etherscan ↗
                            </a>
                        </div>
                    </div>

                    {/* Board Member Access */}
                    {campaign.boardMembers.some(
                        m => m.toLowerCase() === account?.toLowerCase()
                            ) && (
                            <div style={styles.boardAccessCard}>
                                 <h3 style={styles.boardAccessTitle}>🏛️ You're a Board Member!</h3>
                                 <p style={styles.boardAccessDesc}>
                                 You have voting rights on withdrawal requests for this campaign.
                                </p>
                                 <button
                                 style={styles.boardAccessBtn}
                                    onClick={() => navigate(`/board/${address}`)}
                                 >
                                     Go to Board Dashboard →
                        </button>
                    </div>
)}

                    {/* Donors list */}
                    {donors.length > 0 && (
                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>💚 Recent Donors</h3>
                            {donors.map((donor, i) => (
                                <div key={i} style={styles.donorRow}>
                                    <span style={styles.donorAddr}>
                                        {donor.address.slice(0, 8)}...{donor.address.slice(-6)}
                                    </span>
                                    <span style={styles.donorAmt}>
                                        {donor.amount} ETH
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        minHeight: "100vh",
        background: "#0f172a",
        padding: "30px 20px",
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
    backBtn: {
        background: "transparent",
        color: "#94a3b8",
        border: "1px solid #334155",
        padding: "8px 16px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        marginBottom: "24px",
    },
    layout: {
        display: "flex",
        gap: "24px",
        alignItems: "flex-start",
        flexWrap: "wrap",
    },
    leftCol: {
        flex: 2,
        minWidth: "320px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
    },
    rightCol: {
        flex: 1,
        minWidth: "280px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        position: "sticky",
        top: "100px",
    },
    card: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    donateCard: {
        background: "#1e293b",
        border: "2px solid #22c55e",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    badge: {
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "700",
        width: "fit-content",
    },
    title: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#f1f5f9",
        margin: 0,
    },
    description: {
        color: "#94a3b8",
        lineHeight: 1.7,
        fontSize: "15px",
        margin: 0,
    },
    progressSection: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    progressBar: {
        background: "#0f172a",
        borderRadius: "100px",
        height: "10px",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: "100px",
        transition: "width 0.5s ease",
    },
    progressStats: {
        display: "flex",
        justifyContent: "space-between",
    },
    progressStat: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
    },
    bigNum: {
        fontSize: "18px",
        fontWeight: "700",
        color: "#22c55e",
    },
    smallLabel: {
        fontSize: "12px",
        color: "#64748b",
    },
    metaGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
    },
    metaItem: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "#0f172a",
        padding: "12px",
        borderRadius: "10px",
    },
    metaIcon: {
        fontSize: "24px",
    },
    metaValue: {
        fontSize: "16px",
        fontWeight: "700",
        color: "#f1f5f9",
    },
    metaLabel: {
        fontSize: "12px",
        color: "#64748b",
    },
    sectionTitle: {
        fontSize: "16px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    boardNote: {
        fontSize: "13px",
        color: "#64748b",
        margin: 0,
    },
    memberRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 0",
        borderBottom: "1px solid #1e293b",
    },
    memberNum: {
        color: "#64748b",
        fontSize: "13px",
        width: "20px",
    },
    memberAddr: {
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "13px",
        flex: 1,
    },
    miniLink: {
        color: "#3b82f6",
        fontSize: "13px",
        textDecoration: "none",
    },
    addressBox: {
        background: "#0f172a",
        borderRadius: "8px",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    addressText: {
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "13px",
        wordBreak: "break-all",
    },
    etherscanLink: {
        color: "#3b82f6",
        fontSize: "13px",
        textDecoration: "none",
    },
    donateTitle: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    expiredNote: {
        background: "#451a03",
        border: "1px solid #f59e0b",
        color: "#fcd34d",
        padding: "10px 14px",
        borderRadius: "8px",
        fontSize: "13px",
    },
    errorBox: {
        background: "#450a0a",
        border: "1px solid #ef4444",
        color: "#fca5a5",
        padding: "10px 14px",
        borderRadius: "8px",
        fontSize: "13px",
    },
    successBox: {
        background: "#052e16",
        border: "1px solid #22c55e",
        color: "#86efac",
        padding: "10px 14px",
        borderRadius: "8px",
        fontSize: "13px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    inputLabel: {
        color: "#94a3b8",
        fontSize: "14px",
        fontWeight: "600",
    },
    inputWrapper: {
        position: "relative",
        display: "flex",
        alignItems: "center",
    },
    amtInput: {
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "12px 50px 12px 16px",
        color: "#f1f5f9",
        fontSize: "18px",
        fontWeight: "700",
        outline: "none",
        width: "100%",
    },
    ethLabel: {
        position: "absolute",
        right: "16px",
        color: "#64748b",
        fontSize: "14px",
        fontWeight: "600",
    },
    minNote: {
        color: "#64748b",
        fontSize: "12px",
        margin: 0,
    },
    quickAmts: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
    },
    quickBtn: {
        background: "#0f172a",
        color: "#94a3b8",
        border: "1px solid #334155",
        padding: "8px 12px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "600",
    },
    donateBtn: {
        background: "#22c55e",
        color: "#000",
        border: "none",
        padding: "14px",
        borderRadius: "10px",
        fontWeight: "bold",
        fontSize: "16px",
    },
    secureNote: {
        color: "#64748b",
        fontSize: "12px",
        textAlign: "center",
        margin: 0,
        lineHeight: 1.5,
    },
    donorRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #0f172a",
    },
    donorAddr: {
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "13px",
    },
    donorAmt: {
        color: "#22c55e",
        fontWeight: "700",
        fontSize: "13px",
    },
    loadingText: {
        color: "#94a3b8",
        fontSize: "16px",
    },
    errorText: {
        color: "#ef4444",
        fontSize: "16px",
    },
    boardAccessCard: {
    background: "#052e16",
    border: "2px solid #22c55e",
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
},
boardAccessTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#22c55e",
    margin: 0,
},
boardAccessDesc: {
    color: "#86efac",
    fontSize: "13px",
    margin: 0,
    lineHeight: 1.5,
},
boardAccessBtn: {
    background: "#22c55e",
    color: "#000",
    border: "none",
    padding: "12px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "14px",
},
};

export default CampaignDetail;