import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts"
import {
  Bank,
  AddDebt,
  Work,
  Approval,
  Kill,
  OwnershipTransferred,
  RemoveDebt,
  Transfer
} from "../../generated/Bank/Bank"
import { ibETHTransfer, Balance, BankSummary, Position, AlphaGlobal, UserLender, UserBorrower } from "../../generated/schema";
import { LENDER_ALPHA_PER_SEC, BORROWER_ALPHA_PER_SEC, START_REWARD_BLOCKTIME } from "../../src/mapping/constant";
import { log } from "@graphprotocol/graph-ts";
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

export function handleAddDebt(event: AddDebt) : void {
  let global = AlphaGlobal.load("borrower");
  if (global == null) {
    global = new AlphaGlobal("borrower");
    global.multiplier = BigInt.fromI32(0);
    global.totalShare = BigInt.fromI32(0);
    global.latestBlockTime = BigInt.fromI32(0);
  }
  global.multiplier = global.multiplier.plus(BigInt.fromI32(1));
  global.multiplier = global.totalShare.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : global.multiplier.plus(
        calculateNewAlphaMultiplier(
          BigInt.fromI32(BORROWER_ALPHA_PER_SEC),
          global.latestBlockTime,
          global.totalShare,
          event.block.timestamp
        )
      );
  let userDebtShare = updatePosition(event.address, event.params.id);
  let newTotalDebtShare = updateBankSummary(event.address).totalDebtShare;
  global.totalShare = newTotalDebtShare.minus(userDebtShare);
  global.latestBlockTime = event.block.timestamp;
  global.save();

  // Update user
  let user = UserBorrower.load(event.transaction.from.toHexString());
  if (user == null) {
    user = new UserBorrower(event.transaction.from.toHexString());
    user.debtShare = BigInt.fromI32(0);
    user.latestAlphaMultiplier = BigInt.fromI32(0);
  }
  if (user.latestAlphaMultiplier.equals(BigInt.fromI32(0)) && event.block.timestamp > BigInt.fromI32(START_REWARD_BLOCKTIME)) {
    user.latestAlphaMultiplier = global.multiplier;
  }
  user.debtShare = user.debtShare.plus(userDebtShare);
  user.save()
}

export function handleWork(event: Work): void {
  updatePosition(event.address, event.params.id);
  updateBankSummary(event.address);
}

export function handleApproval(event: Approval): void { }

export function handleKill(event: Kill): void { 
  updatePosition(event.address, event.params.id);
  updateBankSummary(event.address);
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void { }

export function handleRemoveDebt(event: RemoveDebt): void {
  let global = AlphaGlobal.load("borrower");
  if (global == null) {
    global = new AlphaGlobal("borrower");
    global.multiplier = BigInt.fromI32(0);
    global.totalShare = BigInt.fromI32(0);
    global.latestBlockTime = BigInt.fromI32(0);
  }
  // global.multiplier = global.multiplier.plus(BigInt.fromI32(1));
  global.multiplier = global.totalShare.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : global.multiplier.plus(
        calculateNewAlphaMultiplier(BigInt.fromI32(BORROWER_ALPHA_PER_SEC) ,global.latestBlockTime, global.totalShare, event.block.timestamp)
      );
  let userDebtShare = updatePosition(event.address, event.params.id);
  let newTotalDebtShare = updateBankSummary(event.address).totalDebtShare;
  global.totalShare = newTotalDebtShare.plus(userDebtShare);
  global.latestBlockTime = event.block.timestamp;
  global.save();

  // Update user
  let user = UserBorrower.load(event.transaction.from.toHexString());
  if (user == null) {
    user = new UserBorrower(event.transaction.from.toHexString());
    user.debtShare = BigInt.fromI32(0);
    user.latestAlphaMultiplier = BigInt.fromI32(0);
  }
  if (user.latestAlphaMultiplier.equals(BigInt.fromI32(0)) && event.block.timestamp > BigInt.fromI32(START_REWARD_BLOCKTIME)) {
    user.latestAlphaMultiplier = global.multiplier;
  }
  user.debtShare = user.debtShare.plus(userDebtShare);
  user.save()
}

export function handleTransfer(event: Transfer): void {
  let transactionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toHexString()
  let transfer = new ibETHTransfer(transactionId)

  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.value = event.params.value
  transfer.save()

  // update sender account balance
  let sender = Balance.load(event.params.from.toHexString())
  if (sender == null) {
    sender = new Balance(event.params.from.toHexString())
    sender.amount = BigInt.fromI32(0)
  }
  sender.amount = sender.amount.minus(transfer.value)
  sender.save()

  // update recipient account balance
  let recipient = Balance.load(event.params.to.toHexString())
  if (recipient == null) {
    recipient = new Balance(event.params.to.toHexString())
    recipient.amount = BigInt.fromI32(0)
  }
  recipient.amount = recipient.amount.plus(transfer.value)
  recipient.save()

  // Update Alpha rewards Global
  if (
    event.params.from.equals(Address.fromString("0x0000000000000000000000000000000000000000")) ||
    event.params.to.equals(Address.fromString("0x0000000000000000000000000000000000000000"))
  ) {
    let global = AlphaGlobal.load("lender");
    if (global == null) {
      global = new AlphaGlobal("lender");
      global.multiplier = BigInt.fromI32(0);
      global.totalShare = BigInt.fromI32(0);
      global.latestBlockTime = BigInt.fromI32(0);
    }
    global.multiplier = global.totalShare.equals(BigInt.fromI32(0))
      ? BigInt.fromI32(0)
      : global.multiplier.plus(
          calculateNewAlphaMultiplier(
            BigInt.fromI32(LENDER_ALPHA_PER_SEC),
            global.latestBlockTime,
            global.totalShare,
            event.block.timestamp
          )
        );

    // Update user
    let userAddress: Address;
    if (event.params.from.equals(Address.fromString("0x0000000000000000000000000000000000000000"))) {
      if (event.params.to !== null) {
        userAddress = event.params.to as Address;
      }
    } else {
      if (event.params.from !== null) {
        userAddress = event.params.from as Address;
      }
    }
    
    let user = UserLender.load(userAddress.toHexString());
    if (user == null) {
      user = new UserLender(userAddress.toHexString());
      user.latestAlphaMultiplier = BigInt.fromI32(0);
      user.ibETH = BigInt.fromI32(0);
    }

    if (
      user.latestAlphaMultiplier.equals(BigInt.fromI32(0)) &&
      event.block.timestamp > BigInt.fromI32(START_REWARD_BLOCKTIME)
    ) {
      user.latestAlphaMultiplier = global.multiplier;
    }

    if (event.params.from.equals(Address.fromString("0x0000000000000000000000000000000000000000"))) {
      // Mint token
      global.totalShare = global.totalShare.plus(transfer.value);
      user.ibETH = user.ibETH.plus(transfer.value);
    } else {
      // Burn Token
      global.totalShare = global.totalShare.minus(transfer.value);
      user.ibETH = user.ibETH.minus(transfer.value);
    }
    global.latestBlockTime = event.block.timestamp;
    global.save();
    user.save();
  }
  updateBankSummary(event.address);
}

function updateBankSummary(bankAddress: Address): BankSummary {
  let summary = BankSummary.load("Gringotts")
  if (summary == null) {
    summary = new BankSummary("Gringotts")
    summary.ibETHSupply = BigInt.fromI32(0);
    summary.totalETH = BigInt.fromI32(0);
    summary.totalDebtShare = BigInt.fromI32(0);
    summary.totalDebtValue = BigInt.fromI32(0);
    summary.totalPosition = BigInt.fromI32(0);
  }
  let bank = Bank.bind(bankAddress);
  summary.ibETHSupply = bank.totalSupply()
  summary.totalETH = bank.totalETH()
  summary.totalDebtShare = bank.glbDebtShare()
  summary.totalDebtValue = bank.glbDebtVal()
  summary.totalPosition = bank.nextPositionID().minus(BigInt.fromI32(1))
  summary.save()
  return summary as BankSummary;
}

function updatePosition(bankAddress: Address, positionId: BigInt): BigInt {
  let id = positionId.toString()
  let position = Position.load(id)
  if (position == null) {
    position = new Position(id)
    position.debtShare = BigInt.fromI32(0)
  }
  let bank = Bank.bind(bankAddress);
  let result = bank.positions(positionId)
  position.goblin = result.value0
  position.owner = result.value1
  position.debtShare = result.value2
  position.save()
  return position.debtShare;
}

function calculateNewAlphaMultiplier(
  alphaPerSec: BigInt,
  globalLatestedBlockTime: BigInt,
  globalTotalShare: BigInt,
  blockTime: BigInt
): BigInt {
  return globalTotalShare.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : alphaPerSec
        .times(blockTime.minus(globalLatestedBlockTime))
        .times(BigInt.fromI32(10).pow(18))
        .div(globalTotalShare);
}