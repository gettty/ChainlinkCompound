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
let multiple8 = new BigNumber (10).pow(8);

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
        //console.log(config['cToken']);
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