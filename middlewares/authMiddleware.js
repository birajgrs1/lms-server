// middlewares/protectedEducator.js
import { clerkClient } from "@clerk/express";

export const protectEducator = async (req, res, next) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID missing",
      });
    }

    // Fetch user from Clerk
    const user = await clerkClient.users.getUser(userId);

    // Check role in public metadata
    if (user.publicMetadata?.role !== "educator") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access. Educator role required",
      });
    }

    // User is authorized
    next();
  } catch (error) {
    console.error("Error in protectEducator middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
