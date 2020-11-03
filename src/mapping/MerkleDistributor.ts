import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import { MerkleDistributor, Claimed as ClaimedEvent } from "../../generated/MerkleDistributor/MerkleDistributor";
import { Claimed } from "../../generated/schema"

export function handleClaimed(event: ClaimedEvent): void {
         let claimedId = event.params.account.toHexString();
         let claimed = Claimed.load(claimedId);
         if (claimed == null) {
           claimed = new Claimed(claimedId);
           claimed.index = event.params.index;
           claimed.account = event.params.account;
           claimed.amount = event.params.amount;
         }
         claimed.save();
       }
