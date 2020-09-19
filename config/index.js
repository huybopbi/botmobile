require("dotenv").config();
const path = require("path");
module.exports = { //Hãy sửa trong file .env những dòng ghi process.env
	development: false,
	prefix: '!',
	canCheckUpdate: true,
	botName: 'Smartbot',
	googleSearch: 'AIzaSyBxo7837XxdK0oM8QHNj7IGxEsbw67s0f8',
	wolfarm: 'T8J8YV-H265UQ762K',
	yandex: 'trnsl.1.1.20200418T073103Z.c4ef03f424190059.03004d3b28130ebf6f8c3e71df34f2a413882c96',
	tenor: '73YIAOY3ACT1',
	openweather: '081c82065cfee62cb7988ddf90914bdd',
	saucenao: '61e802b1478f8e85198f28ed6ac2de6efe5d0a41',
	waketime: '',
	sleeptime: '',
	admins: ('100008366839123').split('_').map(e => parseInt(e)),
	nsfwGodMode: true,
	database: {
		postgres: {
			database: 'postgres',
			username: 'postgres',
			password: 'root',
			host: 'localhost',
		},
		sqlite: {
			storage: path.resolve(__dirname, "./data.sqlite"),
		},
	},
	appStateFile: path.resolve(__dirname, '../appstate.json')
}
