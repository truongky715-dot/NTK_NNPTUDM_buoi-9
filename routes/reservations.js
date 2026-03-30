var express = require('express');
var router = express.Router();
let mongoose = require('mongoose')
let { checkLogin } = require('../utils/authHandler.js')
let cartModel = require('../schemas/cart')
let reservationModel = require('../schemas/reservations')
let inventoryModel = require('../schemas/inventories')
let productModel = require('../schemas/products')

async function buildReservationItems(items, session) {
    let reservationItems = [];
    let totalAmount = 0;

    for (const item of items) {
        let product = await productModel.findById(item.product).session(session);
        if (!product || product.isDeleted) {
            throw new Error('product khong ton tai');
        }

        let inventory = await inventoryModel.findOne({
            product: item.product
        }).session(session);

        if (!inventory) {
            throw new Error('inventory khong ton tai');
        }

        let quantity = Number(item.quantity || 0);
        if (quantity <= 0) {
            throw new Error('quantity khong hop le');
        }

        let available = inventory.stock - inventory.reserved;
        if (available < quantity) {
            throw new Error('khong du ton kho de reserve');
        }

        inventory.reserved += quantity;
        await inventory.save({ session });

        let subtotal = product.price * quantity;
        totalAmount += subtotal;
        reservationItems.push({
            product: product._id,
            quantity: quantity,
            price: product.price,
            subtotal: subtotal
        })
    }

    return {
        reservationItems,
        totalAmount
    }
}

router.get('/', checkLogin, async function (req, res, next) {
    let userId = req.userId;
    let reservations = await reservationModel.find({
        user: userId
    }).sort({
        createdAt: -1
    }).populate('items.product');
    res.send(reservations)
})

router.get('/:id', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let id = req.params.id;
        let reservation = await reservationModel.findOne({
            _id: id,
            user: userId
        }).populate('items.product');
        if (!reservation) {
            res.status(404).send({
                message: 'reservation khong ton tai'
            })
            return;
        }
        res.send(reservation)
    } catch (error) {
        res.status(404).send({
            message: 'reservation khong ton tai'
        })
    }
})

router.post('/reserveACart', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession()
    session.startTransaction()
    try {
        let userId = req.userId;
        let cart = await cartModel.findOne({
            user: userId
        }).session(session);

        if (!cart || !cart.items || cart.items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            res.status(400).send({
                message: 'gio hang rong'
            })
            return;
        }

        let built = await buildReservationItems(cart.items, session);

        let reservation = new reservationModel({
            user: userId,
            items: built.reservationItems,
            totalAmount: built.totalAmount,
            status: 'actived',
            ExpiredAt: new Date(Date.now() + 15 * 60 * 1000)
        })
        reservation = await reservation.save({ session });

        cart.items = [];
        await cart.save({ session });

        await session.commitTransaction();
        session.endSession();
        res.send(reservation)
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({
            message: error.message
        })
    }
})

router.post('/reserveItems', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession()
    session.startTransaction()
    try {
        let userId = req.userId;
        let items = Array.isArray(req.body) ? req.body : req.body.items;

        if (!Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            res.status(400).send({
                message: 'body items khong hop le'
            })
            return;
        }

        let built = await buildReservationItems(items, session);

        let reservation = new reservationModel({
            user: userId,
            items: built.reservationItems,
            totalAmount: built.totalAmount,
            status: 'actived',
            ExpiredAt: new Date(Date.now() + 15 * 60 * 1000)
        })
        reservation = await reservation.save({ session });

        await session.commitTransaction();
        session.endSession();
        res.send(reservation)
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({
            message: error.message
        })
    }
})

router.post('/cancelReserve/:id', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let id = req.params.id;

        let reservation = await reservationModel.findOne({
            _id: id,
            user: userId
        });

        if (!reservation) {
            res.status(404).send({
                message: 'reservation khong ton tai'
            })
            return;
        }

        if (reservation.status !== 'actived') {
            res.status(400).send({
                message: 'reservation khong the cancel'
            })
            return;
        }

        for (const item of reservation.items) {
            let inventory = await inventoryModel.findOne({
                product: item.product
            });
            if (inventory) {
                inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
                await inventory.save();
            }
        }

        reservation.status = 'cancelled';
        await reservation.save();

        res.send(reservation)
    } catch (error) {
        res.status(400).send({
            message: error.message
        })
    }
})

module.exports = router;
