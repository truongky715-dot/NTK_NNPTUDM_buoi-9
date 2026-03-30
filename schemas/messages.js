const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: [true, "From user is required"]
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: [true, "To user is required"]
        },
        messageContent: {
            type: {
                type: String,
                enum: ["text", "file"],
                required: [true, "Message type is required"]
            },
            text: {
                type: String,
                required: [true, "Message content is required"]
            }
        },
        isRead: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("message", messageSchema);
