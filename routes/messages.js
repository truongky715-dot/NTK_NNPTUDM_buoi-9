var express = require("express");
var router = express.Router();
let messageController = require('../controllers/messages');
let { checkLogin } = require('../utils/authHandler.js');

/**
 * GET / - Lấy tin nhắn cuối cùng từ mỗi cuộc hội thoại
 * Lấy tin nhắn cuối cùng mà user hiện tại nhắn tin hoặc user khác nhắn cho user hiện tại
 */
router.get("/", checkLogin, async function (req, res, next) {
    try {
        const currentUserId = req.session.userId; // Giả sử session lưu userId

        const result = await messageController.getLastMessages(currentUserId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json({
            success: true,
            data: result.data,
            count: result.count,
            message: "Last messages retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /:userID - Lấy toàn bộ tin nhắn 2 chiều
 * Lấy tất cả message giữa user hiện tại và userID
 * (from: user hiện tại, to: userID AND from: userID, to: user hiện tại)
 */
router.get("/:userID", checkLogin, async function (req, res, next) {
    try {
        const currentUserId = req.session.userId; // Giả sử session lưu userId
        const userID = req.params.userID;

        const result = await messageController.getConversation(currentUserId, userID);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json({
            success: true,
            data: result.data,
            count: result.count,
            message: "Conversation retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST / - Gửi tin nhắn
 * Body expected:
 * {
 *   to: userID (người nhận),
 *   messageType: "text" hoặc "file",
 *   messageText: nội dung hoặc đường dẫn file
 * }
 * 
 * Nếu có file: type = "file", text = đường dẫn file (ví dụ: /uploads/file.pdf)
 * Nếu là text: type = "text", text = nội dung tin nhắn
 */
router.post("/", checkLogin, async function (req, res, next) {
    try {
        const currentUserId = req.session.userId; // Giả sử session lưu userId
        const { to, messageType, messageText } = req.body;

        // Validate required fields
        if (!to || !messageType || !messageText) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: to, messageType, messageText"
            });
        }

        const result = await messageController.sendMessage(
            currentUserId,
            to,
            messageType,
            messageText
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(201).json({
            success: true,
            data: result.data,
            message: result.message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
