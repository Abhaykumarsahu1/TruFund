import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

const BoardDashboard = () => {
    const { address } = useParams();
    const { account } = useWallet();
    const { getCampaignContract, getCampaignContractReadOnly } = useContract();

    const [campaign, setCampaign]   = useState(null);
    const [requests, setRequests]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [voting, setVoting]       = useState(null); // requestId being voted on
    const [error, setError]         = useState(null);
    const [success, setSuccess]     = useState(null);
    const [isMember, setIsMember]   = useState(false);

    // ─────────────────────────────────────────
    //  FETCH DATA
    // ─────────────────────────────────────────

    useEffect(() => {
        if (address && account) fetchData();
    }, [address, account]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const contract = getCampaignContractReadOnly(address);
            if (!contract) return;

            const [
                title,
                goalAmount,
                totalDonated,
                deadline,
                status,
                boardMembers,
                totalRequests,
                balance,
            ] = await Promise.all([
                contract.title(),
                contract.goalAmount(),
                contract.totalDonated(),
                contract.deadline(),
                contract.status(),
                contract.getBoardMembers(),
                contract.getTotalRequests(),
                contract.getContractBalance(),
            ]);

            // check if connected wallet is a board member
            const memberStatus = await contract.isBoardMember(account);
            setIsMember(memberStatus);

            // fetch all requests
            const reqList = [];
            const total = Number(totalRequests);
            for (let i = 0; i < total; i++) {
                const req = await contract.requests(i);
                // check if this member already voted
                const hasVoted = await contract.requests(i);
                reqList.push({
                    id: i,
                    description: req.description,
                    amount: ethers.formatEther(req.amount),
                    approvalCount: Number(req.approvalCount),
                    rejectionCount: Number(req.rejectionCount),
                    status: Number(req.status),
                    executed: req.executed,
                });
            }

            setCampaign({
                title,
                goalAmount:   ethers.formatEther(goalAmount),
                totalDonated: ethers.formatEther(totalDonated),
                deadline:     new Date(Number(deadline) * 1000),
                status:       Number(status),
                boardMembers,
                totalRequests: total,
                balance:      ethers.formatEther(balance),
                boardSize:    boardMembers.length,
            });

            setRequests(reqList);

        } catch (err) {
            console.error(err);
            setError("Failed to load board dashboard");
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────
    //  VOTE
    // ─────────────────────────────────────────

    const handleVote = async (requestId, approve) => {
        if (!isMember) { setError("You are not a board member"); return; }

        try {
            setVoting(requestId);
            setError(null);
            setSuccess(null);

            const contract = getCampaignContract(address);
            if (!contract) { setError("Contract not loaded"); return; }

            const tx = await contract.voteOnRequest(requestId, approve);
            setSuccess(`Vote submitted! Waiting for confirmation...`);
            await tx.wait();

            setSuccess(`✅ Successfully voted ${approve ? "APPROVED ✅" : "REJECTED ❌"} on request #${requestId + 1}`);

            // refresh data
            await fetchData();

        } catch (err) {
            console.error(err);
            if (err.code === 4001) {
                setError("Transaction rejected.");
            } else if (err.message?.includes("Already voted")) {
                setError("You have already voted on this request.");
            } else if (err.message?.includes("Request already finalised")) {
                setError("This request has already been finalised.");
            } else {
                setError(err.message || "Vote failed");
            }
        } finally {
            setVoting(null);
        }
    };

    // ─────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────

    const getThreshold = (boardSize) => Math.ceil((2 * boardSize) / 3);

    const getReqStatusInfo = (status) => {
        switch (status) {
            case 0: return { label: "Pending",  color: "#f59e0b", bg: "#451a03" };
            case 1: return { label: "Approved", color: "#22c55e", bg: "#052e16" };
            case 2: return { label: "Rejected", color: "#ef4444", bg: "#450a0a" };
            default: return { label: "Unknown", color: "#94a3b8", bg: "#1e293b" };
        }
    };

    const getVoteProgress = (count, boardSize) => {
        return Math.min((count / boardSize) * 100, 100).toFixed(0);
    };

    // ─────────────────────────────────────────
    //  LOADING / ERROR
    // ─────────────────────────────────────────

    if (!account) return (
        <div style={styles.centered}>
            <p style={styles.msg}>Please connect your wallet to access the board dashboard.</p>
        </div>
    );

    if (loading) return (
        <div style={styles.centered}>
            <p style={styles.msg}>⏳ Loading board dashboard...</p>
        </div>
    );

    if (error && !campaign) return (
        <div style={styles.centered}>
            <p style={styles.errorText}>⚠️ {error}</p>
        </div>
    );

    if (!campaign) return null;

    const threshold = getThreshold(campaign.boardSize);

    // ─────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>🏛️ Board Member Dashboard</h1>
                <p style={styles.subtitle}>{campaign.title}</p>
                {isMember ? (
                    <div style={styles.memberBadge}>✅ You are a board member</div>
                ) : (
                    <div style={styles.notMemberBadge}>⚠️ You are not a board member of this campaign</div>
                )}
            </div>

            {/* Campaign Summary */}
            <div style={styles.summaryCard}>
                <div style={styles.summaryGrid}>
                    <div style={styles.summaryItem}>
                        <span style={styles.summaryVal}>{campaign.totalDonated} ETH</span>
                        <span style={styles.summaryLbl}>Total Raised</span>
                    </div>
                    <div style={styles.summaryItem}>
                        <span style={styles.summaryVal}>{campaign.balance} ETH</span>
                        <span style={styles.summaryLbl}>Available</span>
                    </div>
                    <div style={styles.summaryItem}>
                        <span style={styles.summaryVal}>{campaign.boardSize}</span>
                        <span style={styles.summaryLbl}>Board Members</span>
                    </div>
                    <div style={styles.summaryItem}>
                        <span style={styles.summaryVal}>{threshold}</span>
                        <span style={styles.summaryLbl}>Votes Needed (2/3)</span>
                    </div>
                    <div style={styles.summaryItem}>
                        <span style={styles.summaryVal}>{campaign.totalRequests}</span>
                        <span style={styles.summaryLbl}>Total Requests</span>
                    </div>
                    <div style={styles.summaryItem}>
                        <span style={styles.summaryVal}>
                            {requests.filter(r => r.status === 0).length}
                        </span>
                        <span style={styles.summaryLbl}>Pending Votes</span>
                    </div>
                </div>
            </div>

            {/* Error / Success */}
            {error   && <div style={styles.errorBox}>⚠️ {error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            {/* Requests */}
            <div style={styles.requestsSection}>
                <h2 style={styles.sectionTitle}>
                    📋 Withdrawal Requests
                </h2>

                {requests.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p style={styles.emptyText}>
                            No withdrawal requests yet. The campaigner hasn't submitted any requests.
                        </p>
                    </div>
                ) : (
                    <div style={styles.requestsList}>
                        {requests.map((req) => {
                            const statusInfo  = getReqStatusInfo(req.status);
                            const approvalPct = getVoteProgress(req.approvalCount, campaign.boardSize);
                            const rejectPct   = getVoteProgress(req.rejectionCount, campaign.boardSize);
                            const isPending   = req.status === 0;

                            return (
                                <div key={req.id} style={styles.reqCard}>

                                    {/* Request header */}
                                    <div style={styles.reqHeader}>
                                        <div style={styles.reqLeft}>
                                            <span style={styles.reqNum}>Request #{req.id + 1}</span>
                                            <div style={{
                                                ...styles.statusBadge,
                                                color: statusInfo.color,
                                                background: statusInfo.bg,
                                                border: `1px solid ${statusInfo.color}`,
                                            }}>
                                                {statusInfo.label}
                                            </div>
                                            {req.executed && (
                                                <span style={styles.executedTag}>✅ Funds Released</span>
                                            )}
                                        </div>
                                        <span style={styles.reqAmount}>{req.amount} ETH</span>
                                    </div>

                                    {/* Description */}
                                    <p style={styles.reqDesc}>{req.description}</p>

                                    {/* Vote progress */}
                                    <div style={styles.voteSection}>
                                        <div style={styles.voteRow}>
                                            <div style={styles.voteInfo}>
                                                <span style={styles.approveLabel}>
                                                    ✅ Approvals: {req.approvalCount}/{campaign.boardSize}
                                                </span>
                                                <span style={styles.thresholdNote}>
                                                    Need {threshold} to pass
                                                </span>
                                            </div>
                                            <div style={styles.voteBar}>
                                                <div style={{
                                                    ...styles.voteBarFill,
                                                    width: `${approvalPct}%`,
                                                    background: "#22c55e",
                                                }} />
                                            </div>
                                        </div>

                                        <div style={styles.voteRow}>
                                            <div style={styles.voteInfo}>
                                                <span style={styles.rejectLabel}>
                                                    ❌ Rejections: {req.rejectionCount}/{campaign.boardSize}
                                                </span>
                                                <span style={styles.thresholdNote}>
                                                    Need {threshold} to reject
                                                </span>
                                            </div>
                                            <div style={styles.voteBar}>
                                                <div style={{
                                                    ...styles.voteBarFill,
                                                    width: `${rejectPct}%`,
                                                    background: "#ef4444",
                                                }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vote buttons */}
                                    {isPending && isMember && (
                                        <div style={styles.voteBtns}>
                                            <button
                                                style={{
                                                    ...styles.approveBtn,
                                                    opacity: voting === req.id ? 0.6 : 1,
                                                    cursor: voting === req.id ? "not-allowed" : "pointer",
                                                }}
                                                onClick={() => handleVote(req.id, true)}
                                                disabled={voting === req.id}
                                            >
                                                {voting === req.id ? "⏳ Voting..." : "✅ Approve"}
                                            </button>
                                            <button
                                                style={{
                                                    ...styles.rejectBtn,
                                                    opacity: voting === req.id ? 0.6 : 1,
                                                    cursor: voting === req.id ? "not-allowed" : "pointer",
                                                }}
                                                onClick={() => handleVote(req.id, false)}
                                                disabled={voting === req.id}
                                            >
                                                {voting === req.id ? "⏳ Voting..." : "❌ Reject"}
                                            </button>
                                        </div>
                                    )}

                                    {isPending && !isMember && (
                                        <div style={styles.notMemberNote}>
                                            You are not a board member of this campaign
                                        </div>
                                    )}

                                    {!isPending && (
                                        <div style={{
                                            ...styles.finalNote,
                                            color: statusInfo.color,
                                        }}>
                                            {req.status === 1
                                                ? `✅ Approved — ${req.executed ? "Funds have been released" : "Awaiting execution"}`
                                                : "❌ Rejected — Request was denied by the board"
                                            }
                                        </div>
                                    )}

                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Board Members List */}
            <div style={styles.boardCard}>
                <h3 style={styles.sectionTitle}>👥 Board Members</h3>
                <div style={styles.membersList}>
                    {campaign.boardMembers.map((member, i) => (
                        <div key={i} style={{
                            ...styles.memberRow,
                            background: member.toLowerCase() === account?.toLowerCase()
                                ? "#052e16"
                                : "#0f172a",
                            border: member.toLowerCase() === account?.toLowerCase()
                                ? "1px solid #22c55e"
                                : "1px solid #1e293b",
                        }}>
                            <span style={styles.memberNum}>{i + 1}</span>
                            <span style={styles.memberAddr}>
                                {member.slice(0, 10)}...{member.slice(-8)}
                            </span>
                            {member.toLowerCase() === account?.toLowerCase() && (
                                <span style={styles.youTag}>YOU</span>
                            )}
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
        gap: "8px",
    },
    title: {
        fontSize: "32px",
        fontWeight: "800",
        color: "#f1f5f9",
        margin: 0,
    },
    subtitle: {
        color: "#94a3b8",
        fontSize: "16px",
        margin: 0,
    },
    memberBadge: {
        display: "inline-block",
        background: "#052e16",
        border: "1px solid #22c55e",
        color: "#22c55e",
        padding: "6px 14px",
        borderRadius: "20px",
        fontSize: "13px",
        fontWeight: "600",
        width: "fit-content",
    },
    notMemberBadge: {
        display: "inline-block",
        background: "#451a03",
        border: "1px solid #f59e0b",
        color: "#fcd34d",
        padding: "6px 14px",
        borderRadius: "20px",
        fontSize: "13px",
        fontWeight: "600",
        width: "fit-content",
    },
    summaryCard: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "24px",
    },
    summaryGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "16px",
    },
    summaryItem: {
        background: "#0f172a",
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
    },
    summaryVal: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#22c55e",
    },
    summaryLbl: {
        fontSize: "12px",
        color: "#64748b",
    },
    errorBox: {
        background: "#450a0a",
        border: "1px solid #ef4444",
        color: "#fca5a5",
        padding: "12px 16px",
        borderRadius: "8px",
        fontSize: "14px",
    },
    successBox: {
        background: "#052e16",
        border: "1px solid #22c55e",
        color: "#86efac",
        padding: "12px 16px",
        borderRadius: "8px",
        fontSize: "14px",
    },
    requestsSection: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    sectionTitle: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
    },
    emptyState: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "40px",
        textAlign: "center",
    },
    emptyText: {
        color: "#64748b",
        fontSize: "15px",
        margin: 0,
    },
    requestsList: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    reqCard: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    reqHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
    },
    reqLeft: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
    },
    reqNum: {
        color: "#94a3b8",
        fontSize: "14px",
        fontWeight: "700",
    },
    statusBadge: {
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "700",
    },
    executedTag: {
        color: "#22c55e",
        fontSize: "13px",
    },
    reqAmount: {
        fontSize: "20px",
        fontWeight: "800",
        color: "#22c55e",
    },
    reqDesc: {
        color: "#94a3b8",
        fontSize: "15px",
        margin: 0,
        lineHeight: 1.6,
    },
    voteSection: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        background: "#0f172a",
        borderRadius: "10px",
        padding: "16px",
    },
    voteRow: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    voteInfo: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    approveLabel: {
        color: "#22c55e",
        fontSize: "13px",
        fontWeight: "600",
    },
    rejectLabel: {
        color: "#ef4444",
        fontSize: "13px",
        fontWeight: "600",
    },
    thresholdNote: {
        color: "#64748b",
        fontSize: "12px",
    },
    voteBar: {
        background: "#1e293b",
        borderRadius: "100px",
        height: "8px",
        overflow: "hidden",
    },
    voteBarFill: {
        height: "100%",
        borderRadius: "100px",
        transition: "width 0.5s",
    },
    voteBtns: {
        display: "flex",
        gap: "12px",
    },
    approveBtn: {
        flex: 1,
        background: "#22c55e",
        color: "#000",
        border: "none",
        padding: "14px",
        borderRadius: "10px",
        fontWeight: "bold",
        fontSize: "15px",
        cursor: "pointer",
    },
    rejectBtn: {
        flex: 1,
        background: "transparent",
        color: "#ef4444",
        border: "2px solid #ef4444",
        padding: "14px",
        borderRadius: "10px",
        fontWeight: "bold",
        fontSize: "15px",
        cursor: "pointer",
    },
    notMemberNote: {
        color: "#64748b",
        fontSize: "13px",
        textAlign: "center",
        padding: "8px",
    },
    finalNote: {
        fontSize: "14px",
        fontWeight: "600",
        padding: "8px 0",
    },
    boardCard: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    membersList: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    memberRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "10px",
    },
    memberNum: {
        color: "#64748b",
        fontSize: "13px",
        fontWeight: "700",
        width: "20px",
    },
    memberAddr: {
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "13px",
        flex: 1,
    },
    youTag: {
        background: "#22c55e",
        color: "#000",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "800",
    },
    miniLink: {
        color: "#3b82f6",
        fontSize: "13px",
        textDecoration: "none",
    },
    msg: {
        color: "#94a3b8",
        fontSize: "16px",
    },
    errorText: {
        color: "#ef4444",
        fontSize: "16px",
    },
};

export default BoardDashboard;
