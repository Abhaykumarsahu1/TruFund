// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Campaign.sol";

contract CampaignFactory {

    // ─────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────

    address[] public deployedCampaigns;  // list of all campaign contract addresses
    
    // campaigner address → their campaign addresses
    mapping(address => address[]) public campaignerToCampaigns;
    
    // campaign address → exists (for quick lookup)
    mapping(address => bool) public isCampaign;

    // ─────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────

    event CampaignCreated(
        address indexed campaignAddress,
        address indexed campaigner,
        string  title,
        uint256 goalAmount,
        uint256 deadline
    );

    // ─────────────────────────────────────────
    //  CREATE CAMPAIGN
    // ─────────────────────────────────────────

    /**
     * @dev Deploys a new Campaign contract and registers it.
     *      Called by the campaigner from the frontend.
     *      msg.sender becomes the campaigner of that campaign.
     */
    function createCampaign(
        string  memory   _title,
        string  memory   _description,
        string  memory   _ipfsHash,
        uint256          _goalAmount,
        uint256          _deadline,
        address[] memory _boardMembers
    ) external returns (address) {
        // deploy a fresh Campaign contract
        Campaign newCampaign = new Campaign(
            msg.sender,     // campaigner
            _title,
            _description,
            _ipfsHash,
            _goalAmount,
            _deadline,
            _boardMembers
        );

        address campaignAddress = address(newCampaign);

        // register it
        deployedCampaigns.push(campaignAddress);
        campaignerToCampaigns[msg.sender].push(campaignAddress);
        isCampaign[campaignAddress] = true;

        emit CampaignCreated(
            campaignAddress,
            msg.sender,
            _title,
            _goalAmount,
            _deadline
        );

        return campaignAddress;
    }

    // ─────────────────────────────────────────
    //  VIEW HELPERS
    // ─────────────────────────────────────────

    /// @dev Returns all deployed campaign addresses (for donor dashboard)
    function getAllCampaigns() external view returns (address[] memory) {
        return deployedCampaigns;
    }

    /// @dev Returns all campaigns created by a specific campaigner
    function getCampaignsByCampaigner(address _campaigner)
        external
        view
        returns (address[] memory)
    {
        return campaignerToCampaigns[_campaigner];
    }

    /// @dev Total number of campaigns ever created
    function getTotalCampaigns() external view returns (uint256) {
        return deployedCampaigns.length;
    }
}