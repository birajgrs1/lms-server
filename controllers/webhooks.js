//controllers/webhooks.js
import { Webhook as SvixWebhook } from "svix";
import Stripe from "stripe";
import User from "../models/User.js";
import Purchase from "../models/Purchase.js";
import Course from "../models/Course.js";

// -----------------------
// Clerk Webhook
// -----------------------
export const clerkWebHooks = async (req, res) => {
  try {
    if (process.env.CLERK_WEBHOOK_SECRET) {
      const wh = new SvixWebhook(process.env.CLERK_WEBHOOK_SECRET);

      // Verify request
      wh.verify(JSON.stringify(req.body), {
        "svix-id": req.headers["svix-id"],
        "svix-timestamp": req.headers["svix-timestamp"],
        "svix-signature": req.headers["svix-signature"],
      });
    } else {
      console.warn("CLERK_WEBHOOK_SECRET not set. Skipping verification.");
    }

    const { data, type } = req.body;

    switch (type) {
      case "user.created": {
        const userData = new User({
          _id: data.id,
          name: `${data.first_name} ${data.last_name}`,
          email: data.email_addresses[0].email_address,
          imageUrl: data.image_url,
        });
        await userData.save();
        break;
      }

      case "user.updated": {
        await User.findByIdAndUpdate(data.id, {
          name: `${data.first_name} ${data.last_name}`,
          email: data.email_addresses[0].email_address,
          imageUrl: data.image_url,
        });
        break;
      }

      case "user.deleted": {
        await User.findByIdAndDelete(data.id);
        break;
      }

      default:
        console.log("Unknown webhook type:", type);
        break;
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Clerk Webhook error:", err.message);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// -----------------------
// Stripe Webhook (Updated)
// -----------------------
export const stripeWebHooks = async (req, res) => {
  // Initialize Stripe 
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY not set.");
    return res.status(500).send("Stripe secret key not set.");
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const sig = req.headers["stripe-signature"];
  let event;

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("STRIPE_WEBHOOK_SECRET not set. Stripe webhook skipped.");
    return res.status(400).send("Webhook secret not set.");
  }

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { purchaseId } = session.metadata;
        
        const purchaseData = await Purchase.findById(purchaseId);
        const userData = await User.findById(purchaseData.userId);
        const courseData = await Course.findById(purchaseData.courseId.toString());

        if (!courseData.enrolledStudents.includes(userData._id)) {
          courseData.enrolledStudents.push(userData._id);
          await courseData.save();
        }

        if (!userData.enrolledCourses.includes(courseData._id)) {
          userData.enrolledCourses.push(courseData._id);
          await userData.save();
        }

        purchaseData.status = "success";
        await purchaseData.save();
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        const { purchaseId } = session.metadata;
        
        const purchaseData = await Purchase.findById(purchaseId);
        purchaseData.status = "expired";
        await purchaseData.save();
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
        });

        if (sessions.data.length > 0) {
          const { purchaseId } = sessions.data[0].metadata;
          const purchaseData = await Purchase.findById(purchaseId);
          if (purchaseData) {
            purchaseData.status = "failed";
            await purchaseData.save();
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Stripe Webhook processing error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};