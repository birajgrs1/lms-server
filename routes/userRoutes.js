// routes/userRoutes.js
import express from "express";
import {
  getUserData,
  userEnrolledCourses,
  purchaseCourse,
  updateUserCourseProgress,
  getUserCourseProgress,
  userRating,
} from "../controllers/userController.js";
import { clerkMiddleware } from "@clerk/express";

const userRouter = express.Router();

userRouter.use(clerkMiddleware());

userRouter.get("/data", getUserData);
userRouter.get("/enrolled-courses", userEnrolledCourses);
userRouter.post("/purchase", purchaseCourse);
userRouter.post("/update-course-progress", updateUserCourseProgress);
userRouter.post("/get-course-progress", getUserCourseProgress);
userRouter.post("/add-rating", userRating);

export default userRouter;
