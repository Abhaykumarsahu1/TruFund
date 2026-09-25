import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

const BoardHome = () => {
    const navigate = useNavigate();
    const { account } = useWallet();
    const { getFactoryContractReadOnly, getCampaignContractReadOnly } = useContract();

    const [boardCampaigns, setBoardCampaigns] = useState([]);
    const [loading, setLoading]               = useState(true);
    const [error, setError]                   = useState(null);

    useEffect(() => {
        if (account) fetchBoardCampaigns();
    }, [account]);

    const fetchBoardCampaigns = async () => {
        try {
            setLoading(true);
            setError(null);

            const factory = getFactoryContractReadOnly();
            if (!factory) return;

            const allAddresses = await factory.getAllCampaigns();

            const results = await Promise.all(
                allAddresses.map(async (address) => {
                    try {
                        const contract = getCampaignContractReadOnly(address);

                        const [
                            title,
                            goalAmount,
                            totalDonated,
                            status,
                            boardMembers,
                            totalRequests,
                            balance,
                            campaigner,
                        ] = await Promise.all([
                            contract.title(),
                            contract.goalAmount(),
                            contract.totalDonated(),
                            contract.status(),
                            contract.getBoardMembers(),
                            contract.getTotalRequests(),
                            contract.getContractBalance(),
                            contract.campaigner(),
                        ]);

                        // only include if connected wallet is a board member
                        const isMember = boardMembers.some(
                            m => m.toLowerCase() === account.toLowerCase()
                        );
                        if (!isMember) return null;

                        // count pending requests
                        let pendingCount = 0;
                        const total = Number(totalRequests);
                        for (let i = 0; i < total; i++) {
                            const req = await contract.requests(i);
                            if (Number(req.status) === 0) pendingCount++;
                        }

                        return {
                            address,
                            title,
                            goalAmount:    ethers.formatEther(goalAmount),
                            totalDonated:  ethers.formatEther(totalDonated),
                            status:        Number(status),
                            boardMembers,
                            totalRequests: total,
                            pendingCount,
                            balance:       ethers.formatEther(balance),
                            campaigner,
                        };
                    } catch (err) {
                        console.error("Error:", address, err);
                        return null;
                    }
                })
            );

            setBoardCampaigns(results.filter(Boolean));

        } catch (err) {
            console.error(err);
            setError("Failed to load board campaigns");
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = (status) => {
        switch (status) {
            case 0: return { label: "Active",  color: "#22c55e", bg: "#052e16" };
            case 1: return { label: "Expired", color: "#f59e0b", bg: "#451a03" };
            case 2: return { label: "Closed",  color: "#ef4444", bg: "#450a0a" };
            default: return { label: "Unknown", color: "#94a3b8", bg: "#1e293b" };
        }
    };

    if (!account) return (
        <div style={styles.centered}>
            <p style={styles.msg}>Please connect your wallet.</p>
        </div>
    );

    if (loading) return (
        <div style={styles.centered}>
            <p style={styles.msg}>⏳ Scanning campaigns for your board memberships...</p>
        </div>
    );

    if (error) return (
        <div style={styles.centered}>
            <p style={styles.errorText}>⚠️ {error}</p>
        </div>
    );

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>🗳️ Board Member Portal</h1>
                <p style={styles.subtitle}>
                    Campaigns where you are a trusted board member
                </p>
                <p style={styles.wallet}>
                    {account.slice(0, 10)}...{account.slice(-8)}
                </p>
            </div>

            {/* Empty state */}
            {boardCampaigns.length === 0 ? (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>🔍</div>
                    <h2 style={styles.emptyTitle}>No board memberships found</h2>
                    <p style={styles.emptyDesc}>
                        Your wallet is not a board member in any campaign.
                    </p>
                    <button style={styles.browseBtn} onClick={() => navigate("/donate")}>
                        Browse Campaigns
                    </button>
                </div>
            ) : (
                <>
                    {/* Summary bar */}
                    <div style={styles.summaryRow}>
                        <div style={styles.summaryBox}>
                            <span style={styles.summaryNum}>{boardCampaigns.length}</span>
                            <span style={styles.summaryLbl}>Campaigns</span>
                        </div>
                        <div style={styles.summaryBox}>
                            <span style={{
                                ...styles.summaryNum,
                                color: boardCampaigns.reduce((s, c) => s + c.pendingCount, 0) > 0
                                    ? "#ef4444" : "#22c55e"
                            }}>
                                {boardCampaigns.reduce((s, c) => s + c.pendingCount, 0)}
                            </span>
                            <span style={styles.summaryLbl}>Pending Votes</span>
                        </div>
                        <div style={styles.summaryBox}>
                            <span style={styles.summaryNum}>
                                {boardCampaigns.filter(c => c.status === 0).length}
                            </span>
                            <span style={styles.summaryLbl}>Active</span>
                        </div>
                    </div>

                    {/* Campaign list */}
                    <div style={styles.list}>
                        {boardCampaigns.map((camp) => {
                            const si = getStatusInfo(camp.status);
                            return (
                                <div key={camp.address} style={styles.card}>
                                    <div style={styles.cardTop}>
                                        <div style={styles.cardLeft}>
                                            <h2 style={styles.cardTitle}>{camp.title}</h2>
                                            <p style={styles.cardAddr}>
                                                {camp.address.slice(0, 12)}...{camp.address.slice(-8)}
                                            </p>
                                        </div>
                                        <div style={styles.cardRight}>
                                            {/* Status badge */}
                                            <div style={{
                                                ...styles.badge,
                                                color: si.color,
                                                background: si.bg,
                                                border: `1px solid ${si.color}`,
                                            }}>
                                                {si.label}
                                            </div>
                                            {/* Pending votes badge */}
                                            {camp.pendingCount > 0 && (
                                                <div style={styles.pendingBadge}>
                                                    🔴 {camp.pendingCount} pending
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div style={styles.statsRow}>
                                        <div style={styles.statBox}>
                                            <span style={styles.statVal}>{camp.totalDonated} ETH</span>
                                            <span style={styles.statLbl}>Raised</span>
                                        </div>
                                        <div style={styles.statBox}>
                                            <span style={styles.statVal}>{camp.balance} ETH</span>
                                            <span style={styles.statLbl}>Available</span>
                                        </div>
                                        <div style={styles.statBox}>
                                            <span style={styles.statVal}>{camp.boardMembers.length}</span>
                                            <span style={styles.statLbl}>Board Size</span>
                                        </div>
                                        <div style={styles.statBox}>
                                            <span style={styles.statVal}>{camp.totalRequests}</span>
                                            <span style={styles.statLbl}>Requests</span>
                                        </div>
                                    </div>

                                    {/* Board members addresses */}
                                    <div style={styles.membersSection}>
                                        <p style={styles.membersTitle}>👥 Board Members</p>
                                        <div style={styles.membersList}>
                                            {camp.boardMembers.map((member, i) => (
                                                <div key={i} style={{
                                                    ...styles.memberRow,
                                                    background: member.toLowerCase() === account.toLowerCase()
                                                        ? "#052e16" : "#0f172a",
                                                    border: member.toLowerCase() === account.toLowerCase()
                                                        ? "1px solid #22c55e" : "1px solid #1e293b",
                                                }}>
                                                    <span style={styles.memberNum}>{i + 1}</span>
                                                    <span style={styles.memberAddr}>
                                                        {member.slice(0, 10)}...{member.slice(-8)}
                                                    </span>
                                                    {member.toLowerCase() === account.toLowerCase() && (
                                                        <span style={styles.youTag}>YOU</span>
                                                    )}
                                                    <a
                                                        href={`https://sepolia.etherscan.io/address/${member}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={styles.miniLink}
                                                    >↗</a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Vote button */}
                                    <button
                                        style={{
                                            ...styles.voteBtn,
                                            background: camp.pendingCount > 0 ? "#ef4444" : "#f59e0b",
                                        }}
                                        onClick={() => navigate(`/board/${camp.address}`)}
                                    >
                                        {camp.pendingCount > 0
                                            ? `🔴 Vote Now — ${camp.pendingCount} pending request${camp.pendingCount > 1 ? "s" : ""}`
                                            : "🗳️ View Board Dashboard"
                                        }
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
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
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
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    title: {
        fontSize: "32px",
        fontWeight: "800",
        color: "#f1f5f9",
        margin: 0,
    },
    subtitle: {
        color: "#94a3b8",
        fontSize: "15px",
        margin: 0,
    },
    wallet: {
        color: "#64748b",
        fontFamily: "monospace",
        fontSize: "13px",
        margin: 0,
    },
    summaryRow: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "16px",
    },
    summaryBox: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
    },
    summaryNum: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#f59e0b",
    },
    summaryLbl: {
        fontSize: "13px",
        color: "#64748b",
    },
    list: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
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
    cardTop: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "12px",
    },
    cardLeft: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
    cardRight: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "8px",
    },
    cardTitle: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    cardAddr: {
        color: "#64748b",
        fontFamily: "monospace",
        fontSize: "12px",
        margin: 0,
    },
    badge: {
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "700",
    },
    pendingBadge: {
        background: "#450a0a",
        border: "1px solid #ef4444",
        color: "#fca5a5",
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "700",
    },
    statsRow: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
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
        fontSize: "15px",
        fontWeight: "700",
        color: "#f59e0b",
    },
    statLbl: {
        fontSize: "11px",
        color: "#64748b",
    },
    membersSection: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    membersTitle: {
        color: "#94a3b8",
        fontSize: "13px",
        fontWeight: "600",
        margin: 0,
    },
    membersList: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    memberRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "8px",
    },
    memberNum: {
        color: "#64748b",
        fontSize: "12px",
        fontWeight: "700",
        width: "16px",
    },
    memberAddr: {
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "12px",
        flex: 1,
    },
    youTag: {
        background: "#22c55e",
        color: "#000",
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: "800",
    },
    miniLink: {
        color: "#3b82f6",
        fontSize: "12px",
        textDecoration: "none",
    },
    voteBtn: {
        color: "#000",
        border: "none",
        padding: "14px",
        borderRadius: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        fontSize: "15px",
    },
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "60px 20px",
        textAlign: "center",
    },
    emptyIcon: { fontSize: "64px" },
    emptyTitle: { color: "#f1f5f9", fontSize: "24px", margin: 0 },
    emptyDesc: { color: "#94a3b8", fontSize: "15px", margin: 0 },
    browseBtn: {
        background: "#f59e0b",
        color: "#000",
        border: "none",
        padding: "12px 24px",
        borderRadius: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        fontSize: "14px",
    },
    msg: { color: "#94a3b8", fontSize: "16px" },
    errorText: { color: "#ef4444", fontSize: "16px" },
};

export default BoardHome;