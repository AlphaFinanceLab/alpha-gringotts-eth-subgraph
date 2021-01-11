import { BigInt, Address, ByteArray, ethereum, Bytes, log } from "@graphprotocol/graph-ts";
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
import { ibETHTransfer, Balance, BankSummary, Position, AlphaGlobal, UserLender, UserBorrower, UserRewardState } from "../../generated/schema";
import {
  LENDER_ALPHA_PER_SEC,
  BORROWER_ALPHA_PER_SEC,
  START_REWARD_BLOCKTIME,
  END_REWARD_BLOCKTIME,
} from "../../src/mapping/constant";
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
  updatePosition(event.address, event.params.id);
  let end = BigInt.fromI32(END_REWARD_BLOCKTIME);
  if (event.block.timestamp.gt(end)) {
    return
  }
  let global = AlphaGlobal.load("borrower");
  if (global == null) {
    global = new AlphaGlobal("borrower");
    global.multiplier = BigInt.fromI32(0);
    global.totalAccAlpha = BigInt.fromI32(0);
    global.totalShare = BigInt.fromI32(0);
    global.latestBlockTime = BigInt.fromI32(0);
  }
  global.multiplier = global.totalShare.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : global.multiplier.plus(
        calculateNewAlphaMultiplier(
          BigInt.fromUnsignedBytes(ByteArray.fromHexString(BORROWER_ALPHA_PER_SEC) as Bytes),
          global.latestBlockTime,
          global.totalShare,
          event.block.timestamp
        )
      );

  global.totalShare = updateBankSummary(event.address).totalDebtShare;
  global.latestBlockTime = event.block.timestamp;

  // Update user
  let position = Position.load(event.params.id.toString());
  let owner = position.owner.toHexString();
  let user = UserBorrower.load(owner);
  if (user == null) {
    user = new UserBorrower(owner);
    user.debtShare = BigInt.fromI32(0);
    user.latestAlphaMultiplier = BigInt.fromI32(0);
    user.accAlpha = BigInt.fromI32(0);
  }
  let pendingAlpha = global.multiplier.minus(user.latestAlphaMultiplier).times(user.debtShare);
  user.accAlpha = user.accAlpha.plus(pendingAlpha);
  global.totalAccAlpha = global.totalAccAlpha.plus(pendingAlpha);
  user.latestAlphaMultiplier = global.multiplier;
  user.debtShare = user.debtShare.plus(event.params.debtShare);
  user.blockTime = event.block.timestamp;
  global.save();
  user.save();

  log.info("outside store state (add): {}", [user.id + "-" + event.block.number.toString()])
  storeUserRewardState(user as UserBorrower, global as AlphaGlobal, event.transaction.hash, event.block.number)
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
  updatePosition(event.address, event.params.id);
  let end = BigInt.fromI32(END_REWARD_BLOCKTIME);
  if (event.block.timestamp.gt(end)) {
    return
  }
  let global = AlphaGlobal.load("borrower");
  if (global == null) {
    global = new AlphaGlobal("borrower");
    global.multiplier = BigInt.fromI32(0);
    global.totalAccAlpha = BigInt.fromI32(0);
    global.totalShare = BigInt.fromI32(0);
    global.latestBlockTime = BigInt.fromI32(0);
  }
  global.multiplier = global.totalShare.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : global.multiplier.plus(
        calculateNewAlphaMultiplier(
          BigInt.fromUnsignedBytes(ByteArray.fromHexString(BORROWER_ALPHA_PER_SEC) as Bytes),
          global.latestBlockTime,
          global.totalShare,
          event.block.timestamp
        )
      );
  global.totalShare = updateBankSummary(event.address).totalDebtShare;
  global.latestBlockTime = event.block.timestamp;

  // Update user
  let position = Position.load(event.params.id.toString());
  let owner = position.owner.toHexString();
  let user = UserBorrower.load(owner);
  if (user == null) {
    user = new UserBorrower(owner);
    user.debtShare = BigInt.fromI32(0);
    user.latestAlphaMultiplier = BigInt.fromI32(0);
    user.accAlpha = BigInt.fromI32(0);
  }
  let pendingAlpha = global.multiplier.minus(user.latestAlphaMultiplier).times(user.debtShare);
  user.accAlpha = user.accAlpha.plus(pendingAlpha);
  global.totalAccAlpha = global.totalAccAlpha.plus(pendingAlpha);
  user.latestAlphaMultiplier = global.multiplier;
  user.debtShare = user.debtShare.minus(event.params.debtShare);
  user.blockTime = event.block.timestamp;
  global.save();
  user.save()

  log.info("outside store state (remove): {}", [user.id + "-" + event.block.number.toString()])
  storeUserRewardState(user as UserBorrower, global as AlphaGlobal, event.transaction.hash, event.block.number)
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

  // Update user
  let userAddresses: Address[];
  if (event.params.from.equals(Address.fromString("0x0000000000000000000000000000000000000000"))) {
    if (event.params.to !== null) {
      userAddresses.push(event.params.to);
    }
  } else if (event.params.to.equals(Address.fromString("0x0000000000000000000000000000000000000000"))) {
    if (event.params.from !== null) {
      userAddresses.push(event.params.from);
    }
  } else {
    if (event.params.from !== null) {
      userAddresses.push(event.params.from);
    }
    if (event.params.to !== null) {
      userAddresses.push(event.params.to);
    }
  }

  // Update Alpha rewards Global
  let global = AlphaGlobal.load("lender");
  if (global == null) {
    global = new AlphaGlobal("lender");
    global.multiplier = BigInt.fromI32(0);
    global.totalAccAlpha = BigInt.fromI32(0);
    global.totalShare = BigInt.fromI32(0);
    global.latestBlockTime = BigInt.fromI32(0);
  }
  global.multiplier = global.totalShare.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : global.multiplier.plus(
        calculateNewAlphaMultiplier(
          BigInt.fromUnsignedBytes(ByteArray.fromHexString(LENDER_ALPHA_PER_SEC) as Bytes),
          global.latestBlockTime,
          global.totalShare,
          event.block.timestamp
        )
      );

  for (let index = 0; index < userAddresses.length; index++) {
    let userAddress = userAddresses[index];
    let user = UserLender.load(userAddress.toHexString());
    if (user == null) {
      user = new UserLender(userAddress.toHexString());
      user.latestAlphaMultiplier = BigInt.fromI32(0);
      user.ibETH = BigInt.fromI32(0);
      user.accAlpha = BigInt.fromI32(0);
    }

    let pendingAlpha = global.multiplier.minus(user.latestAlphaMultiplier).times(user.ibETH);
    user.accAlpha = user.accAlpha.plus(pendingAlpha);
    user.latestAlphaMultiplier = global.multiplier;
    user.blockTime = event.block.timestamp;

    if (
      event.params.from.equals(Address.fromString("0x0000000000000000000000000000000000000000")) && // mint event
      event.params.to.equals(userAddress)
    ) {
      global.totalShare = global.totalShare.plus(transfer.value);
      user.ibETH = user.ibETH.plus(transfer.value);
    } else if (
      event.params.from.equals(userAddress) &&
      event.params.to.equals(Address.fromString("0x0000000000000000000000000000000000000000")) // burn event
    ) {
      global.totalShare = global.totalShare.minus(transfer.value);
      user.ibETH = user.ibETH.minus(transfer.value);
    } else { // transfer event
      if (event.params.to.equals(userAddress)) {
        user.ibETH = user.ibETH.plus(transfer.value);
      } else if (event.params.from.equals(userAddress)) {
        user.ibETH = user.ibETH.minus(transfer.value);
      }
    }
    global.totalAccAlpha = global.totalAccAlpha.plus(pendingAlpha);
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
    summary.reservePool = BigInt.fromI32(0);
  }
  let bank = Bank.bind(bankAddress);
  summary.ibETHSupply = bank.totalSupply()
  summary.totalETH = bank.totalETH()
  summary.totalDebtShare = bank.glbDebtShare()
  summary.totalDebtValue = bank.glbDebtVal()
  summary.totalPosition = bank.nextPositionID().minus(BigInt.fromI32(1))
  summary.reservePool = bank.reservePool()
  summary.save()
  return summary as BankSummary;
}

function updatePosition(bankAddress: Address, positionId: BigInt): void {
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
}

function calculateNewAlphaMultiplier(
  alphaPerSec: BigInt,
  globalLatestedBlockTime: BigInt,
  globalTotalShare: BigInt,
  blockTime: BigInt
): BigInt {
  let start = BigInt.fromI32(START_REWARD_BLOCKTIME);
  let end = BigInt.fromI32(END_REWARD_BLOCKTIME);
  let cappedBlockTime = min(end, max(start, blockTime));
  let cappedGlobalLatestBlockTime = min(end, max(start, globalLatestedBlockTime));
  return globalTotalShare.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : alphaPerSec
        .times(cappedBlockTime.minus(cappedGlobalLatestBlockTime))
        .times(BigInt.fromI32(10).pow(32))
        .div(globalTotalShare);
}

function min(a: BigInt, b: BigInt): BigInt {
  if (a.lt(b)) {
    return a
  } else {
    return b
  }
}

function max(a: BigInt, b: BigInt): BigInt {
  if (a.gt(b)) {
    return a;
  } else {
    return b;
  }
}

function storeUserRewardState(userBorrower: UserBorrower, alphaGlobal: AlphaGlobal, txHash: Bytes, blockNumber: BigInt): void {
  let state = new UserRewardState(userBorrower.id + "-" + blockNumber.toString())
  state.user = Address.fromHexString(userBorrower.id) as Bytes
  state.txHash = txHash
  state.accAlpha = userBorrower.accAlpha
  state.latestAlphaMultiplier = userBorrower.latestAlphaMultiplier
  state.debtShare = userBorrower.debtShare
  state.blockTime = userBorrower.blockTime
  state.alphaGlobalTotalAccAlpha = alphaGlobal.totalAccAlpha
  state.alphaGlobalTotalShare = alphaGlobal.totalShare
  state.alphaGlobalMultiplier = alphaGlobal.multiplier
  state.alphaGlobalLatestBlockTime = alphaGlobal.latestBlockTime
  state.save()
}