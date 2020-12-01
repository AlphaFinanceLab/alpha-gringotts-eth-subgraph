import { BigInt, Address, ByteArray, ethereum, Bytes, log } from "@graphprotocol/graph-ts";

import {
  UniswapV2Pair,
  Mint,
  Burn,
  Swap,
  Sync
} from "../../generated/ibETHAlphaUniswap/UniswapV2Pair"

import { UserIbETHAlphaLiquidity, MintIbETHAlphaLP, BurnIbETHAlphaLP, AlphaTradingGlobal, AlphaTrading } from "../../generated/schema";

import { decimalMultiplier } from './constant'

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

export function handleSync(event: Sync): void {
  let blockTimeStamp = event.block.timestamp
  let reserve0 = event.params.reserve0
  let reserve1 = event.params.reserve1
  log.info("blockTimeStamp: {}, reserve0: {}, reserve1: {}", [blockTimeStamp.toString(), reserve0.toString(), reserve1.toString()])

  // Load global trading
  let tradingGlobal = AlphaTradingGlobal.load("global")
  if (tradingGlobal == null) {
    tradingGlobal = new AlphaTradingGlobal("global")
    tradingGlobal.accMultiplier = BigInt.fromI32(10).pow(18);
    tradingGlobal.reserve0 = BigInt.fromI32(0);
    tradingGlobal.reserve1 = BigInt.fromI32(0);
    tradingGlobal.latestBlockTime = BigInt.fromI32(0);
  }

  // Update alpha trading
  let currentProduct = sqrt(reserve0.times(reserve1))
  let previousProduct = sqrt(tradingGlobal.reserve0.times(tradingGlobal.reserve1))
  // acc multiplier
  // |--------------------|--------------------|--------------------|--------------------|
  // sqrt(product) = 100  sqrt(product) = 110  sqrt(product) = 120  sqrt(product) = 130  sqrt(product) = 140
  //                     1.1x                 1.1x                  |-- accumulate multiplier = (130/120) * 1.1x
  log.info("previous product: {}", [previousProduct.toString()])
  let accMultiplier;
  if (reserve0.gt(tradingGlobal.reserve0) && reserve1.gt(tradingGlobal.reserve1)) { // mint
    accMultiplier = tradingGlobal.accMultiplier // use the previous swap multiplier
  } else if (reserve0.lt(tradingGlobal.reserve0) && reserve1.lt(tradingGlobal.reserve1)) { // burn
    accMultiplier = tradingGlobal.accMultiplier // use the previous swap multiplier
  } else { // swap
    // if (event.transaction.from.equals(Address.fromString("0x9ab92ea9bdb93854ffd4bff317d3daf22b00e7d5"))) {
    //   accMultiplier = previousProduct.notEqual(BigInt.fromI32(0)) ? currentProduct.times(tradingGlobal.accMultiplier).div(previousProduct) : BigInt.fromI32(10).pow(18);
    // } else {
    //   accMultiplier = tradingGlobal.accMultiplier
    // }
    accMultiplier = previousProduct.notEqual(BigInt.fromI32(0)) ? currentProduct.times(tradingGlobal.accMultiplier).div(previousProduct) : BigInt.fromI32(10).pow(18);
  }
  log.info("accMultiplier: {}, previousProduct: {}, currentProduct: {}, tradingGlobal.accMultiplier: {}", [accMultiplier.toString(), previousProduct.toString(), currentProduct.toString(), tradingGlobal.accMultiplier.toString()])
  let day = blockTimeStamp.div(BigInt.fromI32(86400)).toString()
  log.info("day: {}", [day])
  let trading = AlphaTrading.load(day.toString())
  if (trading == null) {
    trading = new AlphaTrading(day.toString())
    trading.blockNumber = BigInt.fromI32(0)
    trading.accMultiplier = BigInt.fromI32(0)
  }
  trading.reserve0 = reserve0
  trading.reserve1 = reserve1
  trading.blockNumber = event.block.number
  trading.accMultiplier = accMultiplier
  trading.user = event.transaction.from
  trading.save()

  // Update alpha trading (global)
  tradingGlobal.reserve0 = reserve0
  tradingGlobal.reserve1 = reserve1
  tradingGlobal.latestBlockTime = blockTimeStamp
  tradingGlobal.accMultiplier =  accMultiplier
  tradingGlobal.save()
}

