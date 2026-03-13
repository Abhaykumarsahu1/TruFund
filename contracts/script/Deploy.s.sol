// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CampaignFactory.sol";

contract DeployTruFund is Script {

    function run() external {

        // reads PRIVATE_KEY from .env file
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // start broadcasting transactions to the network
        vm.startBroadcast(deployerPrivateKey);

        // deploy CampaignFactory — this is the only contract
        // we deploy manually. Campaign contracts are deployed
        // automatically by the factory when campaigners register.
        CampaignFactory factory = new CampaignFactory();

        console.log("CampaignFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}