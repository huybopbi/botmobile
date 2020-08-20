require('dotenv').config();
const fs = require("fs-extra");
const login = require("fca-unofficial");
const readline = require("readline");

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const option = {
	logLevel: "silent",
	forceLogin: true,
	userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36"
};

//Hãy điền tài khoản và mật khẩu vào file .env sau khi đã đổi .env.example thành .env
const obj = {
	email: process.env.EMAIL,
	password: process.env.PASSWORD
};
login(obj, option, (err, api) => {
	if (err) {
		switch (err.error) {
			case "login-approval":
				console.log("Nhập mã xác minh 2 lớp:");
				rl.on("line", line => {
					err.continue(line);
					rl.close();
				});
				break;
			default:
			console.error(err);
		}
		return;
	}
	var json = JSON.stringify(api.getAppState(), null, "\t");
	var addNew = fs.createWriteStream(__dirname + "/appstate.json", { flags: "w" });
	addNew.write(json);
	console.log("Đã ghi xong appstate!");
});
