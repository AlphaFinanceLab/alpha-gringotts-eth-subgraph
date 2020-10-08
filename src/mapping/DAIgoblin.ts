import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts"
import {
  UniswapGoblin,
  Reinvest,
  AddShare,
  RemoveShare,
  Liquidate
} from "../../generated/DAIGoblin/UniswapGoblin"
import { Reinvest as ReinvestHistory } from "../../generated/schema"

export function handleReinvest(event: Reinvest): void {
  let goblin = UniswapGoblin.bind(event.address);
  let reinvestBps = goblin.reinvestBountyBps();
  let reinvest = new ReinvestHistory(event.transaction.hash.toHexString())
  reinvest.caller = event.params.caller
  reinvest.reward = event.params.reward
  reinvest.bounty = reinvest.reward.times(reinvestBps).div(BigInt.fromI32(100))
  reinvest.blockTime = event.block.timestamp;
  reinvest.goblin = event.address;
  reinvest.save()
}

export function handleAddShare(event: AddShare): void {}

export function handleRemoveShare(event: RemoveShare): void {}

export function handleLiquidate(event: Liquidate): void {}
