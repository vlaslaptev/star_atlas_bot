import axios from "axios";

export async function requestNftNames() {
    let nftNames = {};
    await axios.get('https://galaxy.staratlas.com/nfts').then(res => {
        console.log(`statusCode: ${res.status}`);
        res.data.forEach(o => nftNames[o.mint] = o.name)
    }).catch(error => {
        console.error(error);
    });
    return nftNames;
}