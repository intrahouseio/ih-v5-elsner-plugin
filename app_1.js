/**
 * app.js
 */

const util = require('util');

module.exports = async function(plugin) {
  const period = plugin.params.periodSec*1000 || 1000;
  let buffer = [];

  plugin.send({ type: 'syncFolders', data: [{id: 'NEWCHANS'}]  });


  // Плагин имеет свои каналы

  const newchannels = [];
  newchannels.push({ id: 'NEWCHANS', title: 'NEW CHANS', folder: 1 });
  newchannels.push({ id: 'NEWDI1', desc: 'DI', value: 0, parent:'NEWCHANS' });
  newchannels.push({ id: 'NEWDI2', desc: 'D2', value: 0, parent:'NEWCHANS' });
  plugin.send({ type: 'upsertChannels', data:newchannels});
  
  const channels = newchannels; 
  
  // Realtime+архив  - отправлять раз в 10 сек
  let bufint;
  setInterval(() =>{
    if (bufint) clearInterval(bufint);
    sendData();
    if (buffer.length > 0) plugin.sendArchive(buffer);
    
    buffer = [];
     // Накапливать
    bufint = setInterval(saveArchive, 1000);
      
  }, 10000);
  
 

  // await sendChannels(); // Отправить каналы на старте
  // setInterval(sendData, period);

  // раз в минуту последний канал добавлять или удалять
  // setInterval(changeChannels, 60000); 

  /**
   * Считать каналы и отправить на сервер
   * Это можно сделать в любой момент, не только на старте
   * НО нужно отправлять массив всех каналов
   *
   * Элемент массива -  { id: 'DI1'<, desc: 'DI', value: 0> },
   *  id - обязательное свойство, остальные опционально
   *     Можно отправлять любые свойства, все они будут сохранены в канале
   *        Свойства можно показать на форме канала channelform и в таблице formPluginChannelsTable
   *     Можно в принципе дать редактировать свойства пользователю,
   *     Можно не только отправлять, но и получать каналы с сервера (отредактированные свойства??)
   *
   * Встроенные свойства
   *  id канала - уникальный id - это свойство chan на форме
   *  Флаги чтения/записи - можно прислать от плагина или дать менять пользователю
   *  r - флаг чтения. Если undefined - будет установлен =1 при создании канала
   *  w - флаг записи - автоматически не устанавливается
   *
   * Вместе с каналами можно (не обязательно) прислать и значение - value
   */

  async function sendChannels() {
    // Определить свои каналы
    channels.push({ id: 'INPUTS', title: 'INPUTS', folder: 1 });
    channels.push({ id: 'OUTPUTS', title: 'OUTPUTS', folder: 1 });
    channels.push({ id: 'OneWire', title: 'OneWire', folder: 1 });
    channels.push({ id: 'DI1', desc: 'DI', value: 0, parent:'INPUTS' });
    channels.push({ id: 'DI2', desc: 'DI', value: 1, parent:'INPUTS' });
    channels.push({ id: '282178654', desc: 'AI', value: 0, parent:'OneWire' });
    channels.push({ id: 'DO1', desc: 'DO', value: 0, parent:'OUTPUTS', r:1, w:1 });
    channels.push({ id: 'AI1', desc: 'AI', value: 0, parent:'INPUTS' });

    // Отправить на сервер
    plugin.send({ type: 'channels', data: channels });
  }

  function changeChannels() {
    if (channels.length < 5) {
      channels.push({ id: 'AI1', desc: 'AI', value: 0 });
    } else {
      channels.pop();
    }
    plugin.send({ type: 'channels', data: channels });
  }

  function saveArchive() {
    /*
    const data = channels.map(item => ({
      id: item.id,
      value: calcValue(item),
      chstatus: item.value > 0 ? 0 : 1
    }));
    plugin.sendData(data);
    plugin.log('sendData '+util.inspect(data))
    */
    const ts = Date.now();
    channels.filter(item => !item.folder).forEach(item => {
        buffer.push({id: item.id, value: calcValue(item), ts});
    })
    plugin.log('buffer '+util.inspect(buffer))
  }

  function sendData() {
    
    const data = channels.filter(item => !item.folder).map(item => ({
      id: item.id,
      value: calcValue(item),
      chstatus: item.value > 0 ? 0 : 1
    }));
    plugin.sendData(data);
    plugin.log('sendData '+util.inspect(data))
  }


  function calcValue(item) {
    if (item.desc == 'DI') {
      item.value = item.value == 1 ? 0 : 1;
    } else {
      item.value = item.value > 100 ? 0 : item.value + 1;
    }
    return item.value;
  }

  function terminate() {
    console.log('TERMINATE PLUGIN');
    // Здесь закрыть все что нужно
  }

  // Получили команды управления от сервера
  plugin.onAct(message => {
    plugin.log('Action data=' + util.inspect(message));
    if (!message.data) return;

    const result = [];
    message.data.forEach(item => {
     if (item.id) {
       const chanObj = channels.find(chanItem => chanItem.id == item.id);
       if (chanObj) {
        chanObj.value = item.value;
        result.push({id:item.id, value:item.value})
       } else {
         plugin.log('Not found channel with id '+item.id)
       }
     }
    });

    // Сразу отправляем на сервер - реально нужно отправить на железо
    if (result.length)  plugin.sendData(result);
  });


  process.on('exit', terminate);
  process.on('SIGTERM', () => {
    terminate();
    process.exit(0);
  });
};
