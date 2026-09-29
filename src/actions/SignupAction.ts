"use server";

import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { Profile } from "@/database/entity/Profile.entity";
import { User } from "@/database/entity/User.entity";
import { otpTemplate } from "@/mails/emailVerificationTemplate";
import mailer from "@/services/Nodemailer";
import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import z from "zod";

enum AccountType {
  ADMIN = "Admin",
  STUDENT = "Student",
  INSTRUCTOR = "Instructor",
}

type UserInput = {
  accountType: AccountType;
  email: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  password: string;
  confirmPassword: string;
};

const userSchema = z
  .object({
    accountType: z.enum(["Student", "Instructor", "Admin"]),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email("Please provide a proper email"),
    contactNumber: z.string().trim().min(10),
    password: z.string().trim().min(1),
    confirmPassword: z.string().trim().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password and Confirm Password must be the same",
    path: ["confirmPassword"],
  });

const getBcryptRounds = () => {
  const rounds = Number(process.env.BCRYPT_ROUNDS);
  return Number.isInteger(rounds) && rounds > 0 ? rounds : 10;
};

const SignupAction = async (formData: FormData) => {
  let userInput: UserInput;

  try {
    userInput = userSchema.parse({
      accountType: formData.get("accountType"),
      email: formData.get("email"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      contactNumber: formData.get("contactNumber"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    }) as UserInput;
  } catch (error) {
    redirect(
      `/errorPage/${encodeURIComponent(
        "Wrong Inputs! Please ensure correct inputs"
      )}`
    );
  }

  await InitializeDatabase();

  const userRepository = AppDataSource.getRepository(User);
  const profileRepository = AppDataSource.getRepository(Profile);

  const existingUser = await userRepository.findOne({
    where: { email: userInput.email },
  });

  if (existingUser) {
    if (existingUser.isSignedIn) {
      redirect(`/errorPage/${encodeURIComponent("Email already registered")}`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(
      userInput.password,
      getBcryptRounds()
    );

    try {
      await mailer(
        userInput.email,
        "StudyNotion Verification Email",
        otpTemplate(otp)
      );
    } catch (error) {
      redirect(`/errorPage/${encodeURIComponent("Problem while sending OTP")}`);
    }

    existingUser.verificationOtp = otp;
    existingUser.firstName = userInput.firstName;
    existingUser.lastName = userInput.lastName;
    existingUser.contactNumber = userInput.contactNumber;
    existingUser.password = hashedPassword;
    existingUser.accountType = userInput.accountType;
    existingUser.image = `https://api.dicebear.com/5.x/initials/svg?seed=${userInput.firstName} ${userInput.lastName}`;

    try {
      await userRepository.save(existingUser);

      let profile = await profileRepository.findOne({
        where: { user: existingUser },
      });

      if (!profile) {
        profile = new Profile();
        profile.user = existingUser;
      }

      await profileRepository.save(profile);
    } catch (error) {
      redirect(
        `/errorPage/${encodeURIComponent(
          "Problem while signup! Try again later"
        )}`
      );
    }

    redirect(`/auth/otp-verification/${encodeURIComponent(userInput.email)}`);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await mailer(
      userInput.email,
      "StudyNotion Verification Email",
      otpTemplate(otp)
    );
  } catch (error) {
    redirect(`/errorPage/${encodeURIComponent("Problem while sending OTP")}`);
  }

  const hashedPassword = await bcrypt.hash(
    userInput.password,
    getBcryptRounds()
  );

  const user = new User();
  user.accountType = userInput.accountType;
  user.firstName = userInput.firstName;
  user.lastName = userInput.lastName;
  user.email = userInput.email;
  user.password = hashedPassword;
  user.contactNumber = userInput.contactNumber;
  user.verificationOtp = otp;
  user.image = `https://api.dicebear.com/5.x/initials/svg?seed=${userInput.firstName} ${userInput.lastName}`;

  try {
    await userRepository.save(user);

    const profile = new Profile();
    profile.user = user;

    await profileRepository.save(profile);
  } catch (error) {
    console.log(error);
    redirect(
      `/errorPage/${encodeURIComponent(
        "Problem while signup! Try again later"
      )}`
    );
  }

  redirect(`/auth/otp-verification/${encodeURIComponent(userInput.email)}`);
};

export default SignupAction;
