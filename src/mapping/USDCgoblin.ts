import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts"
import {
  UniswapGoblin,
  Reinvest,
  AddShare,
  RemoveShare,
  Liquidate
} from "../../generated/USDCGoblin/UniswapGoblin"
import { Reinvest as ReinvestHistory } from "../../generated/schema"

export function handleReinvest(event: Reinvest): void {
  let reinvest = new ReinvestHistory(event.transaction.hash.toHexString())
  reinvest.caller = event.params.caller
  reinvest.reward = event.params.reward
  reinvest.bounty = event.params.bounty
  reinvest.blockTime = event.block.timestamp;
  reinvest.goblin = event.address;
  reinvest.save()
}

export function handleAddShare(event: AddShare): void { }

export function handleRemoveShare(event: RemoveShare): void { }

export function handleLiquidate(event: Liquidate): void { }
