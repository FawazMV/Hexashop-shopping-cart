const { default: mongoose } = require("mongoose")
const { OrderID } = require("../config/orderId")
const { payment } = require("../config/payment")
const { subTotal, OrderPush, inventory, percentage, coupenCheck } = require("../helpers/order_Helpers")
const orders_Model = require("../models/order-schema")
const usermodel = require("../models/user-schema")
const moment = require('moment')
const coupn_Model = require("../models/coupen_schema")



exports.placeOrder = async (req, res) => {
    let userId = req.session.user._id
    let total = await subTotal(userId)
    if (req.body.payment === "online") {
        OrderID().then(orderId => {
            payment(total * 100, orderId).then((response) => res.json({ response: response }))
        })
    }
    else if (req.body.payment === "cod") {
        OrderID().then(async (id) => {
            OrderPush(userId, id, total, 'COD').then(() => {
                res.json({ response: "cod" })
            })
        })
    } else {
        console.log('something went wrong at order controlleres')
    }
}


exports.cancelOrder = async (req, res) => {
    let userId = req.session.user._id;
    let product = await orders_Model.aggregate([
        { $match: { 'OrderDetails._id': mongoose.Types.ObjectId(req.body.id) } },
        {
            $project: {
                "OrderDetails": {
                    $filter: {
                        input: "$OrderDetails",
                        cond: { $eq: ["$$this._id", mongoose.Types.ObjectId(req.body.id)] }
                    }
                }
            }
        }
    ])
    let total = product[0].OrderDetails[0].total
    let P_id = product[0].OrderDetails[0].product_id
    let P_qty = product[0].OrderDetails[0].quantity
    inventory(P_id, -P_qty)
    let C_date = moment(Date.now()).format('DD-MM-YYYY')
    let { TotalPrice, coupenapplied, discountPercentage, discountPrice } = await orders_Model.findOne({ 'OrderDetails._id': req.body.id }, { _id: -1, TotalPrice: 1, coupenapplied: 1, discountPercentage: 1, discountPrice: 1 });
    TotalPrice = TotalPrice - total
    let finalPrice = TotalPrice
    if (coupenapplied) {
        let disc = percentage(discountPercentage, TotalPrice)
        if (disc < discountPrice) discountPrice = disc
        finalPrice = TotalPrice - discountPrice
        await orders_Model.updateOne({ 'OrderDetails._id': req.body.id }, { $set: { 'OrderDetails.$.Order_Status': 'Cancelled', 'OrderDetails.$.Canceled_date': C_date, finalPrice: finalPrice, discountPrice: disc }, $inc: { TotalPrice: -total } })
    } else {
        await orders_Model.updateOne({ 'OrderDetails._id': req.body.id }, { $set: { 'OrderDetails.$.Order_Status': 'Cancelled', 'OrderDetails.$.Canceled_date': C_date }, $inc: { TotalPrice: -total, finalPrice: -total } })
    }
    //{ TotalPrice, coupenapplied, discountPrice } = await orders_Model.findOne({ 'OrderDetails._id': req.body.id }, { _id: -1, TotalPrice: 1, coupenapplied: 1, discountPrice :1})

    res.json({ response: false, total: TotalPrice, date: C_date, finalPrice: finalPrice, discountPrice: discountPrice })

}

exports.coupenApply = (req, res) => {
    let userId = req.session.user._id;
    coupenCheck(req.body.code, userId).then((response) => {
        response.coupenStatus = true
        res.json(response)
    }).catch(response => {
        console.log(response)
        res.json({ coupenStatus: false, response: response })
    })
}
exports.coupenSave = async (req, res) => {
    let userId = req.session.user._id;
    if (req.body.code) {
        await usermodel.findByIdAndUpdate(userId, { $set: { cartDiscout: req.body.code } })
    } else {
        await usermodel.findByIdAndUpdate(userId, { $unset: { cartDiscout: 1 } }, { multi: true });
    }
    res.json()
}



// const x = new Date('2013-05-23');
// const x = new Date('2013-05-23');
// console.log('+x === +y', +x === +y);
// console.log('x < y', x < y); // false
// console.log('x > y', x > y); // false
// console.log('x <= y', x <= y); // true
// console.log('x >= y', x >= y); // true
// console.log('x === y', x === y);