async function main() {
    const fs = require('fs');
    const bs58 = require("bs58");
    const web3 = require("@solana/web3.js");
    const atlas = require("@staratlas/factory/dist/score");

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'))

    const nftNames = JSON.parse(fs.readFileSync('nft_names.json', 'utf8')) // todo replace with online request
    const privateKeyStr = fs.readFileSync('../key.txt', 'utf8')
    const keypair = web3.Keypair.fromSeed(bs58.decode(privateKeyStr).slice(0, 32))
    const userPublicKey = keypair.publicKey

    const tokenProgramId = new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const scoreProgId = new web3.PublicKey('FLEET1qqzpexyaDpqb2DGsSzE2sDCizewCg9WjrA6DBW')
    const ammunitionTokenMint = "ammoK8AkX2wnebQb35cDAZtTkvsXQbi82cGeTnUvvfK"
    const foodTokenMint = "foodQJAztMzX1DKpLaiounNe2BDMds5RNuPC6jsNrDG"
    const toolkitTokenMint = "tooLsNYLiVqzg8o4m3L2Uetbn62mvMWRqkog6PQeYKL"
    const fuelTokenMint = "fueL3hBZjLLLJHiFH9cqZoozTG3XQZ53diwFPwbzNim"
    const atlasTokenMint = "ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx"

    let shipStakingInfo;
    const scoreVarsShipInfo = new Map();
    console.log("request TokenAccounts...")
    let tokenAccountInfo = await connection.getParsedTokenAccountsByOwner(
        userPublicKey, {programId: tokenProgramId}, 'confirmed'
    );

    function getTokenAmount(tokenMint) {
        return tokenAccountInfo.value.filter(function (v) {
            return v.account.data.parsed.info.mint === tokenMint
        })[0].account.data.parsed.info.tokenAmount.uiAmount
    }
    function getTokenPublicKey(tokenMint) {
        return tokenAccountInfo.value.filter(function (v) {
            return v.account.data.parsed.info.mint === tokenMint
        })[0].pubkey
    }

    const atlasTokenCount = getTokenAmount(atlasTokenMint);
    const food = getTokenAmount(foodTokenMint);
    const toolkit = getTokenAmount(toolkitTokenMint);
    const fuel = getTokenAmount(fuelTokenMint);
    const ammunition = getTokenAmount(ammunitionTokenMint);
    console.log('');
    console.log('CURRENT BALANCES: ')
    console.log('  ATLAS: ' +  atlasTokenCount)
    console.log('  FOOD: ' +  food)
    console.log('  TOOLKIT: ' + toolkit)
    console.log('  FUEL: ' +  fuel)
    console.log('  AMMUNITION: ' + ammunition)
    console.log('')

    async function sendTransaction(txInstruction) {
        const tx = new web3.Transaction().add(txInstruction)
        const res = await connection.sendTransaction(tx, [keypair])
        console.log("send tx", res)
    }

    function calcAtlasPending(nowSec, shipStakingInfo, shipInfo) {
        const shipQuantity = shipStakingInfo.shipQuantityInEscrow
        let minTimePassed = nowSec - shipStakingInfo.currentCapacityTimestamp.toNumber();
        minTimePassed = Math.min(minTimePassed, shipStakingInfo.fuelCurrentCapacity.toNumber(),
            shipStakingInfo.foodCurrentCapacity.toNumber(),
            shipStakingInfo.armsCurrentCapacity.toNumber(),
            shipStakingInfo.healthCurrentCapacity.toNumber()
        )

        let atlasPending = shipStakingInfo.totalTimeStaked.toNumber() + minTimePassed - shipStakingInfo.stakedTimePaid.toNumber()
        let t = shipStakingInfo.pendingRewards.toNumber() / Math.pow(10, 8)
        atlasPending = atlasPending * shipInfo.rewardRatePerSecond * shipQuantity;
        atlasPending = (atlasPending / 100000000) + (t < 0 ? 0 : t)
        return parseFloat(atlasPending.toFixed(4))
    }

    async function getTxInstructionFood(scoreVarsShipInfo, stakingInfo) {
        return await atlas.createRefeedInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.foodMaxReserve * stakingInfo.shipQuantityInEscrow,
            stakingInfo.shipMint,
            new web3.PublicKey(foodTokenMint),
            getTokenPublicKey(foodTokenMint),
            scoreProgId
        );
    }

    async function getTxInstructionFuel(scoreVarsShipInfo, stakingInfo) {
        return await atlas.createRefuelInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.fuelMaxReserve * stakingInfo.shipQuantityInEscrow,
            stakingInfo.shipMint,
            new web3.PublicKey(fuelTokenMint),
            getTokenPublicKey(fuelTokenMint),
            scoreProgId
        );
    }

    async function getTxInstructionToolkit(scoreVarsShipInfo, stakingInfo) {
        return await atlas.createRepairInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.toolkitMaxReserve * stakingInfo.shipQuantityInEscrow,
            stakingInfo.shipMint,
            new web3.PublicKey(toolkitTokenMint),
            getTokenPublicKey(toolkitTokenMint),
            scoreProgId
        );
    }

    async function getTxInstructionAmmunition(scoreVarsShipInfo, stakingInfo) {
        return await atlas.createRearmInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.armsMaxReserve * stakingInfo.shipQuantityInEscrow,
            stakingInfo.shipMint,
            new web3.PublicKey(ammunitionTokenMint),
            getTokenPublicKey(ammunitionTokenMint),
            scoreProgId
        );
    }

    function printRedPercent(percent, text) {
        process.stdout.write(" \033[91m   " + text + ": " + Math.max(0, percent.toFixed(0))  + "%" + " \033[0m ")
    }

    function printGreenPercent(percent, text) {
        process.stdout.write(" \033[92m   " + text + ": " + Math.min(100, percent.toFixed(0) ) + "%" + " \033[0m ")
    }

    function printShipStatus() {
        let needReSupply = false;
        console.log('SHIPS STATUSES: ')
        for (let i = 0; i < shipStakingInfo.length; i++) {
            const nowSec = new Date().getTime() / 1000
            const shipInfo = scoreVarsShipInfo.get(shipStakingInfo[i].shipMint.toString())
            const shipCount = shipStakingInfo[i].shipQuantityInEscrow
            console.log("-------------------------------")
            console.log(" " + (i + 1) + " \033[1m Ship - " + nftNames[shipStakingInfo[i].shipMint] + " \033[0m " + shipCount + " SHIPS (" + shipStakingInfo[i].shipMint + ")")

            const atlasPending = calcAtlasPending(nowSec, shipStakingInfo[i], shipInfo)
            console.log("    ATLAS pending - " + atlasPending)

            const toolkitMaxReserve = shipStakingInfo[i].healthCurrentCapacity / (shipInfo.millisecondsToBurnOneToolkit / 1000)
            const leftHealth = toolkitMaxReserve - (nowSec - shipStakingInfo[i].currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneToolkit / 1000)
            const percentHealth = Math.ceil(leftHealth / ((shipInfo.toolkitMaxReserve) / 100))
            percentHealth < 10 ? printRedPercent(percentHealth, "HEALTH") : printGreenPercent(percentHealth, "HEALTH")

            const fuelMaxReserve = shipStakingInfo[i].fuelCurrentCapacity / (shipInfo.millisecondsToBurnOneFuel / 1000)
            const leftFuel = fuelMaxReserve - (nowSec - shipStakingInfo[i].currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneFuel / 1000)
            const percentFuel = Math.round(leftFuel / ((shipInfo.fuelMaxReserve) / 100))
            percentFuel < 10 ? printRedPercent(percentFuel, "FUEL") : printGreenPercent(percentFuel, "FUEL")

            const foodMaxReserve = shipStakingInfo[i].foodCurrentCapacity / (shipInfo.millisecondsToBurnOneFood / 1000) //89221
            const leftFood = foodMaxReserve - (nowSec - shipStakingInfo[i].currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneFood / 1000)
            const percentFood = Math.round(leftFood / ((shipInfo.foodMaxReserve) / 100))
            percentFood < 10 ? printRedPercent(percentFood, "FOOD") : printGreenPercent(percentFood, "FOOD")

            const armsMaxReserve = shipStakingInfo[i].armsCurrentCapacity / (shipInfo.millisecondsToBurnOneArms / 1000)
            const leftArms = armsMaxReserve - (nowSec - shipStakingInfo[i].currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneArms / 1000)
            const percentArms = Math.round(leftArms / ((shipInfo.armsMaxReserve) / 100))
            percentArms < 10 ? printRedPercent(percentArms, "AMMO") : printGreenPercent(percentArms, "AMMO")
            console.log(' ')
            needReSupply = needReSupply || leftHealth < 10 || percentFuel < 10 || percentFood < 10 || percentArms < 10
        }
        return needReSupply
    }

    console.log("request AllFleetsForUser...")
    shipStakingInfo = await atlas.getAllFleetsForUserPublicKey(connection, userPublicKey, scoreProgId)
    shipStakingInfo.sort((a, b) => a.shipMint.toString().localeCompare(b.shipMint.toString()))
    for (let i = 0; i < shipStakingInfo.length; i++) {
        let info = await atlas.getScoreVarsShipInfo(connection, scoreProgId, shipStakingInfo[i].shipMint)
        scoreVarsShipInfo.set(shipStakingInfo[i].shipMint.toString(), info)
    }
    const needReSupply = printShipStatus();
    console.log('-------------------------------')
    console.log(' ')
    console.log('needReSupply: ' + needReSupply)
    if (!needReSupply) {
        return
    }
    console.log("RE-SUPPLY ALL SHIPS:")
    for (let i = 0; i < shipStakingInfo.length; i++) {
        console.log("Ship - " + nftNames[shipStakingInfo[i].shipMint] + " (" + shipStakingInfo[i].shipMint + ")")
        let shipInfo = scoreVarsShipInfo.get(shipStakingInfo[i].shipMint.toString())
        //Fuel
        console.log("Sending Refuel... ")
        await sendTransaction(await getTxInstructionFuel(shipInfo, shipStakingInfo[i]))
        await delay(1000)
        //Food
        console.log("Sending Refeed... ")
        await sendTransaction(await getTxInstructionFood(shipInfo, shipStakingInfo[i]))
        await delay(1000)
        //Toolkit
        console.log("Sending Repair... ")
        await sendTransaction(await getTxInstructionToolkit(shipInfo, shipStakingInfo[i]))
        await delay(1000)
        //Ammunition
        console.log("Sending Rearm... ")
        await sendTransaction(await getTxInstructionAmmunition(shipInfo, shipStakingInfo[i]))
        await delay(1000)

        const nowSec = new Date().getTime() / 1000
        if (calcAtlasPending(nowSec, shipStakingInfo[i], shipInfo) > 1) {
            console.log("Claim ATLAS... ")
            await sendTransaction(await atlas.createHarvestInstruction(connection, userPublicKey, getTokenPublicKey(atlasTokenMint), shipStakingInfo[i].shipMint, scoreProgId))
            await delay(1000)
        }
        console.log("----")
    }

    await delay(5000)
    console.log("request AllFleetsForUser...")
    tokenAccountInfo = await connection.getParsedTokenAccountsByOwner(
        userPublicKey, {programId: tokenProgramId}, 'confirmed'
    );

    console.log('SPENT RESOURCES: ')
    console.log('  FOOD: ' + (food - getTokenAmount(foodTokenMint)))
    console.log('  TOOLKIT: ' + (toolkit - getTokenAmount(toolkitTokenMint)))
    console.log('  FUEL: ' + (fuel - getTokenAmount(fuelTokenMint)))
    console.log('  AMMUNITION: ' + (ammunition - getTokenAmount(ammunitionTokenMint)))
    console.log(' ')

    shipStakingInfo = await atlas.getAllFleetsForUserPublicKey(connection, userPublicKey, scoreProgId)
    printShipStatus()
    console.log(' ')

    const currentAtlasBalance = getTokenAmount(atlasTokenMint)
    console.log('TOTAL CLAIM ATLAS:\033[92m + ' + (currentAtlasBalance - atlasTokenCount) + "\033[0m ")
    console.log('CURRENT ATLAS BALANCE: ' + currentAtlasBalance)
    console.log(' ')
}
main()
    .then(() => process.exit(0))
    .catch((err) => console.error(err))