const fs = require('fs');
const url = require('url');
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');
const cache = require('memory-cache');

const config = require('../config.json');

function typify(textSource) {
  var paragraph;
  var match;
  if (match = /^(.+),(.+): ?«(.+)»\.$/.exec(textSource)) {
    var fullName = match[1].split(' ');
    var firstName = fullName[0][0].toUpperCase() + fullName[0].slice(1).toLowerCase();
    var lastName = fullName[1] ? ' ' + fullName[1].toUpperCase() : '';
    var whois = match[2].trim();
    var text = match[3];
    paragraph = `СИНХРОН: ${firstName}${lastName}, ${whois}: «${text}».`;
  } else if (match = /^ ?[-–] (.+)$/.exec(textSource)) {
    var text = match[1];
    paragraph = `СИНХРОН: _______: «${text}».`;
  } else if (match = /^.+$/.exec(textSource)) {
    var text = match[0];
    paragraph = `РЕПОРТАЖ: ${text}`;
  } else {
    console.log('Error: Unable to parse paragraph:\n' + textSource);
    return '';
  }
  return paragraph;
}

function normalize(textSource) {
  var replaces = [
    { str: '—', to: '–' },
    { str: ' - ', to: ' – ' },
    { str: ' "', to: ' «'},
    { str: '" ', to: '» '},
    { str: /"(\S)/g, to: '»$1'},
    { str: /(\S)"/g, to: '$1»'},
  ];
  var text = textSource.trim();
  replaces.forEach(function(replace) {
    text = text.replace(new RegExp(replace.str, "g"), replace.to );
  });
  return text;
};

function loadSource(data, channelConfig) {
  var $ = cheerio.load(data);
  var title = $(channelConfig['sel:title']).text();
  var body = $(channelConfig['sel:body']).text();
  var date = $(channelConfig['sel:date']).text();
  return {
    title,
    body,
    date,
  };
}

function parseItem(source, channelConfig) {
  moment.locale('ru');
  var date = moment(source.date, channelConfig['match:date']).format('DD.MM.YYYY');
  var time = channelConfig.time;
  var titleMatchResult = source.title.match(new RegExp(channelConfig['match:title'], ''))
  var title = normalize(titleMatchResult ? titleMatchResult[1] : source.title);
  var body = source.body
    .replace(/\r?\n|\r/g, '\n')
    .replace(/\n+/g, '#NEWLINE#')
    .replace(/[\s\h]{2,}/g, ' ')
    .split('#NEWLINE#')
    .filter(p => !/^\s*$/m.test(p))
    .map(p => normalize(p))
    .map(p => {
      return { paragraph: typify(p) };
    });
  if (title && date && body.length) {
    return {
      status: 'OK',
      channel: channelConfig.channel,
      program: channelConfig.program,
      hasRepeat: !!channelConfig.repeat,
      repeat: channelConfig.repeat,
      title,
      date,
      time,
      body,
    };
  } else {
    throw new Error('Parsing error');
  }
}

function getItem(link) {
  return new Promise((resolve, reject) => {
    var item = cache.get(link);
    if (item) {
      resolve(item)
    } else {
      axios.get(link).then(({ data }) => {
        var host = url.parse(link).host;
        var channelConfig = config.channels[host];
        var source = loadSource(data, channelConfig);
        var item = parseItem(source, channelConfig);
        cache.put(link, item, config.cacheTimeout, key => console.log(`deleted: ${key}`));
        resolve(item)
      }).catch(err => {
        resolve({
          status: 'ERROR',
          link: link,
        });
      });
    }
  });
}

function getItems(links) {
  var promises = links.map(link => getItem(link));
  return Promise.all(promises);
}

module.exports = {
  getItems,
}
