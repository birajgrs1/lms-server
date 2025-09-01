// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: String }, // Clerk user ID
    name: { type: String },
    email: { type: String },
    imageUrl: { type: String },
    enrolledCourses: [{ type: String, ref: "Course" }],
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
