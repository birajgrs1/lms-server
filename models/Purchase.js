// models/Purchase.js
import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema({
    userId: {
        type: String,
        ref: "User",
        required: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        required: true,
    },
    amount:{
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "success", "failed"],
        default: "pending",
    },
},
{timestamps: true}
);

const Purchase = mongoose.model("Purchase", purchaseSchema);
export default Purchase;