import { useWallet } from "../context/WalletContext";
import { useNavigate, useLocation } from "react-router-dom";

const Navbar = () => {
    const { account, connectWallet, disconnectWallet, shortAddress, loading, isBoardMember } = useWallet();
    const navigate  = useNavigate();
    const location  = useLocation();

    const isActive = (path) => location.pathname === path;

    return (
        <nav style={styles.nav}>
            {/* Logo */}
            <div style={styles.logo} onClick={() => navigate("/")}>
                🌱 TruFund
            </div>

            {/* Nav Links — only show when connected */}
            {account && (
                <div style={styles.navLinks}>
                    <button
                        style={{
                            ...styles.navLink,
                            color: isActive("/donate") ? "#22c55e" : "#94a3b8",
                            borderBottom: isActive("/donate") ? "2px solid #22c55e" : "2px solid transparent",
                        }}
                        onClick={() => navigate("/donate")}
                    >
                        Browse Campaigns
                    </button>
                    <button
                        style={{
                            ...styles.navLink,
                            color: isActive("/register") ? "#22c55e" : "#94a3b8",
                            borderBottom: isActive("/register") ? "2px solid #22c55e" : "2px solid transparent",
                        }}
                        onClick={() => navigate("/register")}
                    >
                        Start Campaign
                    </button>
                    <button
                        style={{
                            ...styles.navLink,
                            color: isActive("/dashboard") ? "#22c55e" : "#94a3b8",
                            borderBottom: isActive("/dashboard") ? "2px solid #22c55e" : "2px solid transparent",
                        }}
                        onClick={() => navigate("/dashboard")}
                    >
                        My Dashboard
                    </button>
                    {isBoardMember && (
                        <button
                            style={{
                                ...styles.navLink,
                                color: isActive("/board-home") ? "#f59e0b" : "#94a3b8",
                                borderBottom: isActive("/board-home") ? "2px solid #f59e0b" : "2px solid transparent",
                            }}
                            onClick={() => navigate("/board-home")}
                        >
                            Board Member
                        </button>
                    )}
                </div>
            )}

            {/* Right side */}
            <div style={styles.right}>
                {account ? (
                    <>
                        <span style={styles.address}>
                            {shortAddress(account)}
                        </span>
                        <button style={styles.disconnectBtn} onClick={disconnectWallet}>
                            Disconnect
                        </button>
                    </>
                ) : (
                    <button
                        style={styles.connectBtn}
                        onClick={connectWallet}
                        disabled={loading}
                    >
                        {loading ? "Connecting..." : "Connect Wallet"}
                    </button>
                )}
            </div>
        </nav>
    );
};

const styles = {
    nav: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 40px",
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
        position: "sticky",
        top: 0,
        zIndex: 100,
    },
    logo: {
        fontSize: "24px",
        fontWeight: "bold",
        color: "#22c55e",
        cursor: "pointer",
        fontFamily: "sans-serif",
    },
    navLinks: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    navLink: {
        background: "transparent",
        border: "none",
        borderBottom: "2px solid transparent",
        padding: "8px 16px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        fontFamily: "sans-serif",
        transition: "all 0.2s",
    },
    right: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
    address: {
        color: "#94a3b8",
        fontFamily: "monospace",
        fontSize: "14px",
        background: "#1e293b",
        padding: "6px 12px",
        borderRadius: "8px",
    },
    connectBtn: {
        background: "#22c55e",
        color: "#000",
        border: "none",
        padding: "10px 20px",
        borderRadius: "8px",
        fontWeight: "bold",
        cursor: "pointer",
        fontSize: "14px",
    },
    disconnectBtn: {
        background: "transparent",
        color: "#ef4444",
        border: "1px solid #ef4444",
        padding: "8px 16px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
    },
};

export default Navbar;