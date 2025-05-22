// app/api/submit-token/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { tokenSymbol, tokenAddress, tokenLogo } = await request.json();

    // Create a transporter using your email service configuration
    let transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // e.g., "smtp.example.com"
      port: Number(process.env.EMAIL_PORT), // e.g., 465 for secure, 587 for non-secure
      secure: process.env.EMAIL_SECURE === "true", // true for port 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email message options
    const mailOptions = {
      from: process.env.EMAIL_FROM, // sender address (e.g., "noreply@example.com")
      to: "homebasemarkets@gmail.com", // destination email address
      subject: "Token Listing Submission",
      text: `Token Symbol: ${tokenSymbol}\nToken Address: ${tokenAddress}\nLogo URL: ${tokenLogo}`,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);

    return NextResponse.json(
      { message: "Token Listing Submitted Successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { message: "Error sending email" },
      { status: 500 }
    );
  }
}
