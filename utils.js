export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const getNowSec = () => new Date().getTime() / 1000

export function getTokenAmount(tokenMint, tokenAccountInfo) {
    return tokenAccountInfo.value.filter(function (v) {
        return v.account.data.parsed.info.mint === tokenMint
    })[0].account.data.parsed.info.tokenAmount.uiAmount
}
export function getTokenPublicKey(tokenMint, tokenAccountInfo) {
    return tokenAccountInfo.value.filter(function (v) {
        return v.account.data.parsed.info.mint === tokenMint
    })[0].pubkey
}
