import { BigInt, Address, ByteArray, ethereum, Bytes, log } from "@graphprotocol/graph-ts";

import {
  UniswapV2Pair,
  Mint,
  Burn,
  Swap,
  Sync
} from "../../generated/ibETHAlphaUniswap/UniswapV2Pair"

import { UserIbETHAlphaLiquidity, MintIbETHAlphaLP, BurnIbETHAlphaLP, AlphaTradingGlobal, AlphaTrading } from "../../generated/schema";

import { sqrt } from "./utils"

export function handleMint(event: Mint) : void {
  let mint = new MintIbETHAlphaLP(event.transaction.hash.toHexString())
  mint.user = event.transaction.from
  mint.sender = event.params.sender
  mint.amount0 = event.params.amount0
  mint.amount1 = event.params.amount1
  mint.save()

  let user = event.transaction.from.toHexString()
  let userLiquidity = UserIbETHAlphaLiquidity.load(user)
  if (userLiquidity == null) {
    userLiquidity = new UserIbETHAlphaLiquidity(user)
    userLiquidity.ibETHStarting = BigInt.fromI32(0);
    userLiquidity.alphaStarting = BigInt.fromI32(0);
    userLiquidity.ibETHAccGain = BigInt.fromI32(0);
    userLiquidity.alphaAccGain = BigInt.fromI32(0);
  }
  log.info("mint user", [userLiquidity.ibETHStarting.toString(), userLiquidity.alphaStarting.toString(), userLiquidity.ibETHAccGain.toString(), userLiquidity.alphaAccGain.toString()])
  
  // token0 is ibETH token
  // token1 is Alpha token
  userLiquidity.ibETHStarting = userLiquidity.ibETHStarting.plus(event.params.amount0)
  userLiquidity.alphaStarting = userLiquidity.alphaStarting.plus(event.params.amount1)
  userLiquidity.save()
}

export function handleBurn(event: Burn) : void {
  let burn = new BurnIbETHAlphaLP(event.transaction.hash.toHexString())
  burn.user = event.transaction.from
  burn.sender = event.params.sender
  burn.amount0 = event.params.amount0
  burn.amount1 = event.params.amount1
  burn.to = event.params.to
  burn.save()

  let user = event.transaction.from.toHexString()
  let userLiquidity = UserIbETHAlphaLiquidity.load(user)
  if (userLiquidity == null) {
    userLiquidity = new UserIbETHAlphaLiquidity(user)
    userLiquidity.ibETHStarting = BigInt.fromI32(0);
    userLiquidity.alphaStarting = BigInt.fromI32(0);
    userLiquidity.ibETHAccGain = BigInt.fromI32(0);
    userLiquidity.alphaAccGain = BigInt.fromI32(0);
  }

  log.info("user burn", [userLiquidity.ibETHStarting.toString(), userLiquidity.alphaStarting.toString(), userLiquidity.ibETHAccGain.toString(), userLiquidity.alphaAccGain.toString()])
  
  // token0 is ibETH token
  // token1 is Alpha token
  userLiquidity.ibETHAccGain = userLiquidity.ibETHAccGain.plus(event.params.amount0)
  userLiquidity.alphaAccGain = userLiquidity.alphaAccGain.plus(event.params.amount1)
  userLiquidity.save()
}

export function handleSwap(event: Swap) : void {

  // // Update alpha trading (global)
  // let tradingGlobal = AlphaTradingGlobal.load("global")
  // if (tradingGlobal == null) {
  //   tradingGlobal = new AlphaTradingGlobal("global")
  //   tradingGlobal.accMultiplier = BigInt.fromI32(0);
  //   tradingGlobal.reserve0 = BigInt.fromI32(0);
  //   tradingGlobal.reserve1 = BigInt.fromI32(0);
  //   tradingGlobal.latestBlockTime = BigInt.fromI32(0);
  // }
  // tradingGlobal.accMultiplier =  BigInt.fromI32(0);// implement square root
  // // update all state
}

export function handleSync(event: Sync): void {
  let blockTimeStamp = event.block.timestamp
  let reserve0 = event.params.reserve0
  let reserve1 = event.params.reserve1

  // Load global trading
  let tradingGlobal = AlphaTradingGlobal.load("global")
  if (tradingGlobal == null) {
    tradingGlobal = new AlphaTradingGlobal("global")
    tradingGlobal.accMultiplier = BigInt.fromI32(1);
    tradingGlobal.reserve0 = BigInt.fromI32(0);
    tradingGlobal.reserve1 = BigInt.fromI32(0);
    tradingGlobal.latestBlockTime = BigInt.fromI32(0);
  }
  // Update alpha trading (global)
  tradingGlobal.reserve0 = reserve0
  tradingGlobal.reserve1 = reserve1
  tradingGlobal.latestBlockTime = blockTimeStamp

  // Update alpha trading
  let product = sqrt(reserve0.times(reserve1))
  // acc multiplier
  // |--------------------|--------------------|--------------------|--------------------|
  // sqrt(product) = 100  sqrt(product) = 110  sqrt(product) = 120  sqrt(product) = 130  sqrt(product) = 140
  //                     1.1x                 1.1x                  |-- accumulate multiplier = (130/120) * 1.1x
  let accMultiplier = product.times(tradingGlobal.accMultiplier).div(tradingGlobal.reserve0.times(tradingGlobal.reserve1))
  let trading = AlphaTrading.load(blockTimeStamp)
  if (trading == null) {
    trading = new AlphaTrading(blockTimeStamp)
    trading.blockNumber = BigInt.fromI32(0)
    trading.accMultiplier = BigInt.fromI32(0)
  }
  trading.blockNumber = event.block.blockNumber
  trading.accMultiplier = accMultiplier
  trading.save()

  tradingGlobal.accMultiplier =  accMultiplier// implement square root
  tradingGlobal.save()
}

