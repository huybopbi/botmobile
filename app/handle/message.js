module.exports = function({ api, modules, config }) {
	/* ================ Config ==================== */
	let {prefix, canCheckUpdate, googleSearch, wolfarm, yandex, openweather, tenor, saucenao, waketime, sleeptime, admins, ENDPOINT} = config;
	const fs = require("fs-extra");
	const moment = require("moment-timezone");
	const request = require("request");
	const ms = require("parse-ms");
	const stringSimilarity = require('string-similarity');
	const axios = require('axios');
	var resetNSFW = false;

	/* ================ Check update ================ */
	if (canCheckUpdate) {
		const semver = require('semver');
		axios.get('https://raw.githubusercontent.com/roxtigger2003/mirai/master/package.json').then((res) => {
			modules.log("Đang kiểm tra cập nhật...", 1);
			var local = JSON.parse(fs.readFileSync('./package.json')).version;
			if (semver.lt(local, res.data.version)) {
				modules.log('Đã có bản cập nhật mới! Hãy bật terminal/cmd và gõ "node update" để cập nhật!', 1);
				fs.writeFileSync('./.needUpdate', '');
			}
			else {
				if (fs.existsSync('./.needUpdate')) fs.removeSync('./.needUpdate');
				modules.log('Bạn đang sử dụng bản mới nhất!', 1);
			}
		}).catch(err => console.error(err));
	}

	/* ================ CronJob ==================== */
	if (!fs.existsSync(__dirname + "/src/groupID.json")) {
		var data = [];
		api.getThreadList(100, null, ["INBOX"], function(err, list) {
			if (err) throw err;
			list.forEach(item => (item.isGroup == true) ? data.push(item.threadID) : '');
			fs.writeFile(__dirname + "/src/groupID.json", JSON.stringify(data), err => {
				if (err) throw err;
				modules.log("Tạo file groupID mới thành công!");
			});
		});
	}
	else {
		fs.readFile(__dirname + "/src/groupID.json", "utf-8", (err, data) => {
			if (err) throw err;
			var groupids = JSON.parse(data);
			if (!fs.existsSync(__dirname + "/src/listThread.json")) fs.writeFile(__dirname + "/src/listThread.json", JSON.stringify({ wake: [], sleep: [] }), err => modules.log("Tạo file listThread mới thành công!"));
			setInterval(() => {
				var oldData = JSON.parse(fs.readFileSync(__dirname + "/src/listThread.json"));
				var timer = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm");
				groupids.forEach(item => {
					while (timer == sleeptime && !oldData.sleep.includes(item)) {
						api.sendMessage(`Tới giờ ngủ rồi đấy nii-chan, おやすみなさい!`, item);
						oldData.sleep.push(item);
						break;
					}
					while (timer == waketime && !oldData.wake.includes(item)) {
						api.sendMessage(`おはようございます các nii-chan uwu`, item);
						oldData.wake.push(item);
						break;
					}
					fs.writeFileSync(__dirname + "/src/listThread.json", JSON.stringify(oldData));
				});
				if (timer == "23:05" || timer == "07:05") fs.writeFileSync(__dirname + "/src/listThread.json", JSON.stringify({ wake: [], sleep: [] }));
			}, 1000);
		});
	}

	if (!fs.existsSync(__dirname + "/src/shortcut.json")) {
		var template = [];
		fs.writeFileSync(__dirname + "/src/shortcut.json", JSON.stringify(template));
		modules.log('Tạo file shortcut mới thành công!');
	}

	return function({ event }) {
		let { body: contentMessage, senderID, threadID, messageID } = event;
		senderID = parseInt(senderID);
		threadID = parseInt(threadID);

	/* ================ Staff Commands ==================== */
		//lấy shortcut
		if (contentMessage.length !== -1) {
			let shortcut = JSON.parse(fs.readFileSync(__dirname + "/src/shortcut.json"));
			if (shortcut.some(item => item.id == threadID)) {
				let getThread = shortcut.find(item => item.id == threadID).shorts;
				if (getThread.some(item => item.in == contentMessage)) return api.sendMessage(getThread.find(item => item.in == contentMessage).out, threadID);
			}
		}

		//lấy file cmds
		var nocmdData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));

		//tạo 1 đối tượng mới nếu group chưa có trong file cmds
		if (!nocmdData.banned.some(item => item.id == threadID)) {
			let addThread = {
				id: threadID,
				cmds: []
			};
			nocmdData.banned.push(addThread);
			fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(nocmdData));
		}

		//lấy lệnh bị cấm trong group
		var cmds = nocmdData.banned.find(item => item.id == threadID).cmds;
		for (const item of cmds) if (contentMessage.indexOf(prefix + item) == 0) return api.sendMessage("Lệnh này đã bị cấm!", threadID, messageID);

		//unban command
		if (contentMessage.indexOf(`${prefix}unban command`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 14,contentMessage.length);
			if (!content) return api.sendMessage("Hãy nhập lệnh cần bỏ cấm!", threadID, messageID);
			var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
			var getCMDS = jsonData.banned.find(item => item.id == threadID).cmds;
			if (!getCMDS.includes(content)) return api.sendMessage("Lệnh " + content + " chưa bị cấm", threadID, messageID);
			else {
				let getIndex = getCMDS.indexOf(content);
				getCMDS.splice(getIndex, 1);
				api.sendMessage("Đã bỏ cấm " + content + " trong group này", threadID, messageID);
			}
			return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
		}

		//ban command
		if (contentMessage.indexOf(`${prefix}ban command`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 12, contentMessage.length);
			if (!content) return api.sendMessage("Hãy nhập lệnh cần cấm!", threadID, messageID);
			var jsonData = JSON.parse(fs.readFileSync(__dirname + "/src/cmds.json"));
			if (!jsonData.cmds.includes(content)) return api.sendMessage("Không có lệnh " + content + " trong cmds.json nên không thể cấm", threadID, messageID);
			else {
				if (jsonData.banned.some(item => item.id == threadID)) {
					let getThread = jsonData.banned.find(item => item.id == threadID);
					getThread.cmds.push(content);
				}
				else {
					let addThread = {
						id: threadID,
						cmds: []
					};
					addThread.cmds.push(content);
					jsonData.banned.push(addThread);
				}
				api.sendMessage("Đã cấm " + content + " trong group này", threadID, messageID);
			}
			return fs.writeFileSync(__dirname + "/src/cmds.json", JSON.stringify(jsonData), "utf-8");
		}

		//Thông báo tới toàn bộ group!
		if (contentMessage.indexOf(`${prefix}noti`) == 0 && admins.includes(senderID)) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (!content) return api.sendMessage("Nhập thông tin vào!", threadID, messageID);
			return api.getThreadList(100, null, ["INBOX"], (err, list) => {
				if (err) throw err;
				list.forEach(item => (item.isGroup == true && item.threadID != threadID) ? api.sendMessage(content, item.threadID) : '');
				api.sendMessage('Đã gửi thông báo với nội dung:\n' + content, threadID, messageID);
			});
		}

		//restart
		if (contentMessage == `${prefix}restart` && admins.includes(senderID)) return api.sendMessage(`Hệ thống restart khẩn ngay bây giờ!!`, threadID, () => require("node-cmd").run("pm2 restart 0"), messageID);

	/* ==================== Help Commands ================*/

		//help
		if (contentMessage.indexOf(`${prefix}help`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var helpList = JSON.parse(fs.readFileSync(__dirname + "/src/listCommands.json"));
			if (content.length == 0) {
				var helpGroup = [];
				var helpMsg = "";
				helpList.forEach(help => (!helpGroup.some(item => item.group == help.group)) ? helpGroup.push({ group: help.group, cmds: [help.name] }) : helpGroup.find(item => item.group == help.group).cmds.push(help.name));
				helpGroup.forEach(help => helpMsg += `===== ${help.group.charAt(0).toUpperCase() + help.group.slice(1)} =====\n${help.cmds.join(', ')}\n\n`);
				return api.sendMessage(helpMsg, threadID, messageID);
			}
			else {
				if (helpList.some(item => item.name == content))
					return api.sendMessage(
						'=== Thông tin lệnh bạn đang tìm ===\n' +
						'- Tên lệnh: ' + helpList.find(item => item.name == content).name + '\n' +
						'- Nhóm lệnh: ' + helpList.find(item => item.name == content).group + '\n' +
						'- Thông tin: ' + helpList.find(item => item.name == content).decs + '\n' +
						'- Cách dùng: ' + prefix + helpList.find(item => item.name == content).usage + '\n' +
						'- Hướng dẫn: ' + prefix + helpList.find(item => item.name == content).example,
						threadID, messageID
					);
				else return api.sendMessage(`Lệnh bạn nhập không hợp lệ, hãy gõ ${prefix}help để xem tất cả các lệnh có trong bot.`, threadID, messageID);
			}
		}

		//yêu cầu công việc cho bot
		if (contentMessage.indexOf(`${prefix}request`) == 0) {
			var content = contentMessage.slice(prefix.length + 8,contentMessage.length);
			if (!fs.existsSync(__dirname + "/src/requestList.json")) {
				let requestList = [];
				fs.writeFileSync(__dirname + "/src/requestList.json",JSON.stringify(requestList));
			}
			if (content.indexOf("add") == 0) {
				var addnew = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				getData.push(addnew);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage("Đã thêm: " + addnew, threadID, () => api.sendMessage("ID " + senderID + " Đã thêm '" + addnew + "' vào request list", admins[0]), messageID);
			}
			else if (content.indexOf("del") == 0 && admins.includes(senderID)) {
				var deletethisthing = content.slice(4, content.length);
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage("Không tìm thấy " + deletethisthing, threadID, messageID);
				var itemIndex = getData.indexOf(deletethisthing);
				getData.splice(itemIndex, 1);
				fs.writeFileSync(__dirname + "/src/requestList.json", JSON.stringify(getData));
				return api.sendMessage("Đã xóa: " + deletethisthing, threadID, messageID);
			}
			else if (content.indexOf("list") == 0) {
				var getList = fs.readFileSync(__dirname + "/src/requestList.json");
				var getData = JSON.parse(getList);
				if (getData.length == 0) return api.sendMessage("Không có việc cần làm", threadID, messageID);
				let allWorks = "";
				getData.map(item => allWorks = allWorks + `\n- ` + item);
				return api.sendMessage("Đây là toàn bộ yêu cầu mà các bạn đã gửi:" + allWorks, threadID, messageID);
			}
		}

	/* ==================== Cipher Commands ================*/

		//morse
		if (contentMessage.indexOf(`${prefix}morse`) == 0) {
			const morsify = require('morsify');
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help morse`, threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(morsify.encode(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(morsify.decode(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help morse`, threadID, messageID);
		}

		//caesar
		if (contentMessage.indexOf(`${prefix}caesar`) == 0) {
			if (process.env.CAESAR == '' || process.env.CAESAR == null) return api.sendMessage('Chưa đặt mật khẩu CAESAR trong file .env', threadID, messageID);
			const Caesar = require('caesar-salad').Caesar;
			var content = contentMessage.slice(prefix.length + 7, contentMessage.length);
			if (event.type == "message_reply")(content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help caesar`, threadID, messageID);
			else(content.indexOf('encode') == 0) ? api.sendMessage(Caesar.Cipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('decode') == 0) ? api.sendMessage(Caesar.Decipher(process.env.CAESAR).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help caesar`, threadID, messageID);
		}

		//vigenere
		if (contentMessage.indexOf(`${prefix}vigenere`) == 0) {
			if (process.env.VIGENERE == '' || process.env.VIGENERE == null) return api.sendMessage('Chưa đặt mật khẩu VIGENERE trong file .env', threadID, messageID);
			const Vigenere = require('caesar-salad').Vigenere;
			var content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			if (event.type == "message_reply")(content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help vigenere`, threadID, messageID)
			else(content.indexOf('en') == 0) ? api.sendMessage(Vigenere.Cipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(Vigenere.Decipher(process.env.VIGENERE).crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help vigenere`, threadID, messageID);
		}

		//rot47
		if (contentMessage.indexOf(`${prefix}rot47`) == 0) {
			const ROT47 = require('caesar-salad').ROT47;
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (event.type == "message_reply") (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(event.messageReply.body), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(event.messageReply.body), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
			else (content.indexOf('en') == 0) ? api.sendMessage(ROT47.Cipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : (content.indexOf('de') == 0) ? api.sendMessage(ROT47.Decipher().crypt(content.slice(3, contentMessage.length)), threadID, messageID) : api.sendMessage(`Sai cú pháp, vui lòng tìm hiểu thêm tại ${prefix}help rot47`, threadID, messageID);
		}

	/* ==================== Media Commands ==================== */

		//youtube music
		if (contentMessage.indexOf(`${prefix}yt -m`) == 0)
			return (async () => {
				var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
				var ytdl = require("ytdl-core");
				var ffmpeg = require("fluent-ffmpeg");
				var ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
				ffmpeg.setFfmpegPath(ffmpegPath);
				if (content.indexOf("http") == -1) content = (await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&key=${googleSearch}&q=${encodeURIComponent(content)}`, {responseType: 'json'})).data.items[0].id.videoId;
				ytdl.getInfo(content, (err, info) => (info.length_seconds > 360) ? api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID) : '');
				return ffmpeg().input(ytdl(content)).toFormat("mp3").pipe(fs.createWriteStream(__dirname + "/src/music.mp3")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/music.mp3")}, threadID, () => fs.unlinkSync(__dirname + "/src/music.mp3"), messageID));
			})();

		//youtube video
		if (contentMessage.indexOf(`${prefix}yt -v`) == 0)
			return (async () => {
				var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 6, contentMessage.length);
				var ytdl = require("ytdl-core");
				if (content.indexOf("http") == -1) content = (await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&key=${googleSearch}&q=${encodeURIComponent(content)}`, {responseType: 'json'})).data.items[0].id.videoId;
				ytdl.getInfo(content, (err, info) => (info.length_seconds > 360) ? api.sendMessage("Độ dài video vượt quá mức cho phép, tối đa là 6 phút!", threadID, messageID) : '');
				return ytdl(content).pipe(fs.createWriteStream(__dirname + "/src/video.mp4")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/video.mp4")}, threadID, () => fs.unlinkSync(__dirname + "/src/video.mp4"), messageID));
			})();

		//anime
		if (contentMessage.indexOf(`${prefix}anime`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var jsonData = fs.readFileSync(__dirname + "/src/anime.json");
			var data = JSON.parse(jsonData).sfw;
			if (!content || !data.hasOwnProperty(content)) {
				let sfwList = [];
				Object.keys(data).forEach(endpoint => sfwList.push(endpoint));
				let sfwTags = sfwList.join(', ');
				return api.sendMessage(`=== Tất cả các tag Anime ===\n` + sfwTags, threadID, messageID);
			}
			return request(data[content], (error, response, body) => {
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID));
			});
		}

		//meme
		if (contentMessage == `${prefix}meme`)
			return request("https://meme-api.herokuapp.com/gimme/memes", (err, response, body) => {
				if (err) throw err;
				var content = JSON.parse(body);
				let title = content.title;
				var baseurl = content.url;
				let callback = function() {
					api.sendMessage({
						body: `${title}`,
						attachment: fs.createReadStream(__dirname + "/src/meme.jpg")
					}, threadID, () => fs.unlinkSync(__dirname + "/src/meme.jpg"), messageID);
				};
				request(baseurl).pipe(fs.createWriteStream(__dirname + `/src/meme.jpg`)).on("close", callback);
			});

		//gif
		if (contentMessage.indexOf(`${prefix}gif`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (content.length == -1) return api.sendMessage(`Bạn đã nhập sai format, vui lòng ${prefix}help gif để biết thêm chi tiết!`, threadID, messageID);
			if (content.indexOf(`cat`) !== -1) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=cat&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + `/src/randompic.gif`)).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`dog`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=dog&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`capoo`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=capoo&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`mixi`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=mixigaming&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else if (content.indexOf(`bomman`) == 0) {
				return request(`https://api.tenor.com/v1/random?key=${tenor}&q=bommanrage&limit=1`, (err, response, body) => {
					if (err) throw err;
					var string = JSON.parse(body);
					var stringURL = string.results[0].media[0].tinygif.url;
					request(stringURL).pipe(fs.createWriteStream(__dirname + "/src/randompic.gif")).on("close", () => api.sendMessage({attachment: fs.createReadStream(__dirname + "/src/randompic.gif")}, threadID, () => fs.unlinkSync(__dirname + "/src/randompic.gif"), messageID));
				});
			}
			else return api.sendMessage(`Tag của bạn nhập không tồn tại, vui lòng đọc hướng dẫn sử dụng trong ${prefix}help gif`, threadID, messageID);
		}

		//hug
		if (contentMessage.indexOf(`${prefix}hug`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/hug', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", I wanna hug you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//kiss
		if (contentMessage.indexOf(`${prefix}kiss`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/kiss', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 6, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", I wanna kiss you ❤️",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//tát
		if (contentMessage.indexOf(`${prefix}slap`) == 0 && contentMessage.indexOf('@') !== -1)
			return request('https://nekos.life/api/v2/img/slap', (err, response, body) =>{
				let picData = JSON.parse(body);
				let getURL = picData.url;
				let ext = getURL.substring(getURL.lastIndexOf(".") + 1);
				let tag = contentMessage.slice(prefix.length + 5, contentMessage.length).replace("@", "");
				let callback = function() {
					api.sendMessage({
						body: tag + ", take this slap 😈",
						mentions: [{
							tag: tag,
							id: Object.keys(event.mentions)[0]
						}],
						attachment: fs.createReadStream(__dirname + `/src/anime.${ext}`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/anime.${ext}`), messageID);
				};
				request(getURL).pipe(fs.createWriteStream(__dirname + `/src/anime.${ext}`)).on("close", callback);
			});

		//sauce
		if (contentMessage == `${prefix}sauce`) {
			const sagiri = require('sagiri'), search = sagiri(saucenao);
			if (event.type != "message_reply") return api.sendMessage(`Vui lòng bạn reply bức ảnh cần phải tìm!`, threadID, messageID);
			if (event.messageReply.attachments.length > 1) return api.sendMessage(`Vui lòng reply chỉ một ảnh!`, threadID, messageID);
			if (event.messageReply.attachments[0].type == 'photo') {
				if (saucenao == '' || typeof saucenao == 'undefined') return api.sendMessage(`Chưa có api của saucenao!`, threadID, messageID);
				return search(event.messageReply.attachments[0].url).then(response => {
					let data = response[0];
					let results = {
						similarity: data.similarity,
						material: data.raw.data.material || 'Không có',
						characters: data.raw.data.characters || 'Original',
						creator: data.raw.data.creator || 'Không biết',
						site: data.site,
						url: data.url
					};
					const minSimilarity = 50;
					if (minSimilarity <= ~~results.similarity) {
						api.sendMessage(
							'Đây là kết quả tìm kiếm được\n' +
							'-------------------------\n' +
							'- Độ tương tự: ' + results.similarity + '%\n' +
							'- Material: ' + results.material + '\n' +
							'- Characters: ' + results.characters + '\n' +
							'- Creator: ' + results.creator + '\n' +
							'- Original site: ' + results.site + ' - ' + results.url,
							threadID, messageID
						);
					}
					else api.sendMessage(`Không thấy kết quả nào trùng với ảnh bạn đang tìm kiếm :'(`, threadID, messageID);
				});
			}
		}

	/* ==================== General Commands ================*/
	
		//shortcut
		if (contentMessage.indexOf(`${prefix}short`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (!content) return api.sendMessage(`Không đúng format. Hãy tìm hiểu thêm tại ${prefix}help short.`, threadID, messageID);
			if (content.indexOf(`del`) == 0) {
				let delThis = contentMessage.slice(prefix.length + 10, contentMessage.length);
				if (!delThis) return api.sendMessage("Chưa nhập shortcut cần xóa.", threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					var getThread = oldData.find(item => item.id == threadID).shorts;
					if (!getThread.some(item => item.in == delThis)) return api.sendMessage("Shortcut này không tồn tại.", threadID, messageID);
					getThread.splice(getThread.findIndex(item => item.in === delThis), 1);
					fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Xóa shortcut thành công!", threadID, messageID));
				});
			}
			else if (content.indexOf(`all`) == 0) 
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					let allData = JSON.parse(data);
					let msg = '';
					if (!allData.some(item => item.id == threadID)) return api.sendMessage('Hiện tại không có shortcut nào.', threadID, messageID);
					if (allData.some(item => item.id == threadID)) {
						let getThread = allData.find(item => item.id == threadID).shorts;
						getThread.forEach(item => msg = msg + item.in + ' -> ' + item.out + '\n');
					}
					if (!msg) return api.sendMessage('Hiện tại không có shortcut nào.', threadID, messageID);
					msg = 'Tất cả shortcut đang có trong group là:\n' + msg;
					api.sendMessage(msg, threadID, messageID);
				});
			else {
				let narrow = content.indexOf(" => ");
				if (narrow == -1) return api.sendMessage(`Không đúng format. Hãy tìm hiểu thêm tại ${prefix}help short.`, threadID, messageID);
				let shortin = content.slice(0, narrow);
				let shortout = content.slice(narrow + 4, content.length);
				if (shortin == shortout) return api.sendMessage('Input và output giống nhau', threadID, messageID);
				if (!shortin) return api.sendMessage("Bạn chưa nhập input.", threadID, messageID);
				if (!shortout) return api.sendMessage("Bạn chưa nhập output.", threadID, messageID);
				return fs.readFile(__dirname + "/src/shortcut.json", "utf-8", (err, data) => {
					if (err) throw err;
					var oldData = JSON.parse(data);
					if (!oldData.some(item => item.id == threadID)) {
						let addThis = {
							id: threadID,
							shorts: []
						}
						addThis.shorts.push({ in: shortin, out: shortout });
						oldData.push(addThis);
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Tạo shortcut mới thành công!", threadID, messageID));
					}
					else {
						let getShort = oldData.find(item => item.id == threadID);
						if (getShort.shorts.some(item => item.in == shortin)) return api.sendMessage("Shortcut này đã tồn tại trong group này!", threadID, messageID);
						getShort.shorts.push({ in: shortin, out: shortout });
						return fs.writeFile(__dirname + "/src/shortcut.json", JSON.stringify(oldData), "utf-8", (err) => (err) ? console.error(err) : api.sendMessage("Tạo shortcut mới thành công!", threadID, messageID));
					}
				});
			}
		}

		//wake time calculator
		if (contentMessage.indexOf(`${prefix}sleep`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			var wakeTime = [];
			if (!content) {
				for (var i = 1; i < 7; i++) wakeTime.push(moment().utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage("Nếu bạn đi ngủ bây giờ, những thời gian hoàn hảo nhất để thức dậy là:\n" + wakeTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
			}
			else {
				if (content.indexOf(":") == -1) return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
				var contentHour = content.split(":")[0];
				var contentMinute = content.split(":")[1];
				if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2)  return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);				var getTime = moment().utcOffset("+07:00").format();
				var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
				var sleepTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
				for (var i = 1; i < 7; i++) wakeTime.push(moment(sleepTime).utcOffset("+07:00").add(90 * i + 15, 'm').format("HH:mm"));
				return api.sendMessage("Nếu bạn đi ngủ vào lúc " + content + ", những thời gian hoàn hảo nhất để thức dậy là:\n" + wakeTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
			}
		}

		//sleep time calculator
		if (contentMessage.indexOf(`${prefix}wake`) == 0) {
			const moment = require("moment-timezone");
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (content.indexOf(":") == -1) return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
			var sleepTime = [];
			var contentHour = content.split(":")[0];
			var contentMinute = content.split(":")[1];
			if (isNaN(contentHour) || isNaN(contentMinute) || contentHour > 23 || contentMinute > 59 || contentHour < 0 || contentMinute < 0 || contentHour.length != 2 || contentMinute.length != 2)  return api.sendMessage(`Không đúng format, hãy xem trong ${prefix}help`, threadID, messageID);
			var getTime = moment().utcOffset("+07:00").format();
			var time = getTime.slice(getTime.indexOf("T") + 1, getTime.indexOf("+"));
			var wakeTime = getTime.replace(time.split(":")[0] + ":", contentHour + ":").replace(time.split(":")[1] + ":", contentMinute + ":");
			for (var i = 6; i > 0; i--) sleepTime.push(moment(wakeTime).utcOffset("+07:00").subtract(90 * i + 15, 'm').format("HH:mm"));
			return api.sendMessage("Nếu bạn muốn thức dậy vào lúc " + content + ", những thời gian hoàn hảo nhất để đi ngủ là:\n" + sleepTime.join(', ') + "\nFact: Thời gian để bạn vào giấc ngủ từ lúc nhắm mắt là 15-20 phút", threadID, messageID);
		}

		//prefix
		if (contentMessage == 'prefix') return api.sendMessage(`Prefix là: ${prefix}`, threadID, messageID);

		//credits
		if (contentMessage == "credits") return api.sendMessage("Project Mirai được thực hiện bởi:\nSpermLord: https://fb.me/MyNameIsSpermLord\nCatalizCS: https://fb.me/Cataliz2k\nFull source code at: https://github.com/roxtigger2003/mirai", threadID, messageID);

		//simsimi
		if (contentMessage.indexOf(`${prefix}sim`) == 0) return request(`https://simsumi.herokuapp.com/api?text=${encodeURIComponent(contentMessage.slice(prefix.length + 4, contentMessage.length))}&lang=vi`, (err, response, body) => api.sendMessage((JSON.parse(body).success != '') ? JSON.parse(body).success : 'Không có câu trả nời nào.', threadID, messageID));

		//mit
		if (contentMessage.indexOf(`${prefix}mit`) == 0) return request(`https://kakko.pandorabots.com/pandora/talk-xml?input=${encodeURIComponent(contentMessage.slice(prefix.length + 4, contentMessage.length))}&botid=9fa364f2fe345a10&custid=${senderID}`, (err, response, body) => api.sendMessage((/<that>(.*?)<\/that>/.exec(body)[1]), threadID, messageID));

		//random màu cho theme chat
		if (contentMessage == `${prefix}randomcolor`) {
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			return api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID, (err) => (err) ? api.sendMessage('Đã có lỗi không mong muốn đã xảy ra', threadID, messageID) : '');
		}

		//poll
		if (contentMessage.indexOf(`${prefix}poll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			var title = content.slice(0, content.indexOf(" -> "));
			var options = content.substring(content.indexOf(" -> ") + 4)
			var option = options.split(" | ");
			var object = {};
			if (option.length == 1 && option[0].includes(' |')) option[0] = option[0].replace(' |', '');
			for (var i = 0; i < option.length; i++) object[option[i]] = false;
			return api.createPoll(title, threadID, object, (err) => (err) ? api.sendMessage("Có lỗi xảy ra vui lòng thử lại", threadID, messageID) : '');
		}

		//rainbow
		if (contentMessage.indexOf(`${prefix}rainbow`) == 0) {
			var value = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (isNaN(value)) return api.sendMessage('Dữ liệu không phải là một con số', threadID, messageID);
			if (value > 50) return api.sendMessage('Dữ liệu phải nhỏ hơn 50!', threadID, messageID);
			var color = ['196241301102133', '169463077092846', '2442142322678320', '234137870477637', '980963458735625', '175615189761153', '2136751179887052', '2058653964378557', '2129984390566328', '174636906462322', '1928399724138152', '417639218648241', '930060997172551', '164535220883264', '370940413392601', '205488546921017', '809305022860427'];
			for (var i = 0; i < value; i++) api.changeThreadColor(color[Math.floor(Math.random() * color.length)], threadID);
			return;
		}

		//thời tiết
		if (contentMessage.indexOf(`${prefix}weather`) == 0) {
			var city = contentMessage.slice(prefix.length + 8, contentMessage.length);
			if (city.length == 0) return api.sendMessage(`Bạn chưa nhập địa điểm, hãy đọc hướng dẫn tại ${prefix}help weather!`,threadID, messageID);
			request(encodeURI("https://api.openweathermap.org/data/2.5/weather?q=" + city + "&appid=" + openweather + "&units=metric&lang=vi"), (err, response, body) => {
				if (err) throw err;
				var weatherData = JSON.parse(body);
				if (weatherData.cod !== 200) return api.sendMessage(`Địa điểm ${city} không tồn tại!`, threadID, messageID);
				var sunrise_date = moment.unix(weatherData.sys.sunrise).tz("Asia/Ho_Chi_Minh");
				var sunset_date = moment.unix(weatherData.sys.sunset).tz("Asia/Ho_Chi_Minh");
				api.sendMessage({
					body: '🌡 Nhiệt độ: ' + weatherData.main.temp + '°C' + '\n' +
								'🌡 Nhiệt độ cơ thể cảm nhận được: ' + weatherData.main.feels_like + '°C' + '\n' +
								'☁️ Bầu trời hiện tại: ' + weatherData.weather[0].description + '\n' +
								'💦 Độ ẩm: ' + weatherData.main.humidity + '%' + '\n' +
								'💨 Tốc độ gió: ' + weatherData.wind.speed + 'km/h' + '\n' +
								'🌅 Mặt trời mọc vào lúc: ' + sunrise_date.format('HH:mm:ss') + '\n' +
								'🌄 Mặt trời lặn vào lúc: ' + sunset_date.format('HH:mm:ss') + '\n',
					location: {
						latitude: weatherData.coord.lat,
						longitude: weatherData.coord.lon,
						current: true
					},
				}, threadID, messageID);
			});
			return;
		}

		//say
		if (contentMessage.indexOf(`${prefix}say`) == 0) {
			var content = (event.type == "message_reply") ? event.messageReply.body : contentMessage.slice(prefix.length + 4, contentMessage.length);
			var languageToSay = (["ru","en","ko","ja"].some(item => content.indexOf(item) == 0)) ? content.slice(0, content.indexOf(" ")) : 'vi';
			var msg = (languageToSay != 'vi') ? content.slice(3, contentMessage.length) : content;
			var callback = () => api.sendMessage({body: "", attachment: fs.createReadStream(__dirname + "/src/say.mp3")}, threadID, () => fs.unlinkSync(__dirname + "/src/say.mp3"));
			return request(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(msg)}&tl=${languageToSay}&client=tw-ob`).pipe(fs.createWriteStream(__dirname+'/src/say.mp3')).on('close',() => callback());
		}

		//cập nhật tình hình dịch
		if (contentMessage == `${prefix}covid-19`)
			return request("https://code.junookyo.xyz/api/ncov-moh/data.json", (err, response, body) => {
				if (err) throw err;
				var data = JSON.parse(body);
				api.sendMessage(
					"Thế giới:" +
					"\n- Nhiễm: " + data.data.global.cases +
					"\n- Chết: " + data.data.global.deaths +
					"\n- Hồi phục: " + data.data.global.recovered +
					"\nViệt Nam:" +
					"\n- Nhiễm: " + data.data.vietnam.cases +
					"\n- Chết: " + data.data.vietnam.deaths +
					"\n- Phục hồi: " + data.data.vietnam.recovered,
					threadID, messageID
				);
			});

		//chọn
		if (contentMessage.indexOf(`${prefix}choose`) == 0) {
			var input = contentMessage.slice(prefix.length + 7, contentMessage.length).trim();
			if (!input)return api.sendMessage(`Bạn không nhập đủ thông tin kìa :(`,threadID,messageID);
			var array = input.split(" | ");
			return api.sendMessage(`Hmmmm, em sẽ chọn giúp cho là: ` + array[Math.floor(Math.random() * array.length)] + `.`,threadID,messageID);
		}

		//waifu
		if (contentMessage == `${prefix}waifu`) {
			var route = Math.round(Math.random() * 10);
			if (route == 1 || route == 0 || route == 3) return api.sendMessage("Dạ em sẽ làm vợ anh <3\nYêu chàng nhiều <3", threadID, messageID);
			else if (route == 2 || route > 4) return api.sendMessage("Chúng ta chỉ là bạn thôi :'(", threadID, messageID);
		}

		//ramdom con số
		if (contentMessage.indexOf(`${prefix}roll`) == 0) {
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (!content) return api.sendMessage(`uwu con số đẹp nhất em chọn được là: ${Math.floor(Math.random() * 99)}`, threadID, messageID);
			var splitContent = content.split(" ");
			if (splitContent.length != 2) return api.sendMessage(`Sai format, bạn hãy đọc hướng dẫn trong ${prefix}help roll để biết thêm chi tiết.`, threadID, messageID)
			var min = parseInt(splitContent[0]);
			var max = parseInt(splitContent[1]);
			if (isNaN(min) || isNaN(max)) return api.sendMessage('Dữ liệu bạn nhập không phải là một con số.', threadID, messageID);
			if (min >= max) return api.sendMessage('Oops, số kết thúc của bạn lớn hơn hoặc bằng số bắt đầu.', threadID, messageID);
			return api.sendMessage(`uwu con số đẹp nhất em chọn được là: ${Math.floor(Math.random() * (max - min + 1) + min)}`, threadID, messageID);
		}

		//Khiến bot nhái lại tin nhắn bạn
		if (contentMessage.indexOf(`${prefix}echo`) == 0) return api.sendMessage(contentMessage.slice(prefix.length + 5, contentMessage.length), threadID);

		//dịch ngôn ngữ
		if (contentMessage.indexOf(`${prefix}trans`) == 0) {
			var content = contentMessage.slice(prefix.length + 6, contentMessage.length);
			if (content.length == 0 && event.type != "message_reply") return api.sendMessage(`Bạn chưa nhập thông tin, vui lòng đọc ${prefix}help để biết thêm chi tiết!`, threadID,messageID);
			var translateThis = content.slice(0, content.indexOf(" ->"));
			var lang = content.substring(content.indexOf(" -> ") + 4);
			if (event.type == "message_reply") {
				translateThis = event.messageReply.body
				if (content.indexOf(" -> ") != -1) lang = content.substring(content.indexOf(" -> ") + 4);
				else lang = 'vi';
			}
			else if (content.indexOf(" -> ") == -1) {
				translateThis = content.slice(0, content.length)
				lang = 'vi';
			}
			return request(encodeURI(`https://translate.yandex.net/api/v1.5/tr.json/translate?key=${yandex}&text=${translateThis}&lang=${lang}`), (err, response, body) => {
				if (err) return api.sendMessage("Đã có lỗi xảy ra!", threadID, messageID)
				var retrieve = JSON.parse(body);
				var fromLang = retrieve.lang.split("-")[0];
				api.sendMessage(`Bản dịch: ${retrieve.text[0]}\n${fromLang} -> ${lang}`, threadID, messageID);
			});
		}

		//uptime
		if (contentMessage == `${prefix}uptime`) {
			var time = process.uptime();
			var hours = Math.floor(time / (60*60));
			var minutes = Math.floor((time % (60 * 60)) / 60);
			var seconds = Math.floor(time % 60);
			return api.sendMessage("Bot đã hoạt động được " + hours + " giờ " + minutes + " phút " + seconds + " giây.", threadID, messageID);
		}

		//unsend message
		if (contentMessage.indexOf(`${prefix}gỡ`) == 0) {
			if (event.messageReply.senderID != api.getCurrentUserID()) return api.sendMessage("Không thể gỡ tin nhắn của người khác", threadID, messageID);
			if (event.type != "message_reply") return api.sendMessage("Phản hồi tin nhắn cần gỡ", threadID, messageID);
			return api.unsendMessage(event.messageReply.messageID, err => (err) ? api.sendMessage("Không thể gỡ tin nhắn này vì đã quá 10 phút!", threadID, messageID) : '');
		}

		//get uid
		if (contentMessage.indexOf(`${prefix}uid`) == 0) {
			var content = contentMessage.slice(prefix.length + 4, contentMessage.length);
			if (!content) return api.sendMessage(`${senderID}`, threadID, messageID);
			else if (content.indexOf("@") !== -1) {
				for (var i = 0; i < Object.keys(event.mentions).length; i++) api.sendMessage(`${Object.keys(event.mentions)[i]}`, threadID, messageID);
				return;
			}
		}

		//wiki
		if (contentMessage.indexOf(`${prefix}wiki`) == 0) {
			const wiki = require("wikijs").default;
			var url = 'https://vi.wikipedia.org/w/api.php';
			var content = contentMessage.slice(prefix.length + 5, contentMessage.length);
			if (contentMessage.indexOf("-en") == 6) {
				url = 'https://en.wikipedia.org/w/api.php';
				content = contentMessage.slice(prefix.length + 9, contentMessage.length);
			}
			if (!content) return api.sendMessage("Nhập thứ cần tìm!", threadID, messageID);
			return wiki({apiUrl: url}).page(content).catch((err) => api.sendMessage("Không tìm thấy " + content, threadID, messageID)).then(page => (typeof page != 'undefined') ? Promise.resolve(page.summary()).then(val => api.sendMessage(val, threadID, messageID)) : '');
		}

		//ping
		if (contentMessage == `${prefix}ping`)
			return api.getThreadInfo(threadID, (err, info) => {
				if (err) return api.sendMessage("Đã có lỗi xảy ra", threadID, messageID);
				var icons = ["🥂","🎉","🌏","💥","💖","👏🏿","💪","❗️","❤️"];
				var ids = info.participantIDs;
				var botid = api.getCurrentUserID();
				var callid = {
					body: "Ping" + icons[Math.floor(Math.random() * icons.length)],
					mentions: [{
						tag: `${botid}`,
						id: botid
					}]
				};
				ids.forEach(id => {
					if (id != botid) {
						callid.mentions.push({
							tag: `${id}`,
							id: id
						});
					}
				});
				api.sendMessage(callid, threadID, messageID);
			});

		//look earth
		if (contentMessage == `${prefix}earth`)
			return request(`https://api.nasa.gov/EPIC/api/natural/images?api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				var randomNumber = Math.floor(Math.random() * ((jsonData.length -1) + 1));
				var image_name = jsonData[randomNumber].image
				var date = jsonData[randomNumber].date;
				var date_split = date.split("-")
				var year = date_split[0];
				var month = date_split[1];
				var day_and_time = date_split[2];
				var sliced_date = day_and_time.slice(0, 2);
				var image_link = `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${sliced_date}/png/` + image_name + ".png";
				let callback = function() {
					api.sendMessage({
						body: `${jsonData[randomNumber].caption} on ${date}`,
						attachment: fs.createReadStream(__dirname + `/src/randompic.png`)
					}, threadID, () => fs.unlinkSync(__dirname + `/src/randompic.png`), messageID);
				};
				request(image_link).pipe(fs.createWriteStream(__dirname + `/src/randompic.png`)).on("close", callback);
			});

		//localtion iss
		if (contentMessage == `${prefix}iss`) {
			return request(`http://api.open-notify.org/iss-now.json`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(`Vị trí hiện tại của International Space Station 🌌🌠🌃\nVĩ độ: ${jsonData.iss_position.latitude} | Kinh độ: ${jsonData.iss_position.longitude}`, threadID, messageID);
			});
		}

		//near-earth obj
		if (contentMessage == `${prefix}neo`) {
			return request(`https://api.nasa.gov/neo/rest/v1/feed/today?detailed=true&api_key=DEMO_KEY`, (err, response, body) => {
				if (err) throw err;
				var jsonData = JSON.parse(body);
				api.sendMessage(`Hiện tại đang có tổng cộng: ${jsonData.element_count} vật thể đang ở gần trái đất ngay lúc này!`, threadID, messageID);
			});
		}

		//spacex
		if (contentMessage == `${prefix}spacex`) {
			return request(`https://api.spacexdata.com/v3/launches/latest`, (err, response, body) => {
				if (err) throw err;
				var data = JSON.parse(body);
				api.sendMessage(
					"Thông tin đợt phóng mới nhất của SpaceX:" +
					"\n- Mission: " + data.mission_name +
					"\n- Năm phóng: " + data.launch_year +
					"\n- Thời gian phóng: " + data.launch_date_local +
					"\n- Tên lửa: " + data.rocket.rocket_name +
					"\n- Link Youtube: " + data.links.video_link,
				threadID, messageID);
			});
		}

		/* ==================== Study Commands ==================== */

		//toán học
		if (contentMessage.indexOf(`${prefix}math`) == 0) {
			const wolfram = "http://api.wolframalpha.com/v2/result?appid=" + wolfarm + "&i=";
			var m = contentMessage.slice(prefix.length + 5, contentMessage.length);
			request(wolfram + encodeURIComponent(m), function(err, response, body) {
				if (body.toString() === "Wolfram|Alpha did not understand your input") return api.sendMessage("Tôi chả hiểu bạn đang đưa thứ gì cho tôi nữa", threadID, messageID);
				else if (body.toString() === "Wolfram|Alpha did not understand your input") return api.sendMessage("Tôi không hiểu câu hỏi của bạn", threadID, messageID);
				else if (body.toString() === "My name is Wolfram Alpha.") return api.sendMessage("Tên tôi là Mirai", threadID, messageID);
				else if (body.toString() === "I was created by Stephen Wolfram and his team.") return api.sendMessage("Tôi được làm ra bởi CatalizCS và SpermLord", threadID, messageID);
				else if (body.toString() === "I am not programmed to respond to this dialect of English.") return api.sendMessage("Tôi không được lập trình để nói những thứ như này", threadID, messageID);
				else if (body.toString() === "StringJoin(CalculateParse`Content`Calculate`InternetData(Automatic, Name))") return api.sendMessage("Tôi không biết phải trả lời như nào", threadID, messageID);
				else return api.sendMessage(body, threadID, messageID);
			});
		}

		//cân bằng phương trình hóa học
		if (contentMessage.indexOf(`${prefix}chemeb`) == 0) {
			console.log = () => {};
			const chemeb = require('chem-eb');
			if (event.type == "message_reply") {
				var msg = event.messageReply.body;
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage('Hiện tại không hỗ trợ phương trình tối giản. Hãy chuyển (XY)z về dạng XzYz.', threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
			else {
				var msg = contentMessage.slice(prefix.length + 7, contentMessage.length);
				if (msg.includes('(') && msg.includes(')')) return api.sendMessage('Hiện tại không hỗ trợ phương trình tối giản. Hãy chuyển (XY)z về dạng XzYz.', threadID, messageID);
				var balanced = chemeb(msg);
				return api.sendMessage(`✅ ${balanced.outChem}`, threadID, messageID);
			}
		}

	/* ==================== NSFW Commands ==================== */

		//nhentai ramdom code
		if (contentMessage == `${prefix}nhentai -r`) return api.sendMessage((__GLOBAL.NSFWBlocked.includes(threadID)) ? 'Nhóm này đang bị tắt NSFW!' : `Code lý tưởng của nii-chan là: ${Math.floor(Math.random() * 99999)}`, threadID, messageID);

		//Check if command is correct
		if (contentMessage.indexOf(prefix) == 0) {
			var checkCmd, findSpace = contentMessage.indexOf(' ');
			if (findSpace == -1) {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, contentMessage.length), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, contentMessage.length)) return;
			}
			else {
				checkCmd = stringSimilarity.findBestMatch(contentMessage.slice(prefix.length, findSpace), nocmdData.cmds);
				if (checkCmd.bestMatch.target == contentMessage.slice(prefix.length, findSpace)) return;
			}
			if (checkCmd.bestMatch.rating >= 0.3) return api.sendMessage(`Lệnh bạn nhập không tồn tại.\nÝ bạn là lệnh "${prefix + checkCmd.bestMatch.target}" phải không?`, threadID, messageID);
		}
	}
}
/* This bot was made by Catalizcs(roxtigger2003) and SpermLord(spermlord) with love <3, pls dont delete this credits! THANKS */