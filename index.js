import 'dotenv/config';
import fetch from 'node-fetch'; // полифилл Fetch API в Node JS
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream';
import {promisify} from 'node:util'
import iconv from 'iconv-lite'; // декодер файлов/потоков
import AdmZip from 'adm-zip'; // распаковщик архивов
import fs from 'fs';
import parser from 'xml2json'; // парсер xml в json

const streamPipeline = promisify(pipeline);

// делаем запрос на страницу ЦБ
const response = await fetch(process.env.PAGE);
const body = await response.text();
const results = body.match(/<(\/?)(\w+)([^>]*?)>/gi); // записываем все тэги в массив
let link;
for (let i = 0; i < results.length; i++) {
    if(/newbik/ig.test(results[i])) { // ищем тэг, в котором ссылка на файл
        link = results[i].match(/"(\\.|[^"\\])*"/g)[0].replace(/\"/g, '') // извлекаем ссылку
    }
}

// получаем по ссылке архив
const response2 = await fetch(process.env.ROOT + link);
await streamPipeline(response2.body, createWriteStream('./downloads/octocat.zip'))

// распаковываем архив
const zip = new AdmZip('./downloads/octocat.zip');
zip.extractAllTo('./downloads');

// заметил, что распакованный файл имеет в названии дату
// поэтому в этой функции генерируем название файла с датой
function fileName() {
    const date = new Date;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1) < 10 ?  '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
    const day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
    return `${year}${month}${day}_ED807_full.xml`;
}

// декодируем содержимое файла в win1251
const xml = iconv.decode(fs.readFileSync('./downloads/' + fileName()), 'win1251')

// парсим содержимое в json
const json = parser.toJson(xml);

// создаю из json-объекта массив с элементами, которые содержат объект Accounts
const entries = JSON.parse(json).ED807.BICDirectoryEntry.filter(entry => entry.hasOwnProperty('Accounts'));

let arr = []; // это массив, куда будет записан результат

// запилняем массив результатом
for(let i = 0; i < entries.length; i++) {
    const bic = entries[i].BIC;
    const name = entries[i].ParticipantInfo.NameP;
    const accounts = entries[i].Accounts;
    if(accounts.length > 1) {
        for(let account of accounts) {
            arr.push({ bic, name, corrAccount: account.Account });
        }
    } else {
        arr.push({ bic, name, corrAccount: accounts.Account });
    }   
};

// выводим результат
console.log(arr);