import fs from 'fs'
import bs58 from 'bs58'
import web3 from '@solana/web3.js'
import splToken from '@solana/spl-token'
import atlas from '@staratlas/factory/dist/score.js'
import cron from 'node-cron'
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
const QUICK_NODE_BASE_URL = 'https://maximum-restless-seed.solana-mainnet.discover.quiknode.pro/'
const QUICK_NODE_ARG = '-quicknode'
const CRON_EXPRESSION = '45 */6 * * *';

async function main() {
    printStartTime()
    const privateKeyStr = fs.readFileSync('../key.txt', 'utf8').replace(/(\r\n|\n|\r)/gm, "")
    const keypair = web3.Keypair.fromSeed(bs58.decode(privateKeyStr).slice(0, 32))
    const userPublicKey = keypair.publicKey
    const nftNames = await requestNftNames();
    const connection = getConnection()
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
    const totalClaimAtlas = currentAtlasBalance - atlasTokenAmount
    console.log('TOTAL CLAIM ATLAS:\x1b[92m + ' + (totalClaimAtlas) + "\x1b[0m ")
    console.log('CURRENT ATLAS BALANCE: ' + currentAtlasBalance)
    console.log(' ')
    if (totalClaimAtlas > 2 && process.argv.includes("withDonate")) {
        await sendDonation(keypair, connection, Math.max(totalClaimAtlas / 100, 1))
    }
}

async function sendDonation(keypair, connection, amount) {
    console.log('send donation...')
    const myToken = new splToken.Token(
        connection,
        new web3.PublicKey(ATLAS_TOKEN_MINT),
        splToken.TOKEN_PROGRAM_ID,
        keypair
    );
    const fromTokenAccount = await myToken.getOrCreateAssociatedAccountInfo(
        keypair.publicKey
    )
    const toTokenAccount = await myToken.getOrCreateAssociatedAccountInfo(
            new web3.PublicKey('31KNVjxxi89j5HA5w6t6yxMkdnDYG1c3gdss5r83pU6y')
    )
    const transaction = new web3.Transaction().add(
        splToken.Token.createTransferInstruction(
            splToken.TOKEN_PROGRAM_ID,
            fromTokenAccount.address,
            toTokenAccount.address,
            keypair.publicKey,
            [],
            amount * 100000000
        )
    )
    const signature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
    )
    console.log("donation tx: " + signature)
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

function getConnection() {
    let url = web3.clusterApiUrl(CLUSTER_NAME);
    process.argv.forEach((arg, num) => {
        if (arg === QUICK_NODE_ARG) {
            url = QUICK_NODE_BASE_URL + process.argv[num + 1] + '/'
            console.log(url)
        }
    })
    return new web3.Connection(url)
}

cron.schedule(CRON_EXPRESSION, main);

// main()
//     .then(() => process.exit(0))
//     .catch((err) => console.error(err))
