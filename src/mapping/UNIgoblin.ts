import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import { UniswapGoblin, Reinvest, AddShare, RemoveShare, Liquidate } from "../../generated/UNIGoblin/UniswapGoblin";
import { StakingRewards } from "../../generated/UNIGoblin/StakingRewards";
import { Reinvest as ReinvestHistory, GoblinSummary, GoblinPosition } from "../../generated/schema";

export function handleReinvest(event: Reinvest): void {
  let reinvest = new ReinvestHistory(event.transaction.hash.toHexString());
  reinvest.caller = event.params.caller;
  reinvest.reward = event.params.reward;
  reinvest.bounty = event.params.bounty;
  reinvest.blockTime = event.block.timestamp;
  reinvest.goblin = event.address;
  reinvest.save();
  updateGoblinSummary(event.address);
}

export function handleAddShare(event: AddShare): void {
  let goblinPositionId = event.address.toHexString() + "-" + event.params.id.toHexString();
  let position = GoblinPosition.load(goblinPositionId);
  if (position == null) {
    position = new GoblinPosition(goblinPositionId);
    position.goblin = event.address;
    position.position = event.params.id;
    position.lpShare = BigInt.fromI32(0);
  }
  position.lpShare = position.lpShare.plus(event.params.share);
  position.save();
  updateGoblinSummary(event.address);
}

export function handleRemoveShare(event: RemoveShare): void {
  let goblinPositionId = event.address.toHexString() + "-" + event.params.id.toHexString();
  let position = GoblinPosition.load(goblinPositionId);
  if (position == null) {
    position = new GoblinPosition(goblinPositionId);
    position.goblin = event.address;
    position.position = event.params.id;
    position.lpShare = BigInt.fromI32(0);
  }
  position.lpShare = position.lpShare.minus(event.params.share);
  position.save();
  updateGoblinSummary(event.address);
}

export function handleLiquidate(event: Liquidate): void {
  updateGoblinSummary(event.address);
}

function updateGoblinSummary(goblinAddress: Address): void {
  let summary = GoblinSummary.load(goblinAddress.toHexString());
  if (summary == null) {
    summary = new GoblinSummary(goblinAddress.toHexString());
  }
  let goblin = UniswapGoblin.bind(goblinAddress);
  let staking = StakingRewards.bind(goblin.staking());
  summary.totalShare = goblin.totalShare();
  summary.totalLPToken = staking.balanceOf(goblinAddress);
  summary.save();
}
