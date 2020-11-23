import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import {
  SushiswapGoblin,
  Reinvest,
  AddShare,
  RemoveShare,
  Liquidate,
} from "../../generated/SushiETHDAIGoblin/SushiswapGoblin";
import { MasterChef } from "../../generated/SushiETHLINKGoblin/MasterChef";
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
  let goblin = SushiswapGoblin.bind(goblinAddress);
  let masterChef = MasterChef.bind(goblin.masterChef());
  summary.totalShare = goblin.totalShare();
  let poolID = BigInt.fromI32(13);
  let result = masterChef.userInfo(poolID, goblinAddress);
  summary.totalLPToken = result.value0; // lpToken amount
  summary.save();
}
