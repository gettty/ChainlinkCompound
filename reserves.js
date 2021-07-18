const { ethers} = require("ethers");
require('dotenv').config()
const fs = require('fs');
const BigNumber = require('bignumber.js');
const provider = new ethers.providers.JsonRpcProvider(process.env.provider);


const currentUAV = '0x841616a5CBA946CF415Efe8a326A621A794D0f97';
const currentUAVabi = JSON.parse(fs.readFileSync("proposedUAVabi.json"));
const currentUAVcontract = new ethers.Contract(currentUAV,currentUAVabi,provider);
const reporterabi = JSON.parse(fs.readFileSync("reporterabi.json"));
const chainlinkOralceabi = JSON.parse(fs.readFileSync("chainlinkOracleabi.json"));
const erc20abi = JSON.parse(fs.readFileSync("erc20abi.json"));
let chainlinkInfo = {};
//let priceInfo = [];
let packet = {};
let reserveData = {};

let multiple18 = new BigNumber (10).pow(18);
let multiple30 = new BigNumber (10).pow(30);
let multiple28 = new BigNumber (10).pow(28);
let multiple8 = new BigNumber (10).pow(8);
let multiple6 = new BigNumber (10).pow(6);

let decimals = {
    '0x0000000000000000000000000000000000000000': multiple18,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': multiple6,
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': multiple18,
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': multiple28,
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': multiple6,
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': multiple18,
    '0xc00e94Cb662C3520282E6f5717214004A7f26888': multiple18,
    '0xE41d2489571d322189246DaFA5ebDe1F4699F498': multiple18,
    '0x0D8775F648430679A709E98d2b0Cb6250d2887EF': multiple18,
    '0x0000000000085d4780B73119b644AE5ecd22b376': multiple18,
    '0x514910771AF9Ca656af840dff83E8264EcF986CA': multiple18,
    '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359': multiple18,
    '0x1985365e9f78359a9B6AD760e32412f4a445E862': multiple18,
}

async function getReserveData (){
    let text = "";
    let price = new BigNumber(0);
    let numOfTokens = await currentUAVcontract.numTokens();
    for (let i = 0; i < numOfTokens; i++){
        let config = await currentUAVcontract.getTokenConfig(i);
        if (config['priceSource'] === 2){
            const reporterContract = new ethers.Contract(config['reporter'],reporterabi,provider);
            let aggregatorInfo = await reporterContract.getAggregators();
            const chainlinkOracle = new ethers.Contract(aggregatorInfo['current'],chainlinkOralceabi,provider);
            price = new BigNumber((await chainlinkOracle.latestAnswer()).toString()).div(multiple8);
        } else if (config['priceSource'] === 1){
            price = new BigNumber("1");
        } else if (config['priceSource'] === 0){
            let ethQuantity = config['fixedPrice'].toNumber();
            ethQuantity = new BigNumber(ethQuantity).div(multiple18);
            price = ethQuantity.times(chainlinkInfo[0]['price']);
        }
        chainlinkInfo[i] = {'cToken': config['cToken'],'underlying': config['underlying'],'price':price}
        //begin 
        const ctokenabi = JSON.parse(fs.readFileSync("cethABI.json"));
        console.log(config['cToken']);
        const ctokenContract = new ethers.Contract(config['cToken'],ctokenabi,provider);
        const erc20 = new ethers.Contract(chainlinkInfo[i]["underlying"],erc20abi,provider);
        let multiple = 0;
        if (chainlinkInfo[i]["underlying"] !== "0x0000000000000000000000000000000000000000"){
            multiple = new BigNumber (10).pow(await erc20.decimals());
        } else {multiple = multiple18};
        let reserveRaw = new BigNumber((await ctokenContract.totalReserves()).toString()).div(multiple);
        let symbol = await ctokenContract.symbol();
        text = text + "\n"+symbol+": "+ reserveRaw;
        text = text + "\n"+symbol+": "+ price;
        let value = new BigNumber(reserveRaw.times(price))
        reserveData[config['cToken']] = {'Symbol':symbol,'Reserve': reserveRaw.toNumber(), 'Value': value.toFixed(0), 'Price': price.toFixed(2)};
    }
    let totalValue = new BigNumber(0);
    for (let i = 0; i < Object.keys(reserveData).length;i++){
        totalValue = totalValue.plus(reserveData[Object.keys(reserveData)[i]]["Value"]);
    }
    packet = {'reserveData':reserveData,'blockNumber': await provider.getBlockNumber(),'Total': totalValue.toFixed(2)}
    console.log(JSON.stringify(packet))
}

getReserveData()