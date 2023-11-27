const { generateOtp } = require("../helpers/generate_otp");
const { hashData } = require("../helpers/hash_data");
const randomstring = require('randomstring');
const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../helpers/send_mail');
require("dotenv").config();


//create user endpoint
exports.RegisterUser = async (req, res) => {
  try {
    const { username, phoneNumber, email, pin } = req.body;

    // Server side validation
    if (!(username && phoneNumber && email && pin)) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    //Check if the user already exists
    const sqlQuery = `SELECT * FROM users WHERE email = ?`;

    // Query to execute the SQL statement
    db.query(sqlQuery, [email], async (err, data) => {
      if (err) return res.status(400).json({ error: err.message });
      if (data.length === 0) {
        // Hashing the input password
        const hashedPin = await hashData(pin);

        const userId = randomstring.generate(); // Generating a unique userID
        const user = { username, phoneNumber, email, pin: hashedPin, user_id: userId, verified: false };

        // Create SQL statement to insert the user into the Database table
        const sqlQuery =
          "INSERT INTO users (username, phoneNumber, email, pin, user_id, verified) VALUES (?)";

        // Query to execute the SQL statement
        db.query(
          sqlQuery,
          [Object.values(user)],
          async (err, data) => {
            if (err)
              return res.status(400).json({ error: err.message });

            // User OTP Verification
            const otp = await generateOtp();
            let mailSubject = "Complete your registration";
            let content =  `
            <h1>Hi ${username}</h1>
            <p>Please use the following OTP to complete your registration:</p>
            <h2>${otp}</h2>
            <p>This OTP is valid for 1 hour</p>
            
            `;


            // Hash the OTP
            const hashedOtp = await hashData(otp);
            const verifyUser = {
              user_id: userId,
              otp: hashedOtp,
              created_at: Date.now(),
              expires_in: Date.now() + 3600000
            };
            db.query(
              'INSERT INTO store_otp (user_id, otp, created_at, expires_in) VALUES (?)',
              [Object.values(verifyUser)],
              async (err, data) => {
                try {
                  if (err) return res.status(400).json({ error: err.message });
                  res.status(200).json({
                    status: "PENDING",
                    msg: "Verification OTP email sent",
                    data: {
                      user_id: userId,
                      email
                    }
                  });
                  await sendMail(email, mailSubject, content);
                } catch (error) {
                  res.status(401).json({
                    status: "FAILED",
                    msg: "Verification failed",
                  });
                }
              })
          });
      } else {
        return res.status(401).json({ msg: 'User Already Existed' });
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


//login user endpoint
exports.loginUser = async (req, res) => {
  try {
    const { receiver, pin } = req.body;

    if (!(receiver && pin)) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    db.query("SELECT * FROM users WHERE email = ? OR username = ? OR phoneNumber = ?", [receiver, receiver, receiver], async (err, data) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (data.length === 0) {
        return res.status(401).json({ msg: "Invalid login details" });
      }

      const user = data[0]

      if(user.Active === 'DELETED'){
        return res.status(400).json('Account Does Not Exist')
      }
    
      const login = "UPDATE users SET Active = 'YES' WHERE email = ? OR username = ? OR phoneNumber = ?"

    db.query(login,[user.email,user.phoneNumber,user.username],async (err,data) =>{
      if(err){return res.status(400).json({error:err.message})}
    })
      

      // Compare the hashed pin with the given pin
      const isPinMatch = await bcrypt.compare(pin, data[0].pin);
      if (!isPinMatch) {
        return res.status(401).json({ msg: "Invalid login details" });
      }

      // Generate JWT token and send it in response
      const token = jwt.sign({ user_id: data[0].user_id }, process.env.JWT_SECRET, { expiresIn: "24h" });
      res.status(200).json({
        msg: "Login successful",
        data: data[0],
        token
      });
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.logOut = async (req,res) => {
  const {user_id} = req.body

  if(!user_id){
    return res.status(400).json('user_id is required')
  }

  db.query("SELECT * FROM users WHERE user_id = ?", [user_id], async (err, data) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (data.length === 0) {
      return res.status(400).json({ msg: "User does not exist" });
    }

    const user = data[0]
    
    //changing active status on logout
    const logout = "UPDATE users SET Active = 'NO' WHERE user_id = ?"
    db.query(logout,[user.user_id],async (err,data) =>{
      if(err){return res.status(400).json({error:err.message})}
      return res.status(200).json({msg:"User Logged Out Sucessfully"})
    })

  });
}



