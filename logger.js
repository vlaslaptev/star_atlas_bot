import {getTokenAmount} from "./utils.js"
import {AMMUNITION_TOKEN_MINT, FOOD_TOKEN_MINT, FUEL_TOKEN_MINT, TOOLKIT_TOKEN_MINT} from "./tokenMints.js"

export function printRedPercent(percent, text) {
    process.stdout.write(" \x1b[91m   " + text + ": " + Math.max(0, percent.toFixed(0))  + "%" + " \x1b[0m ")
}

export function printGreenPercent(percent, text) {
    process.stdout.write(" \x1b[92m   " + text + ": " + Math.min(100, percent.toFixed(0) ) + "%" + " \x1b[0m ")
}

export function printStartTime() {
    console.log('----- START TIME: ------')
    console.log(new Date().toISOString())
    console.log('------------------------')
}

export function printCurrentBalance(atlasTokenAmount, foodTokenAmount, toolkitTokenAmount, fuelTokenAmount, ammunitionTokenAmount) {
    console.log('')
    console.log('CURRENT BALANCES: ')
    console.log('  ATLAS: ' + atlasTokenAmount)
    console.log('  FOOD: ' + foodTokenAmount)
    console.log('  TOOLKIT: ' + toolkitTokenAmount)
    console.log('  FUEL: ' + fuelTokenAmount)
    console.log('  AMMUNITION: ' + ammunitionTokenAmount)
    console.log('')
}

export function printShipStatusInfo(number, nftNames, shipStakingInfo, atlasPending, percentHealth, percentFuel, percentFood, percentArms) {
    const shipName = nftNames[shipStakingInfo.shipMint]
    const shipCount = shipStakingInfo.shipQuantityInEscrow
    console.log("-------------------------------")
    console.log(" " + (number) + " \x1b[1m Ship - " + shipName + " \x1b[0m " + shipCount + " SHIPS (" + shipStakingInfo.shipMint + ")")
    console.log("    ATLAS pending - " + atlasPending)
    percentHealth < 10 ? printRedPercent(percentHealth, "HEALTH") : printGreenPercent(percentHealth, "HEALTH")
    percentFuel < 10 ? printRedPercent(percentFuel, "FUEL") : printGreenPercent(percentFuel, "FUEL")
    percentFood < 10 ? printRedPercent(percentFood, "FOOD") : printGreenPercent(percentFood, "FOOD")
    percentArms < 10 ? printRedPercent(percentArms, "AMMO") : printGreenPercent(percentArms, "AMMO")
    console.log(' ')
}

export function printSpendResources(foodTokenAmount, toolkitTokenAmount, fuelTokenAmount, ammunitionTokenAmount, tokenAccountInfo) {
    console.log('SPENT RESOURCES: ')
    console.log('  FOOD: ' + (foodTokenAmount - getTokenAmount(FOOD_TOKEN_MINT, tokenAccountInfo)))
    console.log('  TOOLKIT: ' + (toolkitTokenAmount - getTokenAmount(TOOLKIT_TOKEN_MINT, tokenAccountInfo)))
    console.log('  FUEL: ' + (fuelTokenAmount - getTokenAmount(FUEL_TOKEN_MINT, tokenAccountInfo)))
    console.log('  AMMUNITION: ' + (ammunitionTokenAmount - getTokenAmount(AMMUNITION_TOKEN_MINT, tokenAccountInfo)))
    console.log(' ')
}
