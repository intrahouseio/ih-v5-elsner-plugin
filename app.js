/**
 * app.js
 * Метеостанция ELSNER (RS485) присылает сообщение раз в 1 сек
 * Данный плагин работает при подключении RS485 через MOXA на UDP порт
 * Структура сообщения - 60 байт ASCII (0-59) + 1 байт=0x03 - конец сообщения:
 * G+15.1060304N99902.6N20310231221531221.2+19.7O030.2N59.32937
 * 
 * байты 56-59 содержат CRC 
 */

// const util = require('util');

const dgram = require('dgram');

module.exports = async function(plugin) {
  const socket = dgram.createSocket('udp4');
  let address;
  let fullMsg = '';

  const timeoutSec = Number(plugin.params.data.timeout) || 10;
  let timeoutInterval;

  const host = plugin.params.data.host;
  const port = Number(plugin.params.data.port) || 0;

  socket.on('listening', () => {
    address = socket.address();
    plugin.log(`INFO: UDP server listening ${address.address}:${address.port}`, 1);
  });

  socket.bind({ port });
  activateTimeout();

  socket.on('message', (msg, rinfo) => {
    clearTimeout(timeoutInterval);
    let finish;
    // plugin.log(`UDP server got: ${msg} from ${rinfo.address}:${rinfo.port} msg[0]=${msg[0]}`, 1);
    if (msg[0] == 71) { // 'G'
      fullMsg = msg;
    } else {
      fullMsg += msg;
      for(let i=0; i<msg.length; i++) {
        if (msg[i] == 3) finish = true;
      }
    }

    if (finish || fullMsg.length >= 61) {
      plugin.log(`fullMsg = ${fullMsg}`, 1);
      const data = parseMessage(fullMsg);
      fullMsg = '';
      if (data) plugin.sendData(data);
      activateTimeout();
    }
  
  });

  socket.on('error', e => {
    const mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use' : +e.code;
    plugin.log(`ERROR: UDP server port: ${port} error! ${mes}`);
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });

  function activateTimeout() {
    timeoutInterval = setTimeout(() => {
      plugin.log('Timeout error');
      process.exit(1);
    }, timeoutSec*1000);
  }

  function parseMessage(mes) {
    // G+15.1060304N99902.6N20310231221531221.2+19.7O030.2N59.32937
    if (mes.length < 60) {
      plugin.log('Invalid message length, expected 56, got ' + mes.length + ': ' + mes);
      return;
    }

    if (!checkCrc()) return;

    const data = [];
    addIt('temp', mes.substr(1, 5));
    addIt('daylight', mes.substr(13, 3));
    addIt('wind', mes.substr(16, 4));
    addIt('rain', mes.substr(20, 1), 'J');
    addIt('dark', mes.substr(12, 1), 'J');
    return data;

    function addIt(prop, strval, vtype) {
      try {
        const value = getValue(strval, vtype);
        data.push({ id: prop, value });
      } catch (e) {
        plugin.log('Channel: ' + prop + 'Invalid value: ' + strval + ' ' + e.message);
        data.push({ id: prop, chstatus: 1 });
      }
    }

    
    function checkCrc() {
      let getCrc = 0;
      for (let i=56; i<60; i++) {
        getCrc = getCrc*10+(mes.charCodeAt(i)-48);
      }
      
      let calcCrc = 0;
      for (let i=0; i<56; i++) {
        calcCrc += mes.charCodeAt(i);
      }
      
      if (getCrc == calcCrc) return true;
      plugin.log('Invalid CRC! Expected:'+calcCrc+', received: '+getCrc)
    }
  }

  function getValue(strval, vtype) {
    if (vtype == 'J') {
      if (strval == 'J') return 1;
      if (strval == 'N') return 0;
      throw { message: 'Expected J/N' };
    }

    let x = Number(strval);
    if (isNaN(x)) throw { message: 'Expected number!' };
    return x;
  }
};