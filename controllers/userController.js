const db = require('../config/database');
const { generateOtp } = require("../helpers/generate_otp");
const { hashData } = require("../helpers/hash_data");
const { sendMail } = require('../helpers/send_mail');



exports.updateUserDetails = async (req, res) => {
  try {
    const { user_id, username, phoneNumber, email } = req.body;

    if (!user_id) {
      return res.status(400).json({ msg: "User ID is required" });
    }

    // Check if the user exists
    db.query("SELECT * FROM users WHERE user_id = ?", [user_id], async (err, data) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (data.length === 0) {
        return res.status(404).json({ msg: "User not found" });
      }

      const userData = data[0];
      const previousUsername = userData.username;
      const previousPhoneNumber = userData.phoneNumber;
      const previousEmail = userData.email;

      // If username or phoneNumber is not provided, use the previous record
      const updatedUsername = username || previousUsername;
      const updatedPhoneNumber = phoneNumber || previousPhoneNumber;

      // Check if the email already exists
      db.query(
        "SELECT * FROM users WHERE email = ? AND user_id != ?",
        [email, user_id],
        async (err, data) => {
          if (err) {
            return res.status(400).json({ error: err.message });
          }

          if (data.length > 0) {
            return res.status(409).json({ msg: "Email already exists" });
          }

          // Update user details based on the provided user_id
          db.query(
            "UPDATE users SET username = ?, phoneNumber = ?, email = ? WHERE user_id = ?",
            [updatedUsername, updatedPhoneNumber, email, user_id],
            async (err, data) => {
              if (err) {
                return res.status(400).json({ error: err.message });
              }

              if (email !== previousEmail) {
                // Email has changed, send OTP and update verified column
                const otp = await generateOtp();
                const hashedOtp = await hashData(otp);

                // Update verified column
                db.query(
                  "UPDATE users SET verified = 1 WHERE user_id = ?",
                  [user_id],
                  async (err, data) => {
                    if (err) {
                      return res.status(400).json({ error: err.message });
                    }

                    // Store the new OTP
                    db.query(
                      "INSERT INTO store_otp SET user_id = ?, otp = ?, created_at = ?, expires_in = ?",
                      [user_id, hashedOtp, Date.now(), Date.now() + 3600000],
                      async (err, data) => {
                        if (err) {
                          return res.status(400).json({ error: err.message });
                        }

                        // Send the OTP email
                        const mailSubject = "OTP for Email Update";
                        const content = `Your OTP is: ${otp}`;
                        await sendMail(email, mailSubject, content);
                      }
                    );
                  }
                );
              }

              res.status(200).json({ msg: "User details updated successfully" });
            }
          );
        }
      );
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};



  
  
exports.DeleteUser = async (req, res) => {
  try {
    const { user_id, phoneNumber, email } = req.body;

    // Server side validation
    if (!user_id && !phoneNumber && !email) {
      return res.status(400).json({ msg: 'Missing required field: user_id, phoneNumber, or email' });
    }

    // Find the user by user_id, phoneNumber, or email
    let findUserQuery;
    let findUserParams;
    if (user_id) {
      findUserQuery = "SELECT * FROM users WHERE user_id = ?";
      findUserParams = [user_id];
    } else if (phoneNumber) {
      findUserQuery = "SELECT * FROM users WHERE phoneNumber = ?";
      findUserParams = [phoneNumber];
    } else if (email) {
      findUserQuery = "SELECT * FROM users WHERE email = ?";
      findUserParams = [email];
    }
    
    db.query(findUserQuery, findUserParams, async (err, data) => {
      if (err) return res.status(400).json({ error: err.message });

      // Check if the user exists
      if (data.length === 0) {
        return res.status(400).json({ msg: "User does not exist" });
      }

      const user = data[0];

      // Check if the user is already deleted
      if (user.Active === "DELETED") {
        return res.status(400).json({ msg: "User is already deleted" });
      }

      // Delete the user
      const deleteUserQuery = "UPDATE users SET active = 'DELETED' WHERE user_id = ?";
      db.query(deleteUserQuery, [user.user_id], async (err, data) => {
        if (err) return res.status(400).json({ error: err.message });

        return res.status(200).json({ msg: "User deleted successfully" });
      });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

