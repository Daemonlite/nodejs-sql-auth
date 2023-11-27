const db = require('../config/database');
const util = require('util');
const { generateOtp } = require("../helpers/generate_otp");
const { hashData } = require("../helpers/hash_data");
const bcrypt = require('bcrypt');
const { sendMail } = require('../helpers/send_mail');
const jwt = require('jsonwebtoken');
require("dotenv").config();


exports.verifyOtp = async (req, res) => {
    try {
        const { user_id, otp } = req.body;

        if (!user_id || !otp) {
            return res.status(400).json({ msg: "Empty OTP details not allowed" });
        }

        db.query("SELECT * FROM store_otp WHERE user_id = ?", [user_id], async (err, data) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            if (data.length <= 0) {
                return res.status(409).json({ msg: "Account record doesn't exist or has already been verified. Please try signing up or logging in" });
            }

            const { expires_in, otp: hashedOtp } = data[0];

            if (expires_in < Date.now()) {
                // User OTP record has expired
                db.query("DELETE FROM store_otp WHERE user_id = ?", [user_id], (err, data) => {
                    if (err) {
                        return res.status(409).json({ msg: "Code has expired. Please request again" });
                    }
                });
            } else {
                const isValidOtp = await bcrypt.compare(otp, hashedOtp);
                if (!isValidOtp) {
                    return res.status(409).json({ msg: "Invalid OTP. Please try again" });
                }

                // Delete OTP record
                db.query("DELETE FROM store_otp WHERE user_id = ?", [user_id], (err, data) => {
                    if (err) {
                        return res.status(400).json({ error: err.message });
                    }

                    // Update user verification status
                    db.query("UPDATE users SET verified = 1 WHERE user_id = ?", [user_id], async (err, data) => {
                        if (err) {
                            return res.status(400).json({ error: err.message });
                        }

                        // Retrieve user details
                        db.query("SELECT username, phoneNumber, user_id FROM users WHERE user_id = ?", [user_id], async (err, userData) => {
                            if (err) {
                                return res.status(400).json({ error: err.message });
                            }

                            if (userData.length <= 0) {
                                return res.status(400).json({ error: "User data not found" });
                            }

                            const { username, phoneNumber, user_id: userID } = userData[0];
                            // Generate JWT token and send it in response
                            const token = jwt.sign({ userID: [user_id] }, process.env.JWT_SECRET, { expiresIn: "1h" });
                            res.status(200).json({ 
                                msg: "User email verified successfully",
                                username,
                                phone_number: phoneNumber,
                                user_id: userID,
                                token
                            });
                        });
                    });
                });
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};


exports.resendOtp = async (req, res) => {
    try {
      const { user_id } = req.body;
  
      if (!user_id) {
        return res.status(400).json({ msg: "User ID is required" });
      }
  
      const data = await util.promisify(db.query).bind(db)(
        "SELECT * FROM users WHERE user_id = ? AND verified = 0",
        [user_id]
      );
  
      if (data.length === 0) {
        return res
          .status(404)
          .json({ msg: "User not found or account has been verified" });
      }
  
      // Generate and update new OTP
      const otp = await generateOtp();
      const hashedOtp = await hashData(otp);
      const verifyUser = {
        user_id: user_id,
        otp: hashedOtp,
        created_at: Date.now(),
        expires_in: Date.now() + 3600000,
      };
  
      const email = data[0].email;
      const mailSubject = "Complete your registration";
      const content =   `
        <p>Hi ${data[0].username},</p>
        <p>Please use the following OTP to complete your registration:</p>
        <h1>${otp}</h1>
        <p>This code will expire in 1 hour.</p>  
      `;
  
      await sendMail(email, mailSubject, content);
  
      const existingRecord = await util.promisify(db.query).bind(db)(
        "SELECT * FROM store_otp WHERE user_id = ?",
        [user_id]
      );
  
      let query, queryParams;
      if (existingRecord.length === 0) {
        query = "INSERT INTO store_otp (user_id, otp, created_at, expires_in) VALUES (?, ?, ?, ?)";
        queryParams = [verifyUser.user_id, verifyUser.otp, verifyUser.created_at, verifyUser.expires_in];
      } else {
        query = "UPDATE store_otp SET otp = ?, created_at = ?, expires_in = ? WHERE user_id = ?";
        queryParams = [verifyUser.otp, verifyUser.created_at, verifyUser.expires_in, verifyUser.user_id];
      }
  
      const updateResult = await util.promisify(db.query).bind(db)(
        query,
        queryParams
      );
  
      return res.status(200).json({ msg: "OTP has been resent" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };
  
  