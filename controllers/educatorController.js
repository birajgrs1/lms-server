import { clerkClient } from "@clerk/express";
import Course from "../models/Course.js";
import Purchase from "../models/Purchase.js";
import { uploadToCloudinary } from "../config/multer.js";

// ====================== Update Role to Educator ======================
export const updateRoleToEducator = async (req, res) => {
  try {
    const userId = req.auth.userId;

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { role: "educator" },
    });

    res.json({
      success: true,
      message: "You can publish a course now!",
    });
  } catch (error) {
    console.error("Error in updateRoleToEducator:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ====================== Add New Course ======================
export const addCourse = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a course thumbnail",
      });
    }

    const { courseData } = req.body;
    const educatorId = req.auth.userId;

    // Validate educator role
    const user = await clerkClient.users.getUser(educatorId);
    if (user.publicMetadata.role !== "educator") {
      return res.status(403).json({
        success: false,
        message: "Only educators can add courses",
      });
    }

    // Parse course data
    let parsedCourseData;
    try {
      parsedCourseData = JSON.parse(courseData);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: "Invalid course data format",
      });
    }

    // Upload thumbnail to cloudinary from buffer
    let imageUpload;
    try {
      imageUpload = await uploadToCloudinary(req.file.buffer, "course-thumbnails");
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image: " + uploadError.message,
      });
    }

    // Create course with thumbnail URL
    const newCourse = await Course.create({
      ...parsedCourseData,
      educator: educatorId,
      courseThumbnail: imageUpload.secure_url,
      isPublished: false,
    });

    res.json({
      success: true,
      message: "Course added successfully!",
      course: newCourse,
    });
  } catch (error) {
    console.error("Error in addCourse:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ====================== Get Educator Courses ======================
export const getEducatorCourses = async (req, res) => {
  try {
    const educator = req.auth.userId;
    const courses = await Course.find({ educator });

    res.json({
      success: true,
      courses,
    });
  } catch (error) {
    console.error("Error in getEducatorCourses:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ====================== Get Educator Dashboard Data ======================
export const educatorDashboardData = async (req, res) => {
  try {
    const educator = req.auth.userId;
    const courses = await Course.find({ educator });
    const totalCourses = courses.length;

    const courseIds = courses.map((course) => course._id);

    // Calculate total enrollments
    const totalEnrollments = courses.reduce((total, course) => {
      return total + (course.enrolledStudents ? course.enrolledStudents.length : 0);
    }, 0);

    // Calculate total earnings
    const purchases = await Purchase.find({
      courseId: { $in: courseIds },
      status: "success",
    });

    const totalEarnings = purchases.reduce(
      (sum, purchase) => sum + purchase.amount,
      0
    );

    // Get enrolled students data for the table (latest 10)
    const latestPurchases = await Purchase.find({
      courseId: { $in: courseIds },
      status: "success",
    })
    .populate("userId", "name imageUrl")
    .populate("courseId", "courseTitle")
    .sort({ createdAt: -1 })
    .limit(10);

    const enrolledStudentsData = latestPurchases.map((purchase) => ({
      studentName: purchase.userId.name,
      courseTitle: purchase.courseId.courseTitle,
      enrollmentDate: purchase.createdAt.toLocaleDateString(),
      student: {
        name: purchase.userId.name,
        imageUrl: purchase.userId.imageUrl
      }
    }));

    res.json({
      success: true,
      dashboardData: {
        totalEarnings,
        totalCourses,
        totalEnrollments: totalEnrollments,
        enrolledStudentsData
      },
    });
  } catch (error) {
    console.error("Error in educatorDashboardData:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ====================== Get Enrolled Students Data ======================
export const getEnrolledStudentsData = async (req, res) => {
  try {
    const educator = req.auth.userId;
    const courses = await Course.find({ educator });
    const courseIds = courses.map((course) => course._id);

    const purchases = await Purchase.find({
      courseId: { $in: courseIds },
      status: "success",
    })
      .populate("userId", "name imageUrl")
      .populate("courseId", "courseTitle")
      .sort({ createdAt: -1 });

    const enrolledStudents = purchases.map((purchase) => ({
      studentName: purchase.userId.name,
      courseTitle: purchase.courseId.courseTitle,
      purchaseDate: purchase.createdAt,
      student: {
        name: purchase.userId.name,
        imageUrl: purchase.userId.imageUrl,
        fullName: purchase.userId.name
      }
    }));

    res.json({
      success: true,
      enrolledStudents,
    });
  } catch (error) {
    console.error("Error in getEnrolledStudentsData:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};