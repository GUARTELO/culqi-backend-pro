require("dotenv").config();
const nodemailer = require("nodemailer");

console.log("🔍 Probando configuración de email...");
console.log("GMAIL_USER:", process.env.GMAIL_USER);
console.log("GMAIL_APP_PASSWORD existe?:", !!process.env.GMAIL_APP_PASSWORD);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: '"Golden Infinity Test" <cirobriones99@gmail.com>',
      to: "cirobriones99@gmail.com",
      subject: "✅ TEST EMAIL - Funciona!",
      text: "Si recibes esto, el email está funcionando correctamente."
    });
    
    console.log("✅ EMAIL ENVIADO CORRECTAMENTE!");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ ERROR ENVIANDO EMAIL:", error.message);
    console.log("Error completo:", error);
  }
}

testEmail();
