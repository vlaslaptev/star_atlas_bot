import fs from 'fs'
import bs58 from 'bs58'
import web3 from '@solana/web3.js'
import atlas from '@staratlas/factory/dist/score.js'
import {requestNftNames} from './httpClient.js'
import {getTokenAmount, getTokenPublicKey, delay, getNowSec} from './utils.js'
import {calcAtlasPending, calcPercentHealthLeft, calcPercentFuelLeft, calcPercentArmsLeft, calcPercentFoodLeft} from './calcUtils.js'
import {printShipStatusInfo, printStartTime, printCurrentBalance, printSpendResources} from './logger.js'
import {sendTransaction, getTxInstructionFood, getTxInstructionFuel, getTxInstructionToolkit, getTxInstructionAmmunition} from './transactionHelper.js'
import {
    AMMUNITION_TOKEN_MINT,
    FOOD_TOKEN_MINT,
    TOOLKIT_TOKEN_MINT,
    FUEL_TOKEN_MINT,
    ATLAS_TOKEN_MINT,
    SCORE_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from './tokenMints.js'

const CLUSTER_NAME = "mainnet-beta"
const TX_DELAY_MS = 3000

async function main() {
    printStartTime()

    const connection = new web3.Connection(web3.clusterApiUrl(CLUSTER_NAME))
    const nftNames = await requestNftNames();
    const privateKeyStr = fs.readFileSync('../key.txt', 'utf8').replace(/(\r\n|\n|\r)/gm, "")
    const keypair = web3.Keypair.fromSeed(bs58.decode(privateKeyStr).slice(0, 32))
    const userPublicKey = keypair.publicKey

    console.log("request TokenAccounts...")
    let tokenAccountInfo = await connection.getParsedTokenAccountsByOwner(
        userPublicKey, {programId: TOKEN_PROGRAM_ID}, 'confirmed'
    )

    const atlasTokenAmount = getTokenAmount(ATLAS_TOKEN_MINT, tokenAccountInfo)
    const foodTokenAmount = getTokenAmount(FOOD_TOKEN_MINT, tokenAccountInfo)
    const toolkitTokenAmount = getTokenAmount(TOOLKIT_TOKEN_MINT, tokenAccountInfo)
    const fuelTokenAmount = getTokenAmount(FUEL_TOKEN_MINT, tokenAccountInfo)
    const ammunitionTokenAmount = getTokenAmount(AMMUNITION_TOKEN_MINT, tokenAccountInfo)
    printCurrentBalance(atlasTokenAmount, foodTokenAmount, toolkitTokenAmount, fuelTokenAmount, ammunitionTokenAmount)

    console.log("request AllFleetsForUser...")
    const scoreVarsShipInfo = new Map()
    let shipsStakingInfo = await atlas.getAllFleetsForUserPublicKey(connection, userPublicKey, SCORE_PROGRAM_ID)
    shipsStakingInfo.sort((a, b) => a.shipMint.toString().localeCompare(b.shipMint.toString()))
    for (let i = 0; i < shipsStakingInfo.length; i++) {
        let info = await atlas.getScoreVarsShipInfo(connection, SCORE_PROGRAM_ID, shipsStakingInfo[i].shipMint)
        scoreVarsShipInfo.set(shipsStakingInfo[i].shipMint.toString(), info)
    }
    const needReSupply = printShipStatus(shipsStakingInfo, scoreVarsShipInfo, nftNames)
    console.log('needReSupply: ' + needReSupply)
    if (!needReSupply) {
        return
    }
    console.log("RE-SUPPLY ALL SHIPS:")
    for (let i = 0; i < shipsStakingInfo.length; i++) {
        console.log("Ship - " + nftNames[shipsStakingInfo[i].shipMint] + " (" + shipsStakingInfo[i].shipMint + ")")
        let shipInfo = scoreVarsShipInfo.get(shipsStakingInfo[i].shipMint.toString())

        console.log("Sending Refuel... ")
        const refuelTxInstruction = await getTxInstructionFuel(shipInfo, shipsStakingInfo[i], connection, userPublicKey, tokenAccountInfo)
        await sendTransaction(refuelTxInstruction, keypair, connection)
        await delay(TX_DELAY_MS)

        console.log("Sending Refeed... ")
        const refeedTxInstruction = await getTxInstructionFood(shipInfo, shipsStakingInfo[i], connection, userPublicKey, tokenAccountInfo)
        await sendTransaction(refeedTxInstruction, keypair, connection)
        await delay(TX_DELAY_MS)

        console.log("Sending Repair... ")
        const repairTxInstruction = await getTxInstructionToolkit(shipInfo, shipsStakingInfo[i], connection, userPublicKey, tokenAccountInfo)
        await sendTransaction(repairTxInstruction, keypair, connection)
        await delay(TX_DELAY_MS)

        console.log("Sending Rearm... ")
        const rearmTxInstruction = await getTxInstructionAmmunition(shipInfo, shipsStakingInfo[i], connection, userPublicKey, tokenAccountInfo)
        await sendTransaction(rearmTxInstruction, keypair, connection)
        await delay(TX_DELAY_MS)

        if (calcAtlasPending(getNowSec(), shipsStakingInfo[i], shipInfo) > 1) {
            console.log("Claim ATLAS... ")
            await sendTransaction(
                await atlas.createHarvestInstruction(
                    connection, userPublicKey,
                    getTokenPublicKey(ATLAS_TOKEN_MINT, tokenAccountInfo),
                    shipsStakingInfo[i].shipMint, SCORE_PROGRAM_ID
                ),
                keypair, connection
            )
            await delay(TX_DELAY_MS)
        }
        console.log("----")
    }

    await delay(5000)

    console.log("request TokenAccounts...")
    tokenAccountInfo = await connection.getParsedTokenAccountsByOwner(
        userPublicKey, {programId: TOKEN_PROGRAM_ID}, 'confirmed'
    );
    printSpendResources(foodTokenAmount, toolkitTokenAmount, fuelTokenAmount, ammunitionTokenAmount, tokenAccountInfo)

    console.log("request AllFleetsForUser...")
    shipsStakingInfo = await atlas.getAllFleetsForUserPublicKey(connection, userPublicKey, SCORE_PROGRAM_ID)
    printShipStatus(shipsStakingInfo, scoreVarsShipInfo, nftNames)

    const currentAtlasBalance = getTokenAmount(ATLAS_TOKEN_MINT, tokenAccountInfo)
    console.log('TOTAL CLAIM ATLAS:\x1b[92m + ' + (currentAtlasBalance - atlasTokenAmount) + "\x1b[0m ")
    console.log('CURRENT ATLAS BALANCE: ' + currentAtlasBalance)
    console.log(' ')
}

function printShipStatus(shipsStakingInfo, scoreVarsShipInfo, nftNames) {
    let needReSupply = false
    console.log('SHIPS STATUSES: ')
    for (let i = 0; i < shipsStakingInfo.length; i++) {
        const nowSec = getNowSec()
        const shipInfo = scoreVarsShipInfo.get(shipsStakingInfo[i].shipMint.toString())
        const atlasPending = calcAtlasPending(nowSec, shipsStakingInfo[i], shipInfo)
        const percentHealth = calcPercentHealthLeft(shipsStakingInfo[i], shipInfo, nowSec)
        const percentFuel = calcPercentFuelLeft(shipsStakingInfo[i], shipInfo, nowSec)
        const percentFood = calcPercentFoodLeft(shipsStakingInfo[i], shipInfo, nowSec)
        const percentArms = calcPercentArmsLeft(shipsStakingInfo[i], shipInfo, nowSec)

        printShipStatusInfo(
            i + 1, nftNames, shipsStakingInfo[i],
            atlasPending, percentHealth, percentFuel, percentFood, percentArms
        );
        needReSupply = needReSupply || percentHealth < 10 || percentFuel < 10 || percentFood < 10 || percentArms < 10
    }
    console.log('-------------------------------')
    console.log(' ')
    return needReSupply
}

main()
    .then(() => process.exit(0))
    .catch((err) => console.error(err))
