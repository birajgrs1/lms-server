import express from "express";
import {
  getUserCourseProgress,
  getUserData,
  purchaseCourse,
  updateUserCourseProgress,
  userEnrolledCourses,
  userRating,
} from "../controllers/userController.js";
import { requireAuth } from "@clerk/clerk-sdk-node"; 

const userRouter = express.Router();

userRouter.get("/data", requireAuth(), getUserData);
userRouter.get("/enrolled-courses", requireAuth(), userEnrolledCourses);
userRouter.post("/purchase", requireAuth(), purchaseCourse);
userRouter.post("/update-course-progress", requireAuth(), updateUserCourseProgress);
userRouter.post("/get-course-progress", requireAuth(), getUserCourseProgress);
userRouter.post("/add-rating", requireAuth(), userRating);

export default userRouter;
