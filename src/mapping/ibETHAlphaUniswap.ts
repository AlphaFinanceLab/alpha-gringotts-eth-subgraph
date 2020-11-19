import { BigInt, Address, ByteArray, ethereum, Bytes, log } from "@graphprotocol/graph-ts";

import {
  UniswapV2Pair,
  Mint,
  Burn
} from "../../generated/ibETHAlphaUniswap/UniswapV2Pair"

import { UserIbETHAlphaLiquidity, MintIbETHAlphaLP, BurnIbETHAlphaLP } from "../../generated/schema";

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