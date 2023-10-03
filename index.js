/**
 * Базовый плагин
 */
const util = require('util');

const app = require('./app');

(async () => {
  let plugin;
  try {
    const opt = getOptFromArgs();
    const pluginapi = opt && opt.pluginapi ? opt.pluginapi : 'ih-plugin-api';
    plugin = require(pluginapi + '/index.js')();
    plugin.log('Elsner plugin has started.');

    // Получить параметры плагина - с формы formPluginCommon
    plugin.params.data = await plugin.params.get();
    plugin.log('Received params: ' + util.inspect(plugin.params.data));

    // Получить каналы - только для плагинов, которые используют каналы
    // plugin.channels.data = await plugin.channels.get();
    // plugin.log('Received channels ' + util.inspect(plugin.channels.data));
    const channels = elsnerChannels();
    plugin.send({ type: 'channels', data: channels });

    // Запуск модуля, реализующего логику конкретного плагина
    app(plugin);
  } catch (err) {
    plugin.exit(8, `Error: ${util.inspect(err)}`);
  }
})();

function elsnerChannels() {
  return [
    { id: 'temp', order: 1, r: 1 },
    { id: 'daylight', order: 2, r: 1 },
    { id: 'wind', order: 3, r: 1 },
    { id: 'rain', order: 4, r: 1 },
    { id: 'dark', order: 5, r: 1 }
  ];
}

function getOptFromArgs() {
  let opt;
  try {
    opt = JSON.parse(process.argv[2]); //
  } catch (e) {
    opt = {};
  }
  return opt;
}
