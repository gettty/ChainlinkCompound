const { ethers, Contract } = require("ethers");
require('dotenv').config()
const fs = require('fs');
const express = require('express')
const app = express()
const network = "homestead";
const BigNumber = require('bignumber.js');
const provider = new ethers.providers.JsonRpcProvider(process.env.provider);
let blockNum = 0;

const proposedUAV = '0x841616a5CBA946CF415Efe8a326A621A794D0f97';
const proposedUAVabi = JSON.parse(fs.readFileSync("proposedUAVabi.json"));
const proposedUAVcontract = new ethers.Contract(proposedUAV,proposedUAVabi,provider);
let proposedInfo = {};

const currentUAV = '0x4007B71e01424b2314c020fB0344b03A7C499E1A';
const currentUAVabi = JSON.parse(fs.readFileSync("currentUAVabi.json"));
const currentUAVcontract = new ethers.Contract(currentUAV,currentUAVabi,provider);
let currentInfo = {};

const reporterabi = JSON.parse(fs.readFileSync("reporterabi.json"));
const chainlinkOralceabi = JSON.parse(fs.readFileSync("chainlinkOracleabi.json"));
let chainlinkInfo = {};

let dataSet = [];

let markets = {
'0x0000000000000000000000000000000000000000': 'ETH',
'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
'0x6B175474E89094C44Da98b954EedeAC495271d0F': 'DAI',
'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC',
'0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': 'UNI',
'0xc00e94Cb662C3520282E6f5717214004A7f26888': 'COMP',
'0xE41d2489571d322189246DaFA5ebDe1F4699F498': 'ZRX',
'0x0D8775F648430679A709E98d2b0Cb6250d2887EF': 'BAT',
'0x0000000000085d4780B73119b644AE5ecd22b376': 'TUSD',
'0x514910771AF9Ca656af840dff83E8264EcF986CA': 'LINK',
'0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359': 'SAI',
'0x1985365e9f78359a9B6AD760e32412f4a445E862': 'REP',
}

let multiple18 = new BigNumber (10).pow(18);
let multiple30 = new BigNumber (10).pow(30);
let multiple28 = new BigNumber (10).pow(28);
let multiple8 = new BigNumber (10).pow(8);

let mantissa = {
    '0x0000000000000000000000000000000000000000': multiple18,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': multiple30,
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': multiple18,
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': multiple28,
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': multiple30,
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': multiple18,
    '0xc00e94Cb662C3520282E6f5717214004A7f26888': multiple18,
    '0xE41d2489571d322189246DaFA5ebDe1F4699F498': multiple18,
    '0x0D8775F648430679A709E98d2b0Cb6250d2887EF': multiple18,
    '0x0000000000085d4780B73119b644AE5ecd22b376': multiple18,
    '0x514910771AF9Ca656af840dff83E8264EcF986CA': multiple18,
    '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359': multiple18,
    '0x1985365e9f78359a9B6AD760e32412f4a445E862': multiple18,
}

async function getProposedUAVprices (){
    let text = "";
    let numOfTokens = await proposedUAVcontract.numTokens();
    for (let i = 0; i < numOfTokens; i++){
        let config = await proposedUAVcontract.getTokenConfig(i);
        let price = new BigNumber((await proposedUAVcontract.getUnderlyingPrice(config["cToken"])).toString()).div(mantissa[config['underlying']]);
        proposedInfo[i] = {'cToken': config['cToken'],'underlying': config['underlying'],'price':price}
        text = text + "\n"+markets[proposedInfo[i]["underlying"]]+": "+ price;
        //dataSet[Object.keys(dataSet).length+1] ={'coin': markets[proposedInfo[i]["underlying"]],'source':'Proposed', 'price':price}
        dataSet.push([markets[proposedInfo[i]["underlying"]],'Proposed',price])

    }
    return text
}

async function getCurrentUAVprices (){
    let text = "";
    let numOfTokens = await proposedUAVcontract.numTokens();
    for (let i = 0; i < numOfTokens; i++){
        let config = await currentUAVcontract.getTokenConfig(i);
        let price = new BigNumber((await currentUAVcontract.getUnderlyingPrice(config["cToken"])).toString()).div(mantissa[config['underlying']]);
        currentInfo[i] = {'cToken': config['cToken'],'underlying': config['underlying'],'price':price}
        text = text + "\n"+markets[currentInfo[i]["underlying"]]+": "+ price;
        //dataSet[Object.keys(dataSet).length+1] ={'coin': markets[currentInfo[i]["underlying"]],'source':'Current', 'price':price}
        dataSet.push([markets[currentInfo[i]["underlying"]],'Current',price])
    }
    return text
}

async function getChainlinkprices (){
    let text = "";
    let price = new BigNumber(0);
    let numOfTokens = await proposedUAVcontract.numTokens();
    for (let i = 0; i < numOfTokens; i++){
        let config = await proposedUAVcontract.getTokenConfig(i);
        if (config['priceSource'] === 2){
            const reporterContract = new ethers.Contract(config['reporter'],reporterabi,provider);
            let aggregatorInfo = await reporterContract.getAggregators();
            const chainlinkOracle = new ethers.Contract(aggregatorInfo['current'],chainlinkOralceabi,provider);
            price = new BigNumber((await chainlinkOracle.latestAnswer()).toString()).div(multiple8);
        } else if (config['priceSource'] === 1){
            price = "1";
        } else if (config['priceSource'] === 0){
            let ethQuantity = config['fixedPrice'].toNumber();
            ethQuantity = new BigNumber(ethQuantity).div(multiple18);
            price = ethQuantity.times(chainlinkInfo[0]['price']);
        }
        //console.log(price);
        chainlinkInfo[i] = {'cToken': config['cToken'],'underlying': config['underlying'],'price':price}
        text = text + "\n"+markets[chainlinkInfo[i]["underlying"]]+": "+ price;
        //dataSet[Object.keys(dataSet).length+1] ={'coin': markets[chainlinkInfo[i]["underlying"]],'source':'Chainlink', 'price':price}
        dataSet.push([markets[chainlinkInfo[i]["underlying"]],'Chainlink',price])
    }
    return text
}

let packet;
async function getPrices(){
    await Promise.all([getProposedUAVprices(),getCurrentUAVprices(),getChainlinkprices()])
    packet = {'prices':dataSet,'blockNumber': await provider.getBlockNumber()}
    //packet = JSON.stringify({'prices':dataSet,'blockNumber': await provider.getBlockNumber()})
    return console.log('got prices')
}

async function update(){
    await getPrices();
    app.get('/prices/data', (req, res) => {
        res.send(packet)
        dataSet = [];
        packet = {};
    })
}

setInterval( async ()=>{
    await update();
    },1000*60*10
)

getPrices();
app.use(express.static('static'))
app.get('/prices/data', (req, res) => {
    res.send(packet)
    dataSet = [];
})

app.listen(3000, () => console.log('Server ready'))

