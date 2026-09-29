import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { otpTemplate } from "@/mails/emailVerificationTemplate";
import mailer from "@/services/Nodemailer";
import { NextRequest, NextResponse } from "next/server";

const isValidEmail = (email: unknown): email is string =>
  typeof email === "string" && email.trim().length > 0;

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!isValidEmail(email) || typeof otp !== "string") {
      return NextResponse.json({
        success: false,
        message: "Invalid verification request",
      });
    }

    await InitializeDatabase();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: "User doesn't exist",
      });
    }

    if (user.verificationOtp !== otp) {
      return NextResponse.json({
        success: false,
        message: "Invalid OTP",
      });
    }

    user.verificationOtp = null;
    user.isSignedIn = true;

    try {
      await userRepository.save(user);
    } catch (error) {
      console.error("Error signing in user", error);
      return NextResponse.json({
        success: false,
        message: "Error SigningIn User",
      });
    }

    return NextResponse.json({
      success: true,
      message: "User Signed In successfully",
      user,
    });
  } catch (error) {
    console.error("Error while trying to SignUp user", error);
    return NextResponse.json({
      success: false,
      message: "Error while trying to SignUp user",
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!isValidEmail(email)) {
      return NextResponse.json({
        success: false,
        message: "Invalid email",
      });
    }

    await InitializeDatabase();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: "User doesn't exist.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await mailer(email, "StudyNotion Verification-Email", otpTemplate(otp));
    } catch (error) {
      console.error("Problem while emailing OTP", error);
      return NextResponse.json({
        success: false,
        message: "Problem while Emailing OTP",
      });
    }

    user.verificationOtp = otp;

    try {
      await userRepository.save(user);
    } catch (error) {
      console.error("Cannot save resent OTP", error);
      return NextResponse.json({
        success: false,
        message: "Cannot Authenticate User right now. Try again later!",
      });
    }

    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error) {
    console.error("Problems while resending OTP or SigningIn user", error);
    return NextResponse.json({
      success: false,
      message: "Problems while resending OTP or SigningIn user",
    });
  }
}
