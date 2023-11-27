const nodemailer = require('nodemailer');
require('dotenv').config();


// Function to send a regular email
exports.sendMail = async (email, mailSubject, content) => {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_MAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });
  
      const mailOptions = {
        from: `UrbanPay <${process.env.SMTP_FRM}>`,
        to: email,
        subject: mailSubject,
        html: content,
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.response);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };
  

