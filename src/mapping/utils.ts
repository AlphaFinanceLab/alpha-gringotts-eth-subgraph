import { BigInt } from "@graphprotocol/graph-ts"

export function sqrt(x :BigInt): BigInt {
  let z = (x.plus(BigInt.fromI32(1)).div(BigInt.fromI32(2)))
  let y = x
  while (z.lt(y)) {
    y = z
    // z = (x / z + z) / 2;
    z = x.div(z.plus(z)).div(BigInt.fromI32(2))
  }
  return y
}