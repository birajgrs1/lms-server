// controllers/userController.js
import User from "../models/User.js";
import Purchase from "../models/Purchase.js";
import Course from "../models/Course.js";
import Stripe from "stripe";
import { courseProgress } from "../models/CourseProgress.js";

// Get user data
export const getUserData = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID missing",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error in getUserData:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Users enrolled courses with lecture link
export const userEnrolledCourses = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID missing",
      });
    }

    const userData = await User.findById(userId).populate("enrolledCourses");
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      enrolledCourses: userData.enrolledCourses || [],
    });
  } catch (error) {
    console.error("Error in userEnrolledCourses:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Purchase course (Updated with free course handling)
export const purchaseCourse = async (req, res) => {
  try {
    console.log("Purchase request body:", req.body);
    const { courseId } = req.body;
    const origin = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:3000";
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID missing",
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    // Find user and course
    const userData = await User.findById(userId);
    const courseData = await Course.findById(courseId);

    if (!userData || !courseData) {
      return res.status(404).json({
        success: false,
        message: "User or course not found",
      });
    }

    // Check if already enrolled
    if (userData.enrolledCourses.includes(courseId)) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course",
      });
    }

    // Check if already purchased
    const existingPurchase = await Purchase.findOne({ userId, courseId });
    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        message: "Course already purchased",
      });
    }

    // Handle free courses
    if (courseData.coursePrice === 0) {
      // Enroll user directly
      userData.enrolledCourses.push(courseData._id);
      courseData.enrolledStudents.push(userData._id);
      
      await userData.save();
      await courseData.save();
      
      // Create purchase record
      await Purchase.create({
        courseId: courseData._id,
        userId: userData._id,
        amount: 0,
        status: "success"
      });
      
      return res.json({
        success: true,
        message: "Enrolled in free course successfully"
      });
    }

    // Calculate final amount for paid courses
    const finalAmount = (
      courseData.coursePrice - (courseData.discount * courseData.coursePrice) / 100
    ).toFixed(2);

    // Create Purchase record
    const newPurchase = await Purchase.create({
      courseId: courseData._id,
      userId,
      amount: finalAmount,
      status: "pending",
    });

    // Initialize Stripe
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    const currency = process.env.CURRENCY?.toLowerCase() || "usd";

    // Prepare line items
    const line_items = [
      {
        price_data: {
          currency,
          product_data: { 
            name: courseData.courseTitle,
            images: [courseData.courseThumbnail],
          },
          unit_amount: Math.round(parseFloat(finalAmount) * 100),
        },
        quantity: 1,
      },
    ];

    // Create Checkout Session
    const session = await stripeInstance.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url: `${origin}/loading/my-enrollments`,
      cancel_url: `${origin}/course/${courseId}`,
      metadata: {
        purchaseId: newPurchase._id.toString(),
      },
    });

    res.json({
      success: true,
      session_url: session.url,
    });
  } catch (error) {
    console.error("Error in purchaseCourse:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user course progress
export const updateUserCourseProgress = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { courseId, lectureId } = req.body;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID missing",
      });
    }

    const progressData = await courseProgress.findOne({ userId, courseId });

    if (progressData) {
      if (progressData.lectureCompleted.includes(lectureId)) {
        return res.status(400).json({
          success: false,
          message: "Lecture already completed",
        });
      }
      progressData.lectureCompleted.push(lectureId);
      await progressData.save();
    } else {
      await courseProgress.create({
        userId,
        courseId,
        lectureCompleted: [lectureId],
      });
    }

    res.json({
      success: true,
      message: "Progress updated successfully",
    });
  } catch (error) {
    console.error("Error in updateUserCourseProgress:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user course progress
export const getUserCourseProgress = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { courseId } = req.body;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID missing",
      });
    }

    const progressData = await courseProgress.findOne({ userId, courseId });
    if (!progressData) {
      return res.status(404).json({
        success: false,
        message: "No progress data found",
      });
    }

    res.json({
      success: true,
      progressData,
    });
  } catch (error) {
    console.error("Error in getUserCourseProgress:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add User Ratings to Course
export const userRating = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { courseId, rating } = req.body;

    if (!userId || !courseId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Invalid rating data",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.enrolledCourses.includes(courseId)) {
      return res.status(404).json({
        success: false,
        message: "User has not purchased this course",
      });
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
    res.json({
      success: true,
      message: "Rating added successfully",
    });
  } catch (error) {
    console.error("Error in userRating:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};