const db = require('../config/database');
const { generateOtp } = require("../helpers/generate_otp");
const { hashData } = require("../helpers/hash_data");
const bcrypt = require('bcrypt');
const { sendMail } = require('../helpers/send_mail');
require("dotenv").config();


exports.forgotPin = async (req, res) => {
    try {
      const { receiver } = req.body;
  
      if (!receiver) {
        return res.status(400).json({ msg: "Email, username, or phoneNumber is required" });
      }
  
      db.query("SELECT * FROM users WHERE email = ? OR username = ? OR phoneNumber = ?", [receiver, receiver, receiver], async (err, data) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
  
        if (data.length <= 0) {
          return res
            .status(409)
            .json({ msg: "Account record doesn't exist. Please sign up or check your input" });
        }
  
        const user_id = data[0].user_id;
        const email = data[0].email;
  
        // Delete any existing OTP record for the user
        db.query("DELETE FROM store_otp WHERE user_id = ?", [user_id], async (err, data) => {
          if (err) {
            return res.status(400).json({ error: err.message });
          }
  
          // Generate and store new OTP
          const otp = await generateOtp();
          const hashedOtp = await hashData(otp);
          const newOtpRecord = {
            user_id: user_id,
            otp: hashedOtp,
            created_at: Date.now(),
            expires_in: Date.now() + 3600000,
          };
  
          db.query("INSERT INTO store_otp SET ?", [newOtpRecord], async (err, data) => {
            if (err) {
              return res.status(400).json({ error: err.message });
            }
  
            // Send email with OTP
            const mailSubject = "Reset pin";
            const content = `Your OTP is: ${otp}`;
            await sendMail(email, mailSubject, content);
  
            res.status(200).json({ msg: "OTP has been sent to your email", user_id: user_id });
          });
        });
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
};


exports.resetPin = async (req, res) => {
    try {
      const { user_id, otp, pin, confirm_pin } = req.body;
  
      if (!user_id || !otp || !pin || !confirm_pin) {
        return res.status(400).json({ msg: "All fields are required" });
      }
  
      if (pin !== confirm_pin) {
        return res.status(400).json({ msg: "New PIN and confirm PIN do not match" });
      }
  
      db.query("SELECT * FROM store_otp WHERE user_id = ?", [user_id], async (err, data) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
  
        if (data.length <= 0) {
          return res.status(409).json({ msg: "Invalid user ID or OTP" });
        }
  
        const { expires_in, otp: hashedOtp } = data[0];
  
        if (expires_in < Date.now()) {
          // User OTP record has expired
          db.query("DELETE FROM store_otp WHERE user_id = ?", [user_id], (err, data) => {
            if (err) {
              return res.status(409).json({ msg: "OTP has expired. Please request again" });
            }
          });
        } else {
          const isValidOtp = await bcrypt.compare(otp, hashedOtp);
          if (!isValidOtp) {
            return res.status(409).json({ msg: "Invalid OTP. Please try again" });
          }
  
          // Update user's pin
          const hashedpin = await hashData(pin);
          db.query("UPDATE users SET pin = ? WHERE user_id = ?", [hashedpin, user_id], async (err, data) => {
            if (err) {
              return res.status(400).json({ error: err.message });
            }
  
            // Delete OTP record
            db.query("DELETE FROM store_otp WHERE user_id = ?", [user_id], (err, data) => {
              if (err) {
                return res.status(400).json({ error: err.message });
              }
  
              return res.status(200).json({ msg: "PIN reset successful" });
            });
          });
        }
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
};  