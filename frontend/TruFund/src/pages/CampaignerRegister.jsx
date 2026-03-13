import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useContract } from "../hooks/useContract";
import { ethers } from "ethers";

// Add import at top
import { uploadImageToIPFS } from "../utils/ipfs";

const CampaignerRegister = () => {
    // Add to state at top
const [imageFile, setImageFile]     = useState(null);
const [imagePreview, setImagePreview] = useState(null);
const [uploadingIPFS, setUploadingIPFS] = useState(false);

    const navigate = useNavigate();
    const { account } = useWallet();
    const { getFactoryContract } = useContract();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [step, setStep] = useState(1); // multi-step form

    // form state
    const [form, setForm] = useState({
        title: "",
        description: "",
        goalAmount: "",
        deadline: "",
        ipfsHash: "QmDefaultHash", // will be replaced by IPFS upload later
    });

    const [boardMembers, setBoardMembers] = useState(["", "", ""]);

    // ─────────────────────────────────────────
    //  HANDLERS
    // ─────────────────────────────────────────

    const handleFormChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleBoardMemberChange = (index, value) => {
        const updated = [...boardMembers];
        updated[index] = value;
        setBoardMembers(updated);
    };

    const addBoardMember = () => {
        if (boardMembers.length < 10) {
            setBoardMembers([...boardMembers, ""]);
        }
    };

    const removeBoardMember = (index) => {
        if (boardMembers.length > 3) {
            setBoardMembers(boardMembers.filter((_, i) => i !== index));
        }
    };

    const validateStep1 = () => {
        if (!form.title.trim())       { setError("Title is required");       return false; }
        if (!form.description.trim()) { setError("Description is required"); return false; }
        if (!form.goalAmount || parseFloat(form.goalAmount) <= 0) {
            setError("Goal amount must be greater than 0");
            return false;
        }
        if (!form.deadline) { setError("Deadline is required"); return false; }
        const deadlineTs = new Date(form.deadline).getTime();
        if (deadlineTs <= Date.now()) {
            setError("Deadline must be in the future");
            return false;
        }
        setError(null);
        return true;
    };

    const validateStep2 = () => {
        for (let i = 0; i < boardMembers.length; i++) {
            const addr = boardMembers[i].trim();
            if (!addr) {
                setError(`Board member ${i + 1} address is empty`);
                return false;
            }
            if (!ethers.isAddress(addr)) {
                setError(`Board member ${i + 1} is not a valid Ethereum address`);
                return false;
            }
        }
        // check duplicates
        const unique = new Set(boardMembers.map(a => a.toLowerCase()));
        if (unique.size !== boardMembers.length) {
            setError("Duplicate board member addresses found");
            return false;
        }
        setError(null);
        return true;
    };

    const handleNext = () => {
        if (validateStep1()) setStep(2);
    };

    const handleSubmit = async () => {
    if (!validateStep2()) return;
    if (!account) { setError("Please connect your wallet"); return; }

    try {
        setLoading(true);
        setError(null);

        // upload image to IPFS first if provided
        let ipfsHash = "QmDefaultHash";
        if (imageFile) {
            setSuccess("Uploading image to IPFS...");
            setUploadingIPFS(true);
            ipfsHash = await uploadImageToIPFS(imageFile);
            setUploadingIPFS(false);
            setSuccess("Image uploaded! Deploying campaign...");
        }

        const factory = getFactoryContract();
        if (!factory) { setError("Contract not loaded"); return; }

        const deadlineTs = Math.floor(new Date(form.deadline).getTime() / 1000);
        const goalInWei  = ethers.parseEther(form.goalAmount);
        const validBoard = boardMembers.map(a => a.trim()).filter(a => a);

        const tx = await factory.createCampaign(
            form.title,
            form.description,
            ipfsHash,      // ← real IPFS hash now!
            goalInWei,
            deadlineTs,
            validBoard
        );

        setSuccess("Transaction submitted! Waiting for confirmation...");
        const receipt = await tx.wait();
        const event   = receipt.logs[0];
        const campaignAddress = "0x" + event.topics[1].slice(26);

        setSuccess(`✅ Campaign deployed at ${campaignAddress}`);
        setTimeout(() => navigate("/dashboard"), 2000);

    } catch (err) {
        console.error(err);
        if (err.code === 4001) {
            setError("Transaction rejected.");
        } else {
            setError(err.message || "Something went wrong");
        }
    } finally {
        setLoading(false);
        setUploadingIPFS(false);
    }
};

    // ─────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────

    return (
        <div style={styles.container}>
            <div style={styles.card}>

                {/* Header */}
                <div style={styles.header}>
                    <h1 style={styles.title}>🏛️ Register Your Campaign</h1>
                    <p style={styles.subtitle}>
                        Launch a transparent fundraising campaign on the blockchain
                    </p>
                </div>

                {/* Step Indicator */}
                <div style={styles.stepIndicator}>
                    <div style={{
                        ...styles.step,
                        background: step >= 1 ? "#22c55e" : "#1e293b",
                        color: step >= 1 ? "#000" : "#64748b",
                    }}>
                        1. Campaign Info
                    </div>
                    <div style={styles.stepLine} />
                    <div style={{
                        ...styles.step,
                        background: step >= 2 ? "#22c55e" : "#1e293b",
                        color: step >= 2 ? "#000" : "#64748b",
                    }}>
                        2. Board Members
                    </div>
                </div>

                {/* Error / Success */}
                {error && <div style={styles.errorBox}>⚠️ {error}</div>}
                {success && <div style={styles.successBox}>✅ {success}</div>}

                {/* ── STEP 1 ── */}
                {step === 1 && (
                    <div style={styles.form}>
                        <div style={styles.field}>
                            <label style={styles.label}>Campaign Title *</label>
                            <input
                                style={styles.input}
                                name="title"
                                placeholder="e.g. Save the Forests"
                                value={form.title}
                                onChange={handleFormChange}
                            />
                        </div>

                        <div style={styles.field}>
                            <label style={styles.label}>Description *</label>
                            <textarea
                                style={styles.textarea}
                                name="description"
                                placeholder="Describe your campaign and how funds will be used..."
                                value={form.description}
                                onChange={handleFormChange}
                                rows={5}
                            />
                        </div>

                        {/* Image Upload */}
<div style={styles.field}>
    <label style={styles.label}>Campaign Image (optional)</label>
    <div
        style={styles.uploadBox}
        onClick={() => document.getElementById("imageInput").click()}
    >
        {imagePreview ? (
            <img
                src={imagePreview}
                alt="preview"
                style={styles.imagePreview}
            />
        ) : (
            <div style={styles.uploadPlaceholder}>
                <span style={styles.uploadIcon}>📸</span>
                <span style={styles.uploadText}>Click to upload image</span>
                <span style={styles.uploadSubtext}>PNG, JPG up to 10MB</span>
            </div>
        )}
        <input
            id="imageInput"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                }
            }}
        />
    </div>
</div>

                        <div style={styles.row}>
                            <div style={styles.field}>
                                <label style={styles.label}>Goal Amount (ETH) *</label>
                                <input
                                    style={styles.input}
                                    name="goalAmount"
                                    type="number"
                                    placeholder="e.g. 10"
                                    min="0"
                                    step="0.01"
                                    value={form.goalAmount}
                                    onChange={handleFormChange}
                                />
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Deadline *</label>
                                <input
                                    style={styles.input}
                                    name="deadline"
                                    type="datetime-local"
                                    value={form.deadline}
                                    onChange={handleFormChange}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>
                        </div>

                        <button style={styles.primaryBtn} onClick={handleNext}>
                            Next: Add Board Members →
                        </button>
                    </div>
                )}

                {/* ── STEP 2 ── */}
                {step === 2 && (
                    <div style={styles.form}>
                        <div style={styles.infoBox}>
                            ℹ️ Board members are the governance authority of your campaign.
                            A 2/3 supermajority must approve every withdrawal request.
                            Minimum 3 board members required.
                        </div>

                        {boardMembers.map((member, index) => (
                            <div key={index} style={styles.boardRow}>
                                <div style={styles.field}>
                                    <label style={styles.label}>
                                        Board Member {index + 1} {index < 3 ? "*" : ""}
                                    </label>
                                    <input
                                        style={styles.input}
                                        placeholder="0x..."
                                        value={member}
                                        onChange={(e) => handleBoardMemberChange(index, e.target.value)}
                                    />
                                </div>
                                {index >= 3 && (
                                    <button
                                        style={styles.removeBtn}
                                        onClick={() => removeBoardMember(index)}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}

                        {boardMembers.length < 10 && (
                            <button style={styles.addBtn} onClick={addBoardMember}>
                                + Add Another Board Member
                            </button>
                        )}

                        <div style={styles.btnRow}>
                            <button
                                style={styles.secondaryBtn}
                                onClick={() => { setStep(1); setError(null); }}
                            >
                                ← Back
                            </button>
                            <button
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: loading ? 0.7 : 1,
                                    cursor: loading ? "not-allowed" : "pointer",
                                }}
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? "Deploying..." : "🚀 Launch Campaign"}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

const styles = {
    container: {
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "40px 20px",
        fontFamily: "sans-serif",
    },
    card: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "40px",
        width: "100%",
        maxWidth: "700px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
    },
    header: {
        textAlign: "center",
    },
    title: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#f1f5f9",
        margin: 0,
    },
    subtitle: {
        color: "#94a3b8",
        marginTop: "8px",
        fontSize: "15px",
    },
    stepIndicator: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    step: {
        flex: 1,
        textAlign: "center",
        padding: "10px",
        borderRadius: "8px",
        fontWeight: "600",
        fontSize: "14px",
        transition: "all 0.3s",
    },
    stepLine: {
        width: "30px",
        height: "2px",
        background: "#334155",
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
    infoBox: {
        background: "#0f172a",
        border: "1px solid #334155",
        color: "#94a3b8",
        padding: "12px 16px",
        borderRadius: "8px",
        fontSize: "14px",
        lineHeight: 1.6,
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        flex: 1,
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
        width: "100%",
    },
    textarea: {
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "12px 16px",
        color: "#f1f5f9",
        fontSize: "15px",
        outline: "none",
        resize: "vertical",
        fontFamily: "sans-serif",
    },
    row: {
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
    },
    boardRow: {
        display: "flex",
        alignItems: "flex-end",
        gap: "12px",
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
    },
    secondaryBtn: {
        background: "transparent",
        color: "#94a3b8",
        border: "1px solid #334155",
        padding: "14px 24px",
        borderRadius: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        fontSize: "15px",
    },
    addBtn: {
        background: "transparent",
        color: "#22c55e",
        border: "1px dashed #22c55e",
        padding: "12px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
    },
    removeBtn: {
        background: "#450a0a",
        color: "#ef4444",
        border: "1px solid #ef4444",
        borderRadius: "8px",
        padding: "8px 12px",
        cursor: "pointer",
        fontSize: "14px",
        marginBottom: "0px",
        height: "44px",
    },
    btnRow: {
        display: "flex",
        gap: "16px",
        justifyContent: "space-between",
    },
    uploadBox: {
    background: "#0f172a",
    border: "2px dashed #334155",
    borderRadius: "10px",
    padding: "20px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "160px",
    overflow: "hidden",
},
uploadPlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
},
uploadIcon: {
    fontSize: "40px",
},
uploadText: {
    color: "#94a3b8",
    fontSize: "15px",
    fontWeight: "600",
},
uploadSubtext: {
    color: "#64748b",
    fontSize: "13px",
},
imagePreview: {
    width: "100%",
    maxHeight: "200px",
    objectFit: "cover",
    borderRadius: "8px",
},
};

export default CampaignerRegister;