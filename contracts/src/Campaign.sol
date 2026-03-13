// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


import "contracts/contracts/lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract Campaign is ReentrancyGuard {

    // ─────────────────────────────────────────
    //  ENUMS
    // ─────────────────────────────────────────

    enum CampaignStatus { Active, Expired, Closed }
    enum RequestStatus  { Pending, Approved, Rejected }

    // ─────────────────────────────────────────
    //  STRUCTS
    // ─────────────────────────────────────────

    struct WithdrawalRequest {
        string  description;       // what the funds are for
        uint256 amount;            // amount requested in wei
        uint256 approvalCount;     // how many board members approved
        uint256 rejectionCount;    // how many board members rejected
        RequestStatus status;      // Pending / Approved / Rejected
        bool    executed;          // has the payout been sent?
        mapping(address => bool) hasVoted; // prevents double voting
    }

    // ─────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────

    // --- Campaign metadata ---
    address public campaigner;
    string  public title;
    string  public description;
    string  public ipfsHash;        // IPFS CID for images/docs
    uint256 public goalAmount;      // fundraising goal in wei
    uint256 public deadline;        // unix timestamp
    uint256 public totalDonated;    // running total of all donations

    // --- Campaign status ---
    CampaignStatus public status;

    // --- Donor tracking ---
    mapping(address => uint256) public donations;  // donor → amount donated
    address[] public donorList;                    // for iteration if needed

    // --- Board / Multi-sig ---
    address[] public boardMembers;
    mapping(address => bool) public isBoardMember;
    uint256 public boardSize;

    // --- Withdrawal requests ---
    WithdrawalRequest[] public requests;

    // --- Constants ---
    uint256 public constant MIN_DONATION = 0.01 ether;

    // ─────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────

    event DonationReceived(address indexed donor, uint256 amount, uint256 newTotal);
    event WithdrawalRequested(uint256 indexed requestId, string description, uint256 amount);
    event RequestVoted(uint256 indexed requestId, address indexed boardMember, bool approved);
    event RequestExecuted(uint256 indexed requestId, uint256 amount, address indexed campaigner);
    event RequestRejected(uint256 indexed requestId);
    event CampaignExpired(uint256 timestamp);

    // ─────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────

    modifier onlyCampaigner() {
        require(msg.sender == campaigner, "Not the campaigner");
        _;
    }

    modifier onlyBoardMember() {
        require(isBoardMember[msg.sender], "Not a board member");
        _;
    }

    modifier isActive() {
        // lazy expiry check — auto-expire if deadline passed
        if (block.timestamp >= deadline && status == CampaignStatus.Active) {
            status = CampaignStatus.Expired;
            emit CampaignExpired(block.timestamp);
        }
        require(status == CampaignStatus.Active, "Campaign is not active");
        _;
    }

    // ─────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────

    constructor(
        address          _campaigner,
        string  memory   _title,
        string  memory   _description,
        string  memory   _ipfsHash,
        uint256          _goalAmount,
        uint256          _deadline,
        address[] memory _boardMembers
    ) {
        require(_goalAmount > 0,                        "Goal must be > 0");
        require(_deadline > block.timestamp,            "Deadline must be in the future");
        require(_boardMembers.length >= 3,              "Need at least 3 board members");

        campaigner  = _campaigner;
        title       = _title;
        description = _description;
        ipfsHash    = _ipfsHash;
        goalAmount  = _goalAmount;
        deadline    = _deadline;
        status      = CampaignStatus.Active;

        // register board members — check for duplicates
        for (uint256 i = 0; i < _boardMembers.length; i++) {
            address member = _boardMembers[i];
            require(member != address(0),        "Zero address not allowed");
            require(!isBoardMember[member],      "Duplicate board member");
            isBoardMember[member] = true;
            boardMembers.push(member);
        }
        boardSize = _boardMembers.length;
    }

    // ─────────────────────────────────────────
    //  DONATE
    // ─────────────────────────────────────────

    /**
     * @dev Donors call this to donate ETH to the campaign.
     *      - nonReentrant guard from OpenZeppelin
     *      - isActive checks deadline lazily
     *      - MIN_DONATION enforced
     *      - State updated BEFORE any external interaction (CEI pattern)
     */
    function donate() external payable isActive nonReentrant {
        require(msg.value >= MIN_DONATION, "Minimum donation is 0.01 ETH");

        // CHECKS done above
        // EFFECTS — update state first
        if (donations[msg.sender] == 0) {
            donorList.push(msg.sender);  // first time donor, add to list
        }
        donations[msg.sender] += msg.value;
        totalDonated           += msg.value;

        // INTERACTIONS — emit event (no external call here, ETH already received)
        emit DonationReceived(msg.sender, msg.value, totalDonated);
    }

    // ─────────────────────────────────────────
    //  WITHDRAWAL REQUEST (Campaigner)
    // ─────────────────────────────────────────

    /**
     * @dev Campaigner raises a spending request.
     *      Funds stay locked until 2/3 board members approve.
     */
    function createWithdrawalRequest(
        string memory _description,
        uint256       _amount
    ) external onlyCampaigner {
        require(_amount > 0,                        "Amount must be > 0");
        require(_amount <= address(this).balance,   "Insufficient contract balance");

        // push a new request — mapping inside struct initialised to default (false)
        WithdrawalRequest storage newReq = requests.push();
        newReq.description    = _description;
        newReq.amount         = _amount;
        newReq.approvalCount  = 0;
        newReq.rejectionCount = 0;
        newReq.status         = RequestStatus.Pending;
        newReq.executed       = false;

        emit WithdrawalRequested(requests.length - 1, _description, _amount);
    }

    // ─────────────────────────────────────────
    //  VOTE ON REQUEST (Board Members)
    // ─────────────────────────────────────────

    /**
     * @dev Board members call this to approve or reject a request.
     *      Once 2/3 supermajority is reached either way, the request
     *      is finalised automatically.
     */
    function voteOnRequest(uint256 _requestId, bool _approve)
        external
        onlyBoardMember
        nonReentrant
    {
        require(_requestId < requests.length, "Invalid request ID");

        WithdrawalRequest storage req = requests[_requestId];

        require(req.status == RequestStatus.Pending, "Request already finalised");
        require(!req.hasVoted[msg.sender],            "Already voted");

        // EFFECTS first
        req.hasVoted[msg.sender] = true;

        if (_approve) {
            req.approvalCount++;
        } else {
            req.rejectionCount++;
        }

        emit RequestVoted(_requestId, msg.sender, _approve);

        // ── Check if 2/3 supermajority reached ──
        // threshold = ceil(2 * boardSize / 3)
        uint256 threshold = (2 * boardSize + 2) / 3;

        if (req.approvalCount >= threshold) {
            req.status = RequestStatus.Approved;
            _executeRequest(_requestId);
        } else if (req.rejectionCount >= threshold) {
            req.status = RequestStatus.Rejected;
            emit RequestRejected(_requestId);
        }
    }

    // ─────────────────────────────────────────
    //  EXECUTE REQUEST (internal)
    // ─────────────────────────────────────────

    /**
     * @dev Called internally once approval threshold is met.
     *      Classic CEI pattern to prevent reentrancy:
     *        1. CHECKS  — already done in voteOnRequest
     *        2. EFFECTS — mark executed BEFORE transfer
     *        3. INTERACT — transfer ETH last
     */
    function _executeRequest(uint256 _requestId) internal {
        WithdrawalRequest storage req = requests[_requestId];

        require(!req.executed,                      "Already executed");
        require(req.amount <= address(this).balance,"Insufficient balance");

        // EFFECTS — flip flag before transfer (reentrancy protection)
        req.executed = true;

        // INTERACTIONS — ETH transfer happens last
        (bool success, ) = payable(campaigner).call{value: req.amount}("");
        require(success, "Transfer failed");

        emit RequestExecuted(_requestId, req.amount, campaigner);
    }

    // ─────────────────────────────────────────
    //  VIEW HELPERS
    // ─────────────────────────────────────────

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getTotalRequests() external view returns (uint256) {
        return requests.length;
    }

    function getDonorCount() external view returns (uint256) {
        return donorList.length;
    }

    function getBoardMembers() external view returns (address[] memory) {
        return boardMembers;
    }

    /// @dev Check if the campaign has expired without writing state
    function isExpired() external view returns (bool) {
        return block.timestamp >= deadline;
    }
}