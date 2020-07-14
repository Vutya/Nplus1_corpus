'use strict';

const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const { create } = require('xmlbuilder2');
const levenshtein = require('js-levenshtein');

if (process.argv.length > 4) process.exit(1);

const curDate = process.argv.length > 2 ? new Date(process.argv[2]) :
  new Date('2019-6-20');
const endDate = process.argv.length === 4 ? new Date(process.argv[3]) :
  new Date();

let end = false;

const data = create({ version: '1.0' }).ele('data');

// Async pause for 1-2s
const pause = () => new Promise(resolve =>
  setTimeout(resolve, Math.floor(Math.random() * 1000) + 1000)
);

// Get all data from single news page
const pushNewsObject = URL => {
  request(URL, async (error, response, body) => {
    if (error) throw error;
    const obj = {};
    const $ = cheerio.load(body);
    obj.title = $('title').text();
    obj.url = URL;
    obj.topics = $('a[data-rubric]').map(function() {
      return $(this).text();
    }).get().join(', ');
    obj.difficulty = $('.difficult-value').text();
    obj.date = $('meta[itemprop="datePublished"]').attr('content');
    obj.author = $('meta[name="mediator_author"]').attr('content');
    $('figure').remove();
    $('div[class="title"]').remove();
    obj.article = $('div[class="body js-mediator-article"]').text()
      .split('\n')
      .filter(line => (line.trim()) &&
        (levenshtein(obj.author, line.trim()) > 2))
      .join('\n')
      .trim()
      .replace(obj.author, '');
    data.root().ele('item')
      .ele('title').txt(obj.title).up()
      .ele('url').txt(obj.url).up()
      .ele('topics').txt(obj.topics).up()
      .ele('difficulty').txt(obj.difficulty).up()
      .ele('date').txt(obj.date).up()
      .ele('author').txt(obj.author).up()
      .ele('article').txt(obj.article).up();
    if (end)
      fs.writeFile('corpus.xml', data.end({ prettyPrint: true }),
        err => { if (err) return console.log(err); });
  });
};

// Get URLs of all news on certain date
const addNewsByDay = (URL, ref) => {
  request(URL, async (error, response, body) => {
    if (error) throw error;
    const news = body.split('\n').filter(s => s.includes(ref));
    for (let i = 0; i < news.length; i++) {
      const s = news[i];
      pushNewsObject('https://nplus1.ru' + s.split('"')[1]);
      await pause();
    }
  });
};

// Main
(async () => {
  for (; curDate <= endDate; curDate.setDate(curDate.getDate() + 1)) {
    const date = {
      year: curDate.getYear() + 1900,
      month: parseInt(curDate.getMonth()) + 1 < 10 ? '0' +
        (parseInt(curDate.getMonth()) + 1) :
        parseInt(curDate.getMonth()) + 1 + '',
      day: curDate.getDate() < 10 ? '0' + curDate.getDate() :
        '' + curDate.getDate()
    };
    const URL = 'https://nplus1.ru/news/' + date.year + '/' + date.month + '/' + date.day;
    const ref = '<a href="/news/' + date.year + '/' + date.month +
      '/' + date.day;
    console.log('\x1Bc');
    console.log('Current Date:', curDate, ', End Date:', endDate);
    end = (curDate.getDate() === endDate.getDate()) &&
      (curDate.getMonth() === endDate.getMonth()) &&
      (curDate.getFullYear()) === endDate.getFullYear();
    if (end) console.log('Corpus created!');
    addNewsByDay(URL, ref);
    await pause();
  }
})();
