
export function calcAtlasPending(nowSec, shipStakingInfo, shipInfo) {
    const shipQuantity = shipStakingInfo.shipQuantityInEscrow
    let minTimePassed = nowSec - shipStakingInfo.currentCapacityTimestamp.toNumber()
    minTimePassed = Math.min(minTimePassed, shipStakingInfo.fuelCurrentCapacity.toNumber(),
        shipStakingInfo.foodCurrentCapacity.toNumber(),
        shipStakingInfo.armsCurrentCapacity.toNumber(),
        shipStakingInfo.healthCurrentCapacity.toNumber()
    )

    let atlasPending = shipStakingInfo.totalTimeStaked.toNumber() + minTimePassed - shipStakingInfo.stakedTimePaid.toNumber()
    let t = shipStakingInfo.pendingRewards.toNumber() / Math.pow(10, 8)
    atlasPending = atlasPending * shipInfo.rewardRatePerSecond * shipQuantity
    atlasPending = (atlasPending / 100000000) + (t < 0 ? 0 : t)
    return parseFloat(atlasPending.toFixed(4))
}

export function calcPercentHealthLeft(shipStakingInfo, shipInfo, nowSec) {
    const toolkitMaxReserve = shipStakingInfo.healthCurrentCapacity / (shipInfo.millisecondsToBurnOneToolkit / 1000)
    const leftHealth = toolkitMaxReserve - (nowSec - shipStakingInfo.currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneToolkit / 1000)
    return Math.ceil(leftHealth / ((shipInfo.toolkitMaxReserve) / 100))
}

export function calcPercentFuelLeft(shipStakingInfo, shipInfo, nowSec) {
    const fuelMaxReserve = shipStakingInfo.fuelCurrentCapacity / (shipInfo.millisecondsToBurnOneFuel / 1000)
    const leftFuel = fuelMaxReserve - (nowSec - shipStakingInfo.currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneFuel / 1000)
    return Math.round(leftFuel / ((shipInfo.fuelMaxReserve) / 100))
}

export function calcPercentFoodLeft(shipStakingInfo, shipInfo, nowSec) {
    const foodMaxReserve = shipStakingInfo.foodCurrentCapacity / (shipInfo.millisecondsToBurnOneFood / 1000)
    const leftFood = foodMaxReserve - (nowSec - shipStakingInfo.currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneFood / 1000)
    return Math.round(leftFood / ((shipInfo.foodMaxReserve) / 100))
}

export function calcPercentArmsLeft(shipStakingInfo, shipInfo, nowSec) {
    const armsMaxReserve = shipStakingInfo.armsCurrentCapacity / (shipInfo.millisecondsToBurnOneArms / 1000)
    const leftArms = armsMaxReserve - (nowSec - shipStakingInfo.currentCapacityTimestamp) / (shipInfo.millisecondsToBurnOneArms / 1000)
    return Math.round(leftArms / ((shipInfo.armsMaxReserve) / 100))
}
