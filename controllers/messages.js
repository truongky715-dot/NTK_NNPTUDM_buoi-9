let messageModel = require('../schemas/messages');
let userModel = require('../schemas/users');
const { default: mongoose } = require('mongoose');

module.exports = {
    /**
     * GET /:userID - Lấy toàn bộ tin nhắn 2 chiều
     * Lấy tất cả message from: user hiện tại, to: userID 
     * AND from: userID, to: user hiện tại
     */
    getConversation: async function (currentUserId, userID) {
        try {
            // Validate if userID is a valid MongoDB ObjectId
            if (!mongoose.Types.ObjectId.isValid(userID)) {
                return {
                    success: false,
                    message: "Invalid userID format"
                };
            }

            // Validate if both users exist
            const userExists = await userModel.findOne({
                _id: userID,
                isDeleted: false
            });

            if (!userExists) {
                return {
                    success: false,
                    message: "User not found"
                };
            }

            // Get all messages (2-way conversation)
            const messages = await messageModel
                .find({
                    $or: [
                        {
                            from: currentUserId,
                            to: userID,
                            isDeleted: false
                        },
                        {
                            from: userID,
                            to: currentUserId,
                            isDeleted: false
                        }
                    ]
                })
                .populate('from', 'username avatarUrl fullName')
                .populate('to', 'username avatarUrl fullName')
                .sort({ createdAt: 1 });

            return {
                success: true,
                data: messages,
                count: messages.length
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    },

    /**
     * POST / - Gửi tin nhắn
     * - Nếu có file: type = "file", text = đường dẫn file
     * - Nếu là text: type = "text", text = nội dung
     * - to: userID (người nhận)
     */
    sendMessage: async function (from, to, messageType, messageText) {
        try {
            // Validate inputs
            if (!from || !to || !messageType || !messageText) {
                return {
                    success: false,
                    message: "Missing required fields: from, to, messageType, messageText"
                };
            }

            // Validate messageType
            if (!["text", "file"].includes(messageType)) {
                return {
                    success: false,
                    message: "Message type must be 'text' or 'file'"
                };
            }

            // Validate if both users exist and are not deleted
            const fromUser = await userModel.findOne({
                _id: from,
                isDeleted: false
            });

            const toUser = await userModel.findOne({
                _id: to,
                isDeleted: false
            });

            if (!fromUser || !toUser) {
                return {
                    success: false,
                    message: "One or both users not found"
                };
            }

            // Check if sender is trying to send to themselves
            if (from.toString() === to.toString()) {
                return {
                    success: false,
                    message: "Cannot send message to yourself"
                };
            }

            // Create new message
            const newMessage = new messageModel({
                from: from,
                to: to,
                messageContent: {
                    type: messageType,
                    text: messageText
                }
            });

            await newMessage.save();

            // Populate user information
            await newMessage.populate('from', 'username avatarUrl fullName');
            await newMessage.populate('to', 'username avatarUrl fullName');

            return {
                success: true,
                data: newMessage,
                message: "Message sent successfully"
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    },

    /**
     * GET / - Lấy tin nhắn cuối cùng từ mỗi cuộc hội thoại
     * Lấy tin nhắn cuối cùng có liên quan đến user hiện tại
     * (tin nhắn gửi hoặc nhận từ user khác)
     */
    getLastMessages: async function (currentUserId) {
        try {
            // Get all users that have conversations with current user
            const conversationUsers = await messageModel.aggregate([
                {
                    $match: {
                        $or: [
                            { from: mongoose.Types.ObjectId(currentUserId) },
                            { to: mongoose.Types.ObjectId(currentUserId) }
                        ],
                        isDeleted: false
                    }
                },
                {
                    $group: {
                        _id: {
                            $cond: [
                                { $eq: ["$from", mongoose.Types.ObjectId(currentUserId)] },
                                "$to",
                                "$from"
                            ]
                        },
                        lastMessage: { $last: "$$ROOT" },
                        createdAt: { $last: "$createdAt" }
                    }
                },
                { $sort: { createdAt: -1 } }
            ]);

            // Get full message details with user information
            const lastMessages = [];
            for (let conv of conversationUsers) {
                const message = await messageModel
                    .findOne({
                        $or: [
                            {
                                from: currentUserId,
                                to: conv._id,
                                isDeleted: false
                            },
                            {
                                from: conv._id,
                                to: currentUserId,
                                isDeleted: false
                            }
                        ]
                    })
                    .sort({ createdAt: -1 })
                    .populate('from', 'username avatarUrl fullName')
                    .populate('to', 'username avatarUrl fullName');

                if (message) {
                    lastMessages.push(message);
                }
            }

            return {
                success: true,
                data: lastMessages,
                count: lastMessages.length
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
};
