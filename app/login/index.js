const login = require("./login");
const modules = require("../modules");
module.exports = async function({ appState }, callback) {
	if (typeof callback !== "function") return console.error("Không có hàm nào được đặt!");
	let api;
	try {
		api = await login({ appState }).catch(() => modules.log("Chưa có appstate!"));
		callback(undefined, api);
	}
	catch (e) {
		callback(e);
	}
}
