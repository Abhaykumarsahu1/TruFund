import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

const CampaignerDashboard = () => {
    const navigate = useNavigate();
    const { account } = useWallet();
    const { getFactoryContractReadOnly, getCampaignContract, getCampaignContractReadOnly } = useContract();

    const [campaigns, setCampaigns]         = useState([]);
    const [selected, setSelected]           = useState(null); // selected campaign address
    const [campaignData, setCampaignData]   = useState(null);
    const [requests, setRequests]           = useState([]);
    const [loading, setLoading]             = useState(true);
    const [submitting, setSubmitting]       = useState(false);
    const [error, setError]                 = useState(null);
    const [success, setSuccess]             = useState(null);

    // withdrawal request form
    const [reqForm, setReqForm] = useState({
        description: "",
        amount: "",
    });

    // ─────────────────────────────────────────
    //  FETCH CAMPAIGNER'S CAMPAIGNS
    // ─────────────────────────────────────────

    useEffect(() => {
        if (account) fetchMyCampaigns();
    }, [account]);

    const fetchMyCampaigns = async () => {
        try {
            setLoading(true);
            const factory = getFactoryContractReadOnly();
            if (!factory) return;

            const addresses = await factory.getCampaignsByCampaigner(account);
            setCampaigns(addresses);

            if (addresses.length > 0) {
                setSelected(addresses[0]);
                await fetchCampaignData(addresses[0]);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load your campaigns");
        } finally {
            setLoading(false);
        }
    };

    const fetchCampaignData = async (address) => {
        try {
            const contract = getCampaignContractReadOnly(address);

            const [
                title,
                description,
                goalAmount,
                totalDonated,
                deadline,
                status,
                donorCount,
                totalRequests,
                balance,
            ] = await Promise.all([
                contract.title(),
                contract.description(),
                contract.goalAmount(),
                contract.totalDonated(),
                contract.deadline(),
                contract.status(),
                contract.getDonorCount(),
                contract.getTotalRequests(),
                contract.getContractBalance(),
            ]);

            // fetch all withdrawal requests
            const reqList = [];
            const total = Number(totalRequests);
            for (let i = 0; i < total; i++) {
                const req = await contract.requests(i);
                reqList.push({
                    id: i,
                    description: req.description,
                    amount: ethers.formatEther(req.amount),
                    approvalCount: Number(req.approvalCount),
                    rejectionCount: Number(req.rejectionCount),
                    status: Number(req.status), // 0=Pending, 1=Approved, 2=Rejected
                    executed: req.executed,
                });
            }

            setCampaignData({
                address,
                title,
                description,
                goalAmount:    ethers.formatEther(goalAmount),
                totalDonated:  ethers.formatEther(totalDonated),
                deadline:      new Date(Number(deadline) * 1000),
                status:        Number(status),
                donorCount:    Number(donorCount),
                totalRequests: total,
                balance:       ethers.formatEther(balance),
            });

            setRequests(reqList);

        } catch (err) {
            console.error(err);
            setError("Failed to load campaign data");
        }
    };

    // ─────────────────────────────────────────
    //  CREATE WITHDRAWAL REQUEST
    // ─────────────────────────────────────────

    const handleCreateRequest = async () => {
        if (!reqForm.description.trim()) {
            setError("Description is required"); return;
        }
        if (!reqForm.amount || parseFloat(reqForm.amount) <= 0) {
            setError("Amount must be greater than 0"); return;
        }
        if (parseFloat(reqForm.amount) > parseFloat(campaignData.balance)) {
            setError("Amount exceeds contract balance"); return;
        }

        try {
            setSubmitting(true);
            setError(null);
            setSuccess(null);

            const contract = getCampaignContract(selected);
            if (!contract) { setError("Contract not loaded"); return; }

            const tx = await contract.createWithdrawalRequest(
                reqForm.description,
                ethers.parseEther(reqForm.amount)
            );

            setSuccess("Transaction submitted! Waiting for confirmation...");
            await tx.wait();
            setSuccess("✅ Withdrawal request created successfully!");
            setReqForm({ description: "", amount: "" });

            // refresh
            await fetchCampaignData(selected);

        } catch (err) {
            console.error(err);
            if (err.code === 4001) {
                setError("Transaction rejected.");
            } else {
                setError(err.message || "Failed to create request");
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ─────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────

    const getStatusInfo = (status) => {
        switch (status) {
            case 0: return { label: "Active",   color: "#22c55e", bg: "#052e16" };
            case 1: return { label: "Expired",  color: "#f59e0b", bg: "#451a03" };
            case 2: return { label: "Closed",   color: "#ef4444", bg: "#450a0a" };
            default: return { label: "Unknown", color: "#94a3b8", bg: "#1e293b" };
        }
    };

    const getReqStatusInfo = (status) => {
        switch (status) {
            case 0: return { label: "Pending",  color: "#f59e0b", bg: "#451a03" };
            case 1: return { label: "Approved", color: "#22c55e", bg: "#052e16" };
            case 2: return { label: "Rejected", color: "#ef4444", bg: "#450a0a" };
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
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return `${days}d left`;
    };

    // ─────────────────────────────────────────
    //  LOADING / EMPTY
    // ─────────────────────────────────────────

    if (!account) return (
        <div style={styles.centered}>
            <p style={styles.msg}>Please connect your wallet to view your dashboard.</p>
        </div>
    );

    if (loading) return (
        <div style={styles.centered}>
            <p style={styles.msg}>⏳ Loading your campaigns...</p>
        </div>
    );

    if (campaigns.length === 0) return (
        <div style={styles.centered}>
            <div style={styles.emptyIcon}>📭</div>
            <h2 style={styles.emptyTitle}>No campaigns yet</h2>
            <p style={styles.emptyDesc}>You haven't launched any campaigns.</p>
            <button style={styles.primaryBtn} onClick={() => navigate("/register")}>
                🚀 Launch a Campaign
            </button>
        </div>
    );

    const statusInfo = campaignData ? getStatusInfo(campaignData.status) : null;
    const progress   = campaignData ? getProgress(campaignData.totalDonated, campaignData.goalAmount) : 0;

    // ─────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>🏛️ Campaigner Dashboard</h1>
                <p style={styles.subtitle}>Manage your campaigns and withdrawal requests</p>
            </div>

            {/* Campaign selector if multiple */}
            {campaigns.length > 1 && (
                <div style={styles.selectorRow}>
                    <label style={styles.selectorLabel}>Select Campaign:</label>
                    <select
                        style={styles.selector}
                        value={selected}
                        onChange={(e) => {
                            setSelected(e.target.value);
                            fetchCampaignData(e.target.value);
                        }}
                    >
                        {campaigns.map((addr, i) => (
                            <option key={addr} value={addr}>
                                Campaign {i + 1} — {addr.slice(0, 10)}...
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {campaignData && (
                <div style={styles.layout}>

                    {/* ── LEFT COLUMN ── */}
                    <div style={styles.leftCol}>

                        {/* Campaign Stats */}
                        <div style={styles.card}>
                            <div style={styles.cardHeader}>
                                <h2 style={styles.cardTitle}>{campaignData.title}</h2>
                                <div style={{
                                    ...styles.badge,
                                    color: statusInfo.color,
                                    background: statusInfo.bg,
                                    border: `1px solid ${statusInfo.color}`,
                                }}>
                                    {statusInfo.label}
                                </div>
                            </div>

                            {/* Progress */}
                            <div style={styles.progressBar}>
                                <div style={{
                                    ...styles.progressFill,
                                    width: `${progress}%`,
                                    background: progress >= 100 ? "#22c55e" : "#3b82f6",
                                }} />
                            </div>

                            {/* Stats grid */}
                            <div style={styles.statsGrid}>
                                <div style={styles.statBox}>
                                    <span style={styles.statVal}>{campaignData.totalDonated} ETH</span>
                                    <span style={styles.statLbl}>Raised</span>
                                </div>
                                <div style={styles.statBox}>
                                    <span style={styles.statVal}>{campaignData.goalAmount} ETH</span>
                                    <span style={styles.statLbl}>Goal</span>
                                </div>
                                <div style={styles.statBox}>
                                    <span style={styles.statVal}>{campaignData.balance} ETH</span>
                                    <span style={styles.statLbl}>Available</span>
                                </div>
                                <div style={styles.statBox}>
                                    <span style={styles.statVal}>{campaignData.donorCount}</span>
                                    <span style={styles.statLbl}>Donors</span>
                                </div>
                                <div style={styles.statBox}>
                                    <span style={styles.statVal}>{progress}%</span>
                                    <span style={styles.statLbl}>Funded</span>
                                </div>
                                <div style={styles.statBox}>
                                    <span style={styles.statVal}>{getTimeLeft(campaignData.deadline)}</span>
                                    <span style={styles.statLbl}>Remaining</span>
                                </div>
                            </div>

                            {/* Contract address */}
                            <div style={styles.contractRow}>
                                <span style={styles.contractLabel}>Contract:</span>
                                <span style={styles.contractAddr}>
                                    {campaignData.address.slice(0, 10)}...{campaignData.address.slice(-8)}
                                </span>
                                <a
                                    href={`https://sepolia.etherscan.io/address/${campaignData.address}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={styles.etherscanLink}
                                >
                                    ↗ Etherscan
                                </a>
                            </div>
                        </div>

                        {/* Withdrawal Requests List */}
                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>
                                📋 Withdrawal Requests ({requests.length})
                            </h3>

                            {requests.length === 0 ? (
                                <p style={styles.noReqs}>
                                    No withdrawal requests yet. Create one below.
                                </p>
                            ) : (
                                requests.map((req) => {
                                    const reqStatus = getReqStatusInfo(req.status);
                                    return (
                                        <div key={req.id} style={styles.reqCard}>
                                            <div style={styles.reqHeader}>
                                                <span style={styles.reqId}>#{req.id + 1}</span>
                                                <div style={{
                                                    ...styles.reqBadge,
                                                    color: reqStatus.color,
                                                    background: reqStatus.bg,
                                                    border: `1px solid ${reqStatus.color}`,
                                                }}>
                                                    {reqStatus.label}
                                                </div>
                                                {req.executed && (
                                                    <div style={styles.executedBadge}>
                                                        ✅ Executed
                                                    </div>
                                                )}
                                            </div>

                                            <p style={styles.reqDesc}>{req.description}</p>

                                            <div style={styles.reqMeta}>
                                                <span style={styles.reqAmount}>
                                                    💰 {req.amount} ETH
                                                </span>
                                                <span style={styles.reqVotes}>
                                                    ✅ {req.approvalCount} approved
                                                </span>
                                                <span style={styles.reqVotes}>
                                                    ❌ {req.rejectionCount} rejected
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>

                    {/* ── RIGHT COLUMN ── */}
                    <div style={styles.rightCol}>

                        {/* Create Withdrawal Request */}
                        <div style={styles.reqFormCard}>
                            <h3 style={styles.formTitle}>📤 New Withdrawal Request</h3>
                            <p style={styles.formNote}>
                                Request funds from the campaign contract.
                                Board members will vote to approve or reject.
                            </p>

                            {error && <div style={styles.errorBox}>⚠️ {error}</div>}
                            {success && <div style={styles.successBox}>{success}</div>}

                            <div style={styles.field}>
                                <label style={styles.label}>Description *</label>
                                <textarea
                                    style={styles.textarea}
                                    placeholder="What will these funds be used for?"
                                    value={reqForm.description}
                                    onChange={(e) => setReqForm({...reqForm, description: e.target.value})}
                                    rows={4}
                                />
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Amount (ETH) *</label>
                                <input
                                    style={styles.input}
                                    type="number"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.001"
                                    value={reqForm.amount}
                                    onChange={(e) => setReqForm({...reqForm, amount: e.target.value})}
                                />
                                <p style={styles.balanceNote}>
                                    Available: {campaignData.balance} ETH
                                </p>
                            </div>

                            <button
                                style={{
                                    ...styles.submitBtn,
                                    opacity: submitting ? 0.6 : 1,
                                    cursor: submitting ? "not-allowed" : "pointer",
                                }}
                                onClick={handleCreateRequest}
                                disabled={submitting}
                            >
                                {submitting ? "⏳ Submitting..." : "📤 Submit Request"}
                            </button>
                        </div>

                        {/* Info box */}
                        <div style={styles.infoCard}>
                            <h4 style={styles.infoTitle}>ℹ️ How withdrawals work</h4>
                            <div style={styles.infoSteps}>
                                <div style={styles.infoStep}>
                                    <span style={styles.stepNum}>1</span>
                                    <span style={styles.stepText}>You create a withdrawal request with description and amount</span>
                                </div>
                                <div style={styles.infoStep}>
                                    <span style={styles.stepNum}>2</span>
                                    <span style={styles.stepText}>Board members vote to approve or reject</span>
                                </div>
                                <div style={styles.infoStep}>
                                    <span style={styles.stepNum}>3</span>
                                    <span style={styles.stepText}>2/3 supermajority approval releases funds to you</span>
                                </div>
                                <div style={styles.infoStep}>
                                    <span style={styles.stepNum}>4</span>
                                    <span style={styles.stepText}>2/3 rejection permanently rejects the request</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
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
        marginBottom: "32px",
    },
    title: {
        fontSize: "32px",
        fontWeight: "800",
        color: "#f1f5f9",
        margin: 0,
    },
    subtitle: {
        color: "#94a3b8",
        marginTop: "8px",
        fontSize: "15px",
    },
    selectorRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "24px",
    },
    selectorLabel: {
        color: "#94a3b8",
        fontSize: "14px",
    },
    selector: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "8px 16px",
        color: "#f1f5f9",
        fontSize: "14px",
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
    cardHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
    },
    cardTitle: {
        fontSize: "22px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    badge: {
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "700",
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
        transition: "width 0.5s",
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "12px",
    },
    statBox: {
        background: "#0f172a",
        borderRadius: "10px",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
    },
    statVal: {
        fontSize: "16px",
        fontWeight: "700",
        color: "#22c55e",
    },
    statLbl: {
        fontSize: "11px",
        color: "#64748b",
    },
    contractRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
    },
    contractLabel: {
        color: "#64748b",
        fontSize: "13px",
    },
    contractAddr: {
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "13px",
    },
    etherscanLink: {
        color: "#3b82f6",
        fontSize: "13px",
        textDecoration: "none",
    },
    sectionTitle: {
        fontSize: "16px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    noReqs: {
        color: "#64748b",
        fontSize: "14px",
        textAlign: "center",
        padding: "20px 0",
    },
    reqCard: {
        background: "#0f172a",
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        border: "1px solid #1e293b",
    },
    reqHeader: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    reqId: {
        color: "#64748b",
        fontSize: "13px",
        fontWeight: "700",
    },
    reqBadge: {
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: "700",
    },
    executedBadge: {
        color: "#22c55e",
        fontSize: "12px",
    },
    reqDesc: {
        color: "#94a3b8",
        fontSize: "14px",
        margin: 0,
        lineHeight: 1.5,
    },
    reqMeta: {
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
    },
    reqAmount: {
        color: "#22c55e",
        fontSize: "13px",
        fontWeight: "700",
    },
    reqVotes: {
        color: "#94a3b8",
        fontSize: "13px",
    },
    reqFormCard: {
        background: "#1e293b",
        border: "2px solid #22c55e",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    formTitle: {
        fontSize: "18px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    formNote: {
        color: "#64748b",
        fontSize: "13px",
        margin: 0,
        lineHeight: 1.5,
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        color: "#94a3b8",
        fontSize: "14px",
        fontWeight: "600",
    },
    input: {
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "12px 16px",
        color: "#f1f5f9",
        fontSize: "15px",
        outline: "none",
    },
    textarea: {
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "12px 16px",
        color: "#f1f5f9",
        fontSize: "14px",
        outline: "none",
        resize: "vertical",
        fontFamily: "sans-serif",
    },
    balanceNote: {
        color: "#64748b",
        fontSize: "12px",
        margin: 0,
    },
    submitBtn: {
        background: "#22c55e",
        color: "#000",
        border: "none",
        padding: "14px",
        borderRadius: "10px",
        fontWeight: "bold",
        fontSize: "15px",
    },
    infoCard: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    infoTitle: {
        fontSize: "15px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    infoSteps: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    infoStep: {
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
    },
    stepNum: {
        background: "#22c55e",
        color: "#000",
        borderRadius: "50%",
        width: "24px",
        height: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontWeight: "800",
        flexShrink: 0,
    },
    stepText: {
        color: "#94a3b8",
        fontSize: "13px",
        lineHeight: 1.5,
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
    msg: {
        color: "#94a3b8",
        fontSize: "16px",
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
        fontSize: "15px",
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
};

export default CampaignerDashboard;