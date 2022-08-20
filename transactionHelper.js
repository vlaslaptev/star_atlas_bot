import web3 from "@solana/web3.js"
import atlas from "@staratlas/factory/dist/score.js"
import {AMMUNITION_TOKEN_MINT, FOOD_TOKEN_MINT, FUEL_TOKEN_MINT, SCORE_PROGRAM_ID, TOOLKIT_TOKEN_MINT} from "./tokenMints.js"
import {getTokenPublicKey} from "./utils.js"

export async function sendTransaction(txInstruction, keypair, connection) {
    const tx = new web3.Transaction().add(txInstruction)
    const res = await connection.sendTransaction(tx, [keypair])
    console.log("send tx", res)
}

export async function getTxInstructionFood(scoreVarsShipInfo, stakingInfo, connection, userPublicKey, tokenAccountInfo) {
    return await atlas.createRefeedInstruction(
        connection, userPublicKey, userPublicKey, scoreVarsShipInfo.foodMaxReserve * stakingInfo.shipQuantityInEscrow,
        stakingInfo.shipMint,
        new web3.PublicKey(FOOD_TOKEN_MINT),
        getTokenPublicKey(FOOD_TOKEN_MINT, tokenAccountInfo),
        SCORE_PROGRAM_ID
    )
}

export async function getTxInstructionFuel(scoreVarsShipInfo, stakingInfo, connection, userPublicKey, tokenAccountInfo) {
    return await atlas.createRefuelInstruction(
        connection, userPublicKey, userPublicKey, scoreVarsShipInfo.fuelMaxReserve * stakingInfo.shipQuantityInEscrow,
        stakingInfo.shipMint,
        new web3.PublicKey(FUEL_TOKEN_MINT),
        getTokenPublicKey(FUEL_TOKEN_MINT, tokenAccountInfo),
        SCORE_PROGRAM_ID
    )
}

export async function getTxInstructionToolkit(scoreVarsShipInfo, stakingInfo, connection, userPublicKey, tokenAccountInfo) {
    return await atlas.createRepairInstruction(
        connection, userPublicKey, userPublicKey, scoreVarsShipInfo.toolkitMaxReserve * stakingInfo.shipQuantityInEscrow,
        stakingInfo.shipMint,
        new web3.PublicKey(TOOLKIT_TOKEN_MINT),
        getTokenPublicKey(TOOLKIT_TOKEN_MINT, tokenAccountInfo),
        SCORE_PROGRAM_ID
    )
}

export async function getTxInstructionAmmunition(scoreVarsShipInfo, stakingInfo, connection, userPublicKey, tokenAccountInfo) {
    return await atlas.createRearmInstruction(
        connection, userPublicKey, userPublicKey, scoreVarsShipInfo.armsMaxReserve * stakingInfo.shipQuantityInEscrow,
        stakingInfo.shipMint,
        new web3.PublicKey(AMMUNITION_TOKEN_MINT),
        getTokenPublicKey(AMMUNITION_TOKEN_MINT, tokenAccountInfo),
        SCORE_PROGRAM_ID
    )
}
