const fs = require("fs-extra");
module.exports = function ({ api, config }) {
	return function ({ event }) {
		switch (event.logMessageType) {
			case "log:subscribe":
				for (var i = 0; i < event.logMessageData.addedParticipants.length; i++) {
					if (event.logMessageData.addedParticipants[i].userFbId == api.getCurrentUserID()) {
						api.sendMessage(`Đã kết nối thành công!\nVui lòng sử dụng ${config.prefix}help để biết thêm chi tiết lệnh >w<`, event.threadID);
						api.changeNickname(config.botName, event.threadID, api.getCurrentUserID());
					}
				}
				break;
			case "log:unsubscribe":
				break;
			case "log:thread-icon":
				break;
			case "log:user-nickname":
				break;
			case "log:thread-color":
				break;
			case "log:thread-name":
				break;
		}
	}
}