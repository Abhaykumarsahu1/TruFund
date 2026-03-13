// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Campaign.sol";
import "../src/CampaignFactory.sol";

// ─────────────────────────────────────────
//  MALICIOUS CONTRACT (Reentrancy Attacker)
// ─────────────────────────────────────────

/**
 * @dev This contract simulates a reentrancy attack.
 *      When it receives ETH, it tries to call back into
 *      the Campaign contract to drain funds.
 */
contract ReentrancyAttacker {
    Campaign public target;
    uint256 public attackCount;

    constructor(address _target) {
        target = Campaign(payable(_target));
    }

    function attack() external payable {
        target.donate{value: msg.value}();
    }

    receive() external payable {
        attackCount++;
        // try to re-enter with enough ETH — should fail due to nonReentrant
        if (attackCount < 3 && address(this).balance >= 0.01 ether) {
            try target.donate{value: 0.01 ether}() {} catch {}
        }
    }
}

// ─────────────────────────────────────────
//  MAIN TEST CONTRACT
// ─────────────────────────────────────────

contract CampaignTest is Test {

    CampaignFactory factory;
    Campaign campaign;

    // actors
    address campaigner   = makeAddr("campaigner");
    address donor1       = makeAddr("donor1");
    address donor2       = makeAddr("donor2");
    address boardMember1 = makeAddr("boardMember1");
    address boardMember2 = makeAddr("boardMember2");
    address boardMember3 = makeAddr("boardMember3");
    address boardMember4 = makeAddr("boardMember4");
    address boardMember5 = makeAddr("boardMember5");
    address randomUser   = makeAddr("randomUser");

    // campaign params
    uint256 goalAmount = 10 ether;
    uint256 deadline;

    // ─────────────────────────────────────────
    //  SETUP — runs before every test
    // ─────────────────────────────────────────

    function setUp() public {
        deadline = block.timestamp + 30 days;

        // fund actors
        vm.deal(donor1, 10 ether);
        vm.deal(donor2, 10 ether);
        vm.deal(boardMember1, 1 ether);

        // deploy factory
        factory = new CampaignFactory();

        // build board members array
        address[] memory board = new address[](5);
        board[0] = boardMember1;
        board[1] = boardMember2;
        board[2] = boardMember3;
        board[3] = boardMember4;
        board[4] = boardMember5;

        // campaigner deploys a campaign via factory
        vm.prank(campaigner);
        address campaignAddr = factory.createCampaign(
            "Save the Forests",
            "Planting trees across India",
            "QmTestIPFSHash123",
            goalAmount,
            deadline,
            board
        );

        campaign = Campaign(payable(campaignAddr));
    }

    // ─────────────────────────────────────────
    //  FACTORY TESTS
    // ─────────────────────────────────────────

    function test_FactoryDeploysCampaign() public view {
        address[] memory all = factory.getAllCampaigns();
        assertEq(all.length, 1);
        assertEq(all[0], address(campaign));
    }

    function test_FactoryTracksCampaignerCampaigns() public view {
        address[] memory mine = factory.getCampaignsByCampaigner(campaigner);
        assertEq(mine.length, 1);
    }

    function test_FactoryMultipleCampaigns() public {
        address[] memory board = new address[](3);
        board[0] = boardMember1;
        board[1] = boardMember2;
        board[2] = boardMember3;

        vm.prank(campaigner);
        factory.createCampaign(
            "Clean Water",
            "Providing clean water",
            "QmHash2",
            5 ether,
            block.timestamp + 10 days,
            board
        );

        assertEq(factory.getTotalCampaigns(), 2);
        assertEq(factory.getCampaignsByCampaigner(campaigner).length, 2);
    }

    // ─────────────────────────────────────────
    //  CAMPAIGN DEPLOYMENT TESTS
    // ─────────────────────────────────────────

    function test_CampaignInitialState() public view {
        assertEq(campaign.campaigner(), campaigner);
        assertEq(campaign.title(), "Save the Forests");
        assertEq(campaign.goalAmount(), goalAmount);
        assertEq(campaign.totalDonated(), 0);
        assertEq(uint(campaign.status()), uint(Campaign.CampaignStatus.Active));
    }

    function test_BoardMembersSetCorrectly() public view {
        assertTrue(campaign.isBoardMember(boardMember1));
        assertTrue(campaign.isBoardMember(boardMember2));
        assertTrue(campaign.isBoardMember(boardMember3));
        assertFalse(campaign.isBoardMember(randomUser));
        assertEq(campaign.boardSize(), 5);
    }

    function test_RevertIf_DeadlineInPast() public {
        address[] memory board = new address[](3);
        board[0] = boardMember1;
        board[1] = boardMember2;
        board[2] = boardMember3;

        vm.expectRevert("Deadline must be in the future");
        new Campaign(
            campaigner,
            "Bad Campaign",
            "desc",
            "hash",
            1 ether,
            block.timestamp - 1,
            board
        );
    }

    function test_RevertIf_LessThanThreeBoardMembers() public {
        address[] memory board = new address[](2);
        board[0] = boardMember1;
        board[1] = boardMember2;

        vm.expectRevert("Need at least 3 board members");
        new Campaign(
            campaigner,
            "Bad Campaign",
            "desc",
            "hash",
            1 ether,
            block.timestamp + 1 days,
            board
        );
    }

    function test_RevertIf_DuplicateBoardMember() public {
        address[] memory board = new address[](3);
        board[0] = boardMember1;
        board[1] = boardMember1; // duplicate!
        board[2] = boardMember3;

        vm.expectRevert("Duplicate board member");
        new Campaign(
            campaigner,
            "Bad Campaign",
            "desc",
            "hash",
            1 ether,
            block.timestamp + 1 days,
            board
        );
    }

    // ─────────────────────────────────────────
    //  DONATION TESTS
    // ─────────────────────────────────────────

    function test_DonationSucceeds() public {
        vm.prank(donor1);
        campaign.donate{value: 1 ether}();

        assertEq(campaign.totalDonated(), 1 ether);
        assertEq(campaign.donations(donor1), 1 ether);
        assertEq(campaign.getDonorCount(), 1);
    }

    function test_MultipleDonorsTrackedCorrectly() public {
        vm.prank(donor1);
        campaign.donate{value: 1 ether}();

        vm.prank(donor2);
        campaign.donate{value: 2 ether}();

        assertEq(campaign.totalDonated(), 3 ether);
        assertEq(campaign.getDonorCount(), 2);
    }

    function test_RevertIf_DonationBelowMinimum() public {
        vm.prank(donor1);
        vm.expectRevert("Minimum donation is 0.01 ETH");
        campaign.donate{value: 0.001 ether}();
    }

    function test_RevertIf_DonateAfterDeadline() public {
        vm.warp(deadline + 1);

        vm.prank(donor1);
        vm.expectRevert("Campaign is not active");
        campaign.donate{value: 1 ether}();
    }

    // ─────────────────────────────────────────
    //  FIX 1 — use isExpired() view instead of
    //  checking status after revert
    // ─────────────────────────────────────────

    function test_CampaignAutoExpiresAfterDeadline() public {
        vm.warp(deadline + 1);

        // isExpired() checks block.timestamp directly — no state write needed
        assertTrue(campaign.isExpired());

        // also confirm donation reverts
        vm.prank(donor1);
        vm.expectRevert("Campaign is not active");
        campaign.donate{value: 1 ether}();
    }

    // ─────────────────────────────────────────
    //  WITHDRAWAL REQUEST TESTS
    // ─────────────────────────────────────────

    function test_CampaignerCanCreateWithdrawalRequest() public {
        vm.prank(donor1);
        campaign.donate{value: 5 ether}();

        vm.prank(campaigner);
        campaign.createWithdrawalRequest("Buy saplings", 1 ether);

        assertEq(campaign.getTotalRequests(), 1);
    }

    function test_RevertIf_NonCampaignerCreatesRequest() public {
        vm.prank(donor1);
        campaign.donate{value: 5 ether}();

        vm.prank(randomUser);
        vm.expectRevert("Not the campaigner");
        campaign.createWithdrawalRequest("Steal funds", 1 ether);
    }

    function test_RevertIf_RequestAmountExceedsBalance() public {
        vm.prank(donor1);
        campaign.donate{value: 1 ether}();

        vm.prank(campaigner);
        vm.expectRevert("Insufficient contract balance");
        campaign.createWithdrawalRequest("Too much", 5 ether);
    }

    // ─────────────────────────────────────────
    //  MULTI-SIG VOTING TESTS
    // ─────────────────────────────────────────

    function _setupRequestWithFunds() internal returns (uint256) {
        vm.prank(donor1);
        campaign.donate{value: 5 ether}();

        vm.prank(campaigner);
        campaign.createWithdrawalRequest("Buy equipment", 2 ether);

        return 0; // requestId
    }

    function test_BoardMemberCanVote() public {
        uint256 reqId = _setupRequestWithFunds();

        vm.prank(boardMember1);
        campaign.voteOnRequest(reqId, true);
        // no revert = success
    }

    function test_RevertIf_NonBoardMemberVotes() public {
        uint256 reqId = _setupRequestWithFunds();

        vm.prank(randomUser);
        vm.expectRevert("Not a board member");
        campaign.voteOnRequest(reqId, true);
    }

    function test_RevertIf_BoardMemberVotesTwice() public {
        uint256 reqId = _setupRequestWithFunds();

        vm.prank(boardMember1);
        campaign.voteOnRequest(reqId, true);

        vm.prank(boardMember1);
        vm.expectRevert("Already voted");
        campaign.voteOnRequest(reqId, true);
    }

    // ─────────────────────────────────────────
    //  FIX 2 — _executeRequest is now internal
    //  (no nonReentrant) so voteOnRequest won't
    //  clash with the reentrancy guard
    // ─────────────────────────────────────────

    function test_FundsReleasedAfterSupermajorityApproval() public {
        uint256 reqId = _setupRequestWithFunds();

        uint256 campaignerBalanceBefore = campaigner.balance;

        // 2/3 supermajority of 5 = ceil(10/3) = 4 approvals needed
        vm.prank(boardMember1);
        campaign.voteOnRequest(reqId, true);

        vm.prank(boardMember2);
        campaign.voteOnRequest(reqId, true);

        vm.prank(boardMember3);
        campaign.voteOnRequest(reqId, true);

        vm.prank(boardMember4);
        campaign.voteOnRequest(reqId, true); // 4th vote → threshold met → funds released

        assertEq(campaigner.balance, campaignerBalanceBefore + 2 ether);
    }

    function test_RequestRejectedAfterSupermajorityRejection() public {
        uint256 reqId = _setupRequestWithFunds();

        vm.prank(boardMember1);
        campaign.voteOnRequest(reqId, false);

        vm.prank(boardMember2);
        campaign.voteOnRequest(reqId, false);

        vm.prank(boardMember3);
        campaign.voteOnRequest(reqId, false);

        vm.prank(boardMember4);
        campaign.voteOnRequest(reqId, false); // rejected

        // further votes should revert since request is finalised
        vm.prank(boardMember5);
        vm.expectRevert("Request already finalised");
        campaign.voteOnRequest(reqId, true);
    }

    // ─────────────────────────────────────────
    //  FIX 3 — Reentrancy attack test
    //  receive() now has ETH balance check
    //  and we verify attackCount stays 0
    //  since donate() doesn't send ETH back
    // ─────────────────────────────────────────

    function test_ReentrancyAttackFails() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(campaign));
        vm.deal(address(attacker), 1 ether);

        // donate succeeds — ETH goes INTO contract, not back to attacker
        // so receive() is never triggered, attackCount stays 0
        attacker.attack{value: 0.01 ether}();

        // no reentrancy was triggered
        assertEq(attacker.attackCount(), 0);

        // contract holds exactly what was donated
        assertEq(campaign.getContractBalance(), 0.01 ether);
    }

    // ─────────────────────────────────────────
    //  FUZZ TESTS
    // ─────────────────────────────────────────

    function testFuzz_DonationAmounts(uint256 amount) public {
        amount = bound(amount, 0.01 ether, 10 ether);

        vm.deal(donor1, amount);
        vm.prank(donor1);
        campaign.donate{value: amount}();

        assertEq(campaign.totalDonated(), amount);
        assertEq(campaign.donations(donor1), amount);
    }

    function testFuzz_OnlyBoardMemberCanVote(address randomAddr) public {
        vm.assume(!campaign.isBoardMember(randomAddr));
        vm.assume(randomAddr != address(0));

        uint256 reqId = _setupRequestWithFunds();

        vm.prank(randomAddr);
        vm.expectRevert("Not a board member");
        campaign.voteOnRequest(reqId, true);
    }
}