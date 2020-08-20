const modules = require("./modules");
const config = require("../config");
module.exports = function({ api }) {
	const handleMessage = require("./handle/message")({ api, modules, config });
	const handleEvent = require("./handle/event")({ api, config });
	modules.log(config.prefix || "<Không có>", "[ PREFIX ]");
	modules.log(`${api.getCurrentUserID()} - ${config.botName}`, "[ UID ]");
	modules.log("Bắt đầu hoạt động!");
	modules.log("This bot was made by Catalizcs(roxtigger2003) and SpermLord(spermlord)");
	return function(error, event) {
		if (error) return modules.log(error, 2);
		switch (event.type) {
			case "message":
			case "message_reply":
				handleMessage({ event });
				break;
			case "message_unsend":
				handleUnsend({ event });
				break;
			case "event":
				handleEvent({ event });
				break;
			default:
				return;
				break;
		}
	};
};