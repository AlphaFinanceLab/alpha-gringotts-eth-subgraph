import { BigInt } from "@graphprotocol/graph-ts"
import {
  Gringotts,
  AddDebt,
  Alohomora,
  Approval,
  Kedavra,
  OwnershipTransferred,
  RemoveDebt,
  Transfer
} from "../generated/Gringotts/Gringotts"
import { GETHTransfer } from "../generated/schema"

/* export function handleAddDebt(event: AddDebt): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = ExampleEntity.load(event.transaction.from.toHex())
  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (entity == null) {
    entity = new ExampleEntity(event.transaction.from.toHex())
    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0)
  }
  // BigInt and BigDecimal math are supported
  entity.count = entity.count + BigInt.fromI32(1)
  // Entity fields can be set based on event parameters
  entity.id = event.params.id
  entity.debtShare = event.params.debtShare
  // Entities can be written to the store with `.save()`
  entity.save()
  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.
  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.allowance(...)
  // - contract.approve(...)
  // - contract.balanceOf(...)
  // - contract.config(...)
  // - contract.decimals(...)
  // - contract.decreaseAllowance(...)
  // - contract.glbDebtShare(...)
  // - contract.glbDebtVal(...)
  // - contract.increaseAllowance(...)
  // - contract.isOwner(...)
  // - contract.lastAccrueTime(...)
  // - contract.name(...)
  // - contract.nextPositionID(...)
  // - contract.owner(...)
  // - contract.positions(...)
  // - contract.reservePool(...)
  // - contract.symbol(...)
  // - contract.totalSupply(...)
  // - contract.transfer(...)
  // - contract.transferFrom(...)
  // - contract.pendingInterest(...)
  // - contract.debtShareToVal(...)
  // - contract.debtValToShare(...)
  // - contract.positionInfo(...)
  // - contract.totalETH(...)
} */

export function handleAlohomora(event: Alohomora): void { }

export function handleApproval(event: Approval): void { }

export function handleKedavra(event: Kedavra): void { }

export function handleOwnershipTransferred(event: OwnershipTransferred): void { }

export function handleRemoveDebt(event: RemoveDebt): void { }

export function handleTransfer(event: Transfer): void {
  let transactionHash = event.transaction.hash.toHexString()
  let transfer = new GETHTransfer(transactionHash)

  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.value = event.params.value
  transfer.save()
}