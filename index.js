require("dotenv").config();
const login = require("./app/login");
const logger = require("./app/modules/log.js");
const { appStateFile } = require("./config");
const fs = require("fs-extra");
const express = require("express");
const app = express();
const cmd = require('node-cmd');

app.get("/", (request, response) => response.sendFile(__dirname + "/view/index.html"));
const listener = app.listen(process.env.PORT, () => logger("Đã mở tại port: " + listener.address().port), 0);

 setTimeout(() => {
	console.log("Đang làm mới sau 10 phút!");
	cmd.run("pm2 restart 0");
}, 600000);


require('npmlog').info = () => {};
login({ appState: require(appStateFile) }, (error, api) => {
	if (error) return logger(error, 2);
	fs.writeFileSync(appStateFile, JSON.stringify(api.getAppState(), null, "\t"));
	api.listenMqtt(require("./app/listen")({ api }));
});


// Made by CatalizCS and SpermLord
