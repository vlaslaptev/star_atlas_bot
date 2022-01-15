async function main() {
    const prompt = require("prompt-sync")({ sigint: true });
    const bs58 = require("bs58");
    const web3 = require("@solana/web3.js");
    const atlas = require("@staratlas/factory/dist/score");

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'))

    const privateKeyStr = prompt.hide("Input your private key ");
    const keypair = web3.Keypair.fromSeed(bs58.decode(privateKeyStr).slice(0, 32))
    const userPublicKey = keypair.publicKey

    const tokenProgramId = new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const scoreProgId = new web3.PublicKey('FLEET1qqzpexyaDpqb2DGsSzE2sDCizewCg9WjrA6DBW')
    const ammunitionTokenMint = "ammoK8AkX2wnebQb35cDAZtTkvsXQbi82cGeTnUvvfK"
    const foodTokenMint = "foodQJAztMzX1DKpLaiounNe2BDMds5RNuPC6jsNrDG"
    const toolkitTokenMint = "tooLsNYLiVqzg8o4m3L2Uetbn62mvMWRqkog6PQeYKL"
    const fuelTokenMint = "fueL3hBZjLLLJHiFH9cqZoozTG3XQZ53diwFPwbzNim"

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

    async function printCurrentBalances() {
        tokenAccountInfo = await connection.getParsedTokenAccountsByOwner(
            userPublicKey, {programId: tokenProgramId}, 'confirmed'
        );
        console.log('Current balances: ')
        console.log(' Food - ' +  getTokenAmount(foodTokenMint))
        console.log(' Toolkit - ' + getTokenAmount(toolkitTokenMint))
        console.log(' Fuel - ' +  getTokenAmount(fuelTokenMint))
        console.log(' Ammunition - ' + getTokenAmount(ammunitionTokenMint))
        console.log(' ')
    }
    await printCurrentBalances()

    async function sendTransaction(txInstruction) {
        const tx = new web3.Transaction().add(txInstruction)
        const res = await connection.sendTransaction(tx, [keypair])
        console.log("send tx", res)
        await delay(1000)
    }
    let shipStakingInfo = await atlas.getAllFleetsForUserPublicKey(connection, userPublicKey, scoreProgId)

    console.log("RE-SUPPLY ALL SHIPS:")
    for (let i = 0; i < shipStakingInfo.length; i++) {
        let scoreVarsShipInfo = await atlas.getScoreVarsShipInfo(connection, scoreProgId, shipStakingInfo[i].shipMint)
        //Fuel
        let txInstructionFuel = await atlas.createRefuelInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.fuelMaxReserve,
            shipStakingInfo[i].shipMint,
            new web3.PublicKey(fuelTokenMint),
            getTokenPublicKey(fuelTokenMint),
            scoreProgId
        )
        console.log("(ship - " + shipStakingInfo[i].shipMint + " ) Sending Refuel... ")
        await sendTransaction(txInstructionFuel)
        //Food
        let txInstructionFood = await atlas.createRefeedInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.foodMaxReserve,
            shipStakingInfo[i].shipMint,
            new web3.PublicKey(foodTokenMint),
            getTokenPublicKey(foodTokenMint),
            scoreProgId
        )
        console.log("(ship - " + shipStakingInfo[i].shipMint + " ) Sending Refeed... ")
        await sendTransaction(txInstructionFood)
        //Toolkit
        let txInstructionToolkit = await atlas.createRepairInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.toolkitMaxReserve,
            shipStakingInfo[i].shipMint,
            new web3.PublicKey(toolkitTokenMint),
            getTokenPublicKey(toolkitTokenMint),
            scoreProgId
        )
        console.log("(ship - " + shipStakingInfo[i].shipMint + " ) Sending Repair... ")
        await sendTransaction(txInstructionToolkit)
        //Ammunition
        let txInstructionAmmunition = await atlas.createRearmInstruction(
            connection, userPublicKey, userPublicKey, scoreVarsShipInfo.armsMaxReserve,
            shipStakingInfo[i].shipMint,
            new web3.PublicKey(ammunitionTokenMint),
            getTokenPublicKey(ammunitionTokenMint),
            scoreProgId
        )
        console.log("(ship - " + shipStakingInfo[i].shipMint + " ) Sending Rearm... ")
        await sendTransaction(txInstructionAmmunition)
        console.log("----")
    }
    await delay(5000)
    await printCurrentBalances()
}
main()
    .then(() => process.exit(0))
    .catch((err) => console.error(err))