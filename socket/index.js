const socketIo = require("socket.io");
const { sequelize } = require("../models");
const Message = require("../models").Message;
const users = new Map();
const userSockets = new Map();

const SocketServer = (server) => {
	const io = socketIo(server, {
		cors: {
			"*": "*",
		},
	});

	io.on("connection", (socket) => {
		//**  JOIN
		socket.on("join", async (user) => {
			// console.log("user---------------------------------", user.firstName);
			let sockets = [];
			if (users.has(user.id)) {
				const existingUser = users.get(user.id);
				existingUser.sockets = [
					...existingUser.sockets,
					...[socket.id],
				];
				users.set(user.id, existingUser);
				sockets = [...existingUser.sockets, ...[socket.id]];
				userSockets.set(socket.id, user.id);
				// console.log("users ---------------------------", users);
			} else {
				users.set(user.id, {
					id: user.id,
					sockets: [socket.id],
				});
				// console.log("users map+++++++++++++++++++++++++++", users);
				sockets.push(socket.id, user.id);
				userSockets.set(socket.id, user.id);
			}

			const onlineFriends = []; // ids
			const chatters = await getChatters(user.id); //query

			console.log("chatters", chatters);

			// notify his friends that user is now online
			for (let i = 0; i < chatters.length; i++) {
				if (users.has(chatters[i])) {
					const chatter = users.get(chatters[i]);
					chatter.sockets.forEach((socket) => {
						try {
							io.to(socket).emit("online", user);
						} catch (e) {}
					});
					onlineFriends.push(chatter.id);
				}
			}

			// console.log("sockets============", sockets);
			sockets.forEach((socket) => {
				try {
					io.to(socket).emit("friends", onlineFriends);
				} catch (e) {
					console.log(e);
				}
			});
			io.to(socket.id).emit("typing", user);
		});
		//** Message
		socket.on("message", async (message) => {
			let sockets = [];
			// add me id socket
			if (users.has(message.fromUser.id)) {
				sockets = users.get(message.fromUser.id).sockets;
			}
			// add to user chatting
			message.toUserId.forEach((id) => {
				if (users.has(id)) {
					sockets = [...sockets, ...users.get(id).sockets];
				}
			});

			try {
				const msg = {
					type: message.type,
					fromUserId: message.fromUser.id,
					chatId: message.chatId,
					message: message.message,
				};

				const saveMessage = await Message.create(msg);

				message.User = message.fromUser;
				message.fromUserId = message.fromUser.id;
				message.id = saveMessage.id;
				message.message = saveMessage.message;
				delete message.fromUser;

				sockets.forEach((socket) => {
					io.to(socket).emit("received", message);
				});
			} catch (e) {
				console.log(e);
			}
		});
		// **  DISCONNECT
		socket.on("disconnect", async () => {
			if (userSockets.has(socket.id)) {
				const user = users.get(userSockets.get(socket.id));
				// console.log("USER var ======================");
				if (user.sockets.length > 1) {
					user.sockets = user.sockets.filter((sock) => {
						if (sock !== socket.id) return true;
						userSockets.delete(sock);
						return false;
					});

					users.set(user.id, user);
				} else {
					const chatters = await getChatters(user.id);
					for (let i = 0; i < chatters.length; i++) {
						if (users.has(chatters[i])) {
							users
								.get(chatters[i])
								.sockets.forEach((socket) => {
									try {
										io.to(socket).emit("offline", user);
									} catch (e) {}
								});
						}
					}
					userSockets.delete(socket.id);
					users.delete(user.id);
				}
			}
		});

		// ** SEND TYPING
		socket.on("sendTyping", (typing) => {
			// console.log("typing=====================", typing);
			typing.toUserId.forEach((id) => {
				if (users.has(id)) {
					users.get(id).sockets.forEach((socket) => {
						io.to(socket).emit("typing", typing);
					});
				}
			});
		});
	});
};

const getChatters = async (userId) => {
	try {
		const [results, metadata] = await sequelize.query(`
		select "cu"."userId" from "ChatUsers" as cu
		inner join (
			select "c"."id" from "Chats" as c
			where exists (
					select "u"."id" from "Users" as u
					inner join "ChatUsers" on u.id = "ChatUsers"."userId"
					where u.id = ${parseInt(
						userId
					)} and c.id = "ChatUsers"."chatId"
				)
			) as cjoin on cjoin.id="cu"."chatId"
		where "cu"."userId" != ${parseInt(userId)}
		`);

		return results.length > 0
			? results.map((el) => el.userId)
			: [];
	} catch (e) {
		console.log(e);
		return [];
	}
};

module.exports = SocketServer;
