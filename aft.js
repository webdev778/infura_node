require('dotenv').config();
import path from 'path'
var fs = require('fs');
import BN from 'bn.js';

// Ethereum javascript libraries needed
import Web3 from 'web3'
var Tx = require('ethereumjs-tx');

const _sendSignedToken = async (destAddress, transferAmount) => {
  const {my_privkey, owner_addr : myAddress, contract_addr : contractAddress, infura_api_url, GAS_PRICE, GAS_LIMIT}= process.env;
  
  // This code was written and tested using web3 version 1.0.0-beta.31

  const web3 = new Web3(Web3.givenProvider || infura_api_url)
  console.log(`web3 version: ${web3.version}`)

  // Determine the nonce
  var count = await web3.eth.getTransactionCount(myAddress);
  console.log(`num transactions so far: ${count}`);

  // This file is just JSON stolen from the contract page on etherscan.io under "Contract ABI"
  var abiArray = JSON.parse(fs.readFileSync(path.resolve(__dirname, './aft.json'), 'utf-8'));
  // console.log(abiArray);

  // This is the address of the contract which created the ERC20 token
  var contract = new web3.eth.Contract(abiArray, contractAddress, { from: myAddress });

  // How many tokens do I have before sending?
  var balance = await contract.methods.balanceOf(myAddress).call();
  console.log(`Balance before send: ${balance}`);

  // I chose gas price and gas limit based on what ethereum wallet was recommending for a similar transaction. You may need to change the gas price!
  var rawTransaction = {
      "from": myAddress,
      "nonce": "0x" + count.toString(16),
      "gasPrice": GAS_PRICE,                  
      "gasLimit": GAS_LIMIT,
      "to": contractAddress,
      "value": "0x0",
      "data": contract.methods.transfer(destAddress, transferAmount).encodeABI(),
      "chainId": 0x03
  };

  // The private key must be for myAddress
  var privKey = new Buffer(my_privkey, 'hex');
  var tx = new Tx(rawTransaction);
  tx.sign(privKey);
  var tx_hash = tx.hash();
  var tx_hash_str = "0x"+tx_hash.toString('hex');
  console.log(`Transaction Hash: ${tx_hash.toString('hex')}`);

  var serializedTx = tx.serialize();

  // Comment out these three lines if you don't really want to send the TX right now
  console.log(`Attempting to send signed tx:  ${serializedTx.toString('hex')}`);
  web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
    .on('receipt', (receipt)=>{
      console.log(`Receipt info:  ${JSON.stringify(receipt, null, '\t')}`);

      //update database
    });

  /*
  // The balance may not be updated yet, but let's check
  balance = await contract.methods.balanceOf(myAddress).call();
  console.log(`Balance after send: ${balance}`);

  console.log(`txHash:${receipt.transactionHash}`);
  */
  return tx_hash_str;
}

export const sendToken = async (req, res) => {
  console.log(req.body);
  const { toAddr, amount } = req.body;
  
  // this test data
  // const toAddr = "0x27B8d68B7c84EEF97dcEc7dd33C628D342079164";
  // const amount = "1000000000000000000";

  if(!toAddr || !amount) {
    console.error('send token request error!');
    res.json({
      status: 400,
    });
    return;
  }

  try {
    const m = Web3.utils.toWei(amount, 'ether');
    console.log(m);
    const txHash = await _sendSignedToken(toAddr, m);

    res.json({
      success: 200,
      txHash
    });
  } catch (e) { 
    console.error(e.stack);
    res.json({
      status: 500,
    });
  }
}