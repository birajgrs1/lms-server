// controllers/courseController.js
import Course from "../models/Course.js";

export const getAllCourse = async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .select(["-courseContent", "-enrolledStudents"]);

    res.json({
      success: true,
      courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Get course by id
export const getCourseById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const course = await Course.findById(id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    
    // Remove lectureUrl if isPreviewFree is false
    if (course.courseContent) {
      course.courseContent.forEach((chapter) => {
        if (chapter.chapterContent) {
          chapter.chapterContent.forEach((lecture) => {
            if (!lecture.isPreviewFree) {
              lecture.lectureUrl = "";
            }
          });
        }
      });
    }
    
    res.json({
      success: true,
      courseData: course, 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};