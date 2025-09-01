// controllers/userController.js
import User from "../models/User.js";
import Course from "../models/Course.js";
import Purchase from "../models/Purchase.js";
import { courseProgress } from "../models/CourseProgress.js";
import Stripe from "stripe";

// Get user data
export const getUserData = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let user = await User.findById(userId);

    // Auto-create user record if not exists
    if (!user) {
      user = await User.create({ _id: userId, enrolledCourses: [] });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error in getUserData:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get enrolled courses
export const userEnrolledCourses = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    let user = await User.findById(userId).populate("enrolledCourses");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, enrolledCourses: user.enrolledCourses || [] });
  } catch (error) {
    console.error("Error in userEnrolledCourses:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Purchase course
export const purchaseCourse = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { courseId } = req.body;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!courseId)
      return res
        .status(400)
        .json({ success: false, message: "Course ID required" });

    const user =
      (await User.findById(userId)) ||
      (await User.create({ _id: userId, enrolledCourses: [] }));
    const course = await Course.findById(courseId);
    if (!course)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });

    if (user.enrolledCourses.includes(courseId)) {
      return res
        .status(400)
        .json({ success: false, message: "Already enrolled" });
    }

    // Free course handling
    if (course.coursePrice === 0) {
      user.enrolledCourses.push(course._id);
      course.enrolledStudents.push(user._id);
      await user.save();
      await course.save();

      await Purchase.create({ userId, courseId, amount: 0, status: "success" });
      return res.json({ success: true, message: "Enrolled in free course" });
    }

    // Paid course
    const finalAmount = (
      course.coursePrice -
      (course.discount * course.coursePrice) / 100
    ).toFixed(2);
    const purchase = await Purchase.create({
      userId,
      courseId,
      amount: finalAmount,
      status: "pending",
    });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: process.env.CURRENCY?.toLowerCase() || "usd",
            product_data: {
              name: course.courseTitle,
              images: [course.courseThumbnail],
            },
            unit_amount: Math.round(parseFloat(finalAmount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.origin}/loading/my-enrollments`,
      cancel_url: `${req.headers.origin}/course/${courseId}`,
      metadata: { purchaseId: purchase._id.toString() },
    });

    res.json({ success: true, session_url: session.url });
  } catch (error) {
    console.error("Error in purchaseCourse:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update course progress
export const updateUserCourseProgress = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { courseId, lectureId } = req.body;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let progress = await courseProgress.findOne({ userId, courseId });
    if (progress) {
      if (!progress.lectureCompleted.includes(lectureId))
        progress.lectureCompleted.push(lectureId);
      else
        return res
          .status(400)
          .json({ success: false, message: "Lecture already completed" });
      await progress.save();
    } else {
      await courseProgress.create({
        userId,
        courseId,
        lectureCompleted: [lectureId],
      });
    }

    res.json({ success: true, message: "Progress updated" });
  } catch (error) {
    console.error("Error in updateUserCourseProgress:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get course progress
export const getUserCourseProgress = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { courseId } = req.body;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const progress = await courseProgress.findOne({ userId, courseId });
    if (!progress)
      return res
        .status(404)
        .json({ success: false, message: "No progress found" });

    res.json({ success: true, progressData: progress });
  } catch (error) {
    console.error("Error in getUserCourseProgress:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// User rating
export const userRating = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { courseId, rating } = req.body;
    if (!userId || !courseId || !rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid rating data" });
    }

    const course = await Course.findById(courseId);
    if (!course)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });

    const user = await User.findById(userId);
    if (!user || !user.enrolledCourses.includes(courseId)) {
      return res
        .status(400)
        .json({ success: false, message: "User not enrolled in this course" });
    }

    const existingRatingIndex = course.courseRatings.findIndex(
      (r) => r.userId.toString() === userId
    );
    if (existingRatingIndex !== -1) {
      course.courseRatings[existingRatingIndex].rating = rating;
    } else {
      course.courseRatings.push({ userId, rating });
    }

    await course.save();
    res.json({ success: true, message: "Rating added" });
  } catch (error) {
    console.error("Error in userRating:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
